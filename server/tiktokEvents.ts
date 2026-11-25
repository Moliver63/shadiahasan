/**
 * tiktokEvents.ts — Events API do TikTok (eventos pelo servidor)
 *
 * Mesmo desenho do metaCapi.ts, pelo mesmo motivo: o pagamento acontece na
 * fatura do Asaas, fora do site. Quem paga por Pix ou boleto costuma não
 * voltar, então o `Purchase` só pode sair do servidor, quando o webhook do
 * Asaas confirma o dinheiro. O navegador NUNCA dispara Purchase no TikTok:
 * assim não existe a mesma compra vinda de duas fontes.
 *
 * Variáveis (só no Render, nunca no código nem no cliente):
 *   TIKTOK_PIXEL_ID              código do Pixel (o mesmo do navegador)
 *   TIKTOK_EVENTS_ACCESS_TOKEN   token do Pixel (Events Manager > Pixel > Configurações > Events API)
 *   TIKTOK_EVENTS_TEST_CODE      opcional: o evento aparece só na aba "Test Events", não conta como conversão
 *
 * Sem as duas primeiras, tudo aqui é no-op silencioso: o site e a liberação do
 * acesso não podem depender de rastreamento. Nada neste módulo lança para quem
 * chama.
 *
 * Consentimento (LGPD). O registro de atribuição só nasce se o navegador
 * informou que a pessoa aceitou cookies de análise no momento da compra
 * (`tiktokConsent`). Sem esse registro, nenhum dado vai ao TikTok.
 *
 * Idempotência, em duas camadas:
 *   1. `event_id` = id da cobrança no Asaas. PAYMENT_CONFIRMED e
 *      PAYMENT_RECEIVED da mesma cobrança compartilham o id, e o TikTok
 *      deduplica por evento + event_id.
 *   2. Tabela `tiktokPurchases` (uma linha por cobrança): reserva atômica antes
 *      de enviar e `sentAt` depois do aceite. Reprocessar o webhook não reenvia.
 */

import { createHash } from "crypto";
import { sql } from "drizzle-orm";

export const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export type AtribuicaoTikTok = {
  ttclid?: string | null;
  ttp?: string | null;
  tiktokConsent?: boolean | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  landingUrl?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
};

export type CompraTikTok = {
  /** Id da cobrança no Asaas. Vira o `event_id`. */
  eventId: string;
  /** Valor em reais. */
  value: number;
  currency?: string;
  contentId: string;
  contentName?: string;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  /** Segundos desde a época: quando o pagamento foi confirmado. */
  eventTime?: number;
  atribuicao?: AtribuicaoTikTok;
};

export type RespostaTikTok = { ok: boolean; status?: number; codigo?: number; erro?: string };

export function tiktokEventsConfigurado(): boolean {
  return !!(process.env.TIKTOK_PIXEL_ID && process.env.TIKTOK_EVENTS_ACCESS_TOKEN);
}

function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

function normalizarEmail(email: string): string | null {
  const limpo = email.trim().toLowerCase();
  return limpo.includes("@") ? limpo : null;
}

/** E.164 com "+": 5511999998888 vira +5511999998888. Número sem DDI recebe 55. */
function normalizarTelefone(telefone: string): string | null {
  const d = telefone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? `+${d}` : `+55${d}`;
}

/** ttclid e _ttp são identificadores opacos: aceita só caracteres previsíveis e tamanho razoável. */
export function identificadorValido(v: unknown, max = 256): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max && /^[\w.\-~%]+$/.test(v);
}

/** Corpo da requisição. Separado do envio para o teste conferir o formato sem rede. */
export function montarCorpoCompra(c: CompraTikTok, pixelId: string, agora: () => number = () => Date.now()): Record<string, unknown> {
  const a = c.atribuicao || {};
  const user: Record<string, unknown> = {};
  if (identificadorValido(a.ttclid)) user.ttclid = a.ttclid;
  if (identificadorValido(a.ttp)) user.ttp = a.ttp;
  if (c.email) {
    const e = normalizarEmail(c.email);
    if (e) user.email = sha256(e);
  }
  if (c.phone) {
    const p = normalizarTelefone(c.phone);
    if (p) user.phone = sha256(p);
  }
  if (c.externalId) user.external_id = sha256(String(c.externalId));
  if (a.clientIp) user.ip = a.clientIp;
  if (a.clientUserAgent) user.user_agent = a.clientUserAgent;

  const valor = Number(c.value.toFixed(2));
  const evento: Record<string, unknown> = {
    event: "Purchase",
    event_time: c.eventTime ?? Math.floor(agora() / 1000),
    event_id: c.eventId,
    user,
    properties: {
      currency: c.currency || "BRL",
      value: valor,
      content_type: "product",
      order_id: c.eventId,
      contents: [
        {
          content_id: c.contentId,
          content_type: "product",
          ...(c.contentName ? { content_name: c.contentName } : {}),
          price: valor,
          quantity: 1,
        },
      ],
    },
  };
  if (a.landingUrl) evento.page = { url: a.landingUrl };

  const corpo: Record<string, unknown> = { event_source: "web", event_source_id: pixelId, data: [evento] };
  const codigoDeTeste = process.env.TIKTOK_EVENTS_TEST_CODE;
  if (codigoDeTeste) corpo.test_event_code = codigoDeTeste;
  return corpo;
}

/**
 * Envia um `Purchase`. Devolve o resultado em vez de lançar. O token vai no
 * cabeçalho `Access-Token` e nunca aparece em log, erro ou resposta.
 */
export async function enviarCompraTikTok(
  compra: CompraTikTok,
  fetchImpl: typeof fetch = fetch,
  agora: () => number = () => Date.now(),
): Promise<RespostaTikTok> {
  const pixelId = process.env.TIKTOK_PIXEL_ID;
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
  if (!pixelId || !token) return { ok: false, erro: "TIKTOK_PIXEL_ID ou TIKTOK_EVENTS_ACCESS_TOKEN ausente" };
  if (!(compra.value > 0)) return { ok: false, erro: "valor da compra inválido" };

  try {
    const resposta = await fetchImpl(TIKTOK_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify(montarCorpoCompra(compra, pixelId, agora)),
      // Sem resposta em 10s o webhook do Asaas nao pode ficar pendurado: a reserva e liberada e o reprocessamento tenta de novo.
      signal: AbortSignal.timeout(10_000),
    });
    const texto = await resposta.text();
    let json: any = null;
    try { json = JSON.parse(texto); } catch { /* sem JSON: o status HTTP decide */ }
    // A API do TikTok devolve HTTP 200 com `code` diferente de 0 quando recusa.
    const codigo = typeof json?.code === "number" ? json.code : undefined;
    if (!resposta.ok || (codigo !== undefined && codigo !== 0)) {
      return { ok: false, status: resposta.status, codigo, erro: String(json?.message || texto).replace(token, "***").slice(0, 300) };
    }
    return { ok: true, status: resposta.status, codigo };
  } catch (e) {
    return { ok: false, erro: (e instanceof Error ? e.message : String(e)).replace(token, "***").slice(0, 300) };
  }
}

// ─── Persistência (uma linha por cobrança) ───────────────────────────────────

type Executor = { execute: (q: any) => Promise<any> };

export async function garantirTabelaTikTok(d: Executor): Promise<void> {
  await d.execute(sql`
    CREATE TABLE IF NOT EXISTS "tiktokPurchases" (
      "paymentId" varchar(64) PRIMARY KEY,
      "origem" varchar(16) NOT NULL DEFAULT 'trial',
      "ttclid" varchar(256),
      "ttp" varchar(256),
      "utmSource" varchar(128),
      "utmMedium" varchar(128),
      "utmCampaign" varchar(191),
      "utmContent" varchar(191),
      "landingUrl" text,
      "clientIp" varchar(64),
      "clientUserAgent" text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "claimedAt" timestamp,
      "sentAt" timestamp,
      "attempts" integer NOT NULL DEFAULT 0,
      "lastCode" integer,
      "lastError" text
    )
  `);
}

/**
 * Guarda a origem do clique na criação da cobrança. Só grava com consentimento
 * explícito; sem ele, nada é guardado e, portanto, nada será enviado.
 */
export async function registrarAtribuicaoTikTok(
  d: Executor,
  paymentId: string,
  origem: "trial" | "programa",
  a?: AtribuicaoTikTok | null,
): Promise<boolean> {
  if (!a || a.tiktokConsent !== true || !paymentId) return false;
  try {
    await garantirTabelaTikTok(d);
    await d.execute(sql`
      INSERT INTO "tiktokPurchases" ("paymentId","origem","ttclid","ttp","utmSource","utmMedium","utmCampaign","utmContent","landingUrl","clientIp","clientUserAgent")
      VALUES (${paymentId}, ${origem},
        ${identificadorValido(a.ttclid) ? a.ttclid : null}, ${identificadorValido(a.ttp) ? a.ttp : null},
        ${a.utmSource ?? null}, ${a.utmMedium ?? null}, ${a.utmCampaign ?? null}, ${a.utmContent ?? null},
        ${a.landingUrl ?? null}, ${a.clientIp ?? null}, ${a.clientUserAgent ?? null})
      ON CONFLICT ("paymentId") DO NOTHING
    `);
    return true;
  } catch (e) {
    console.warn("[TikTok] atribuição não gravada:", e instanceof Error ? e.message : e);
    return false;
  }
}

export type DadosDaCompraConfirmada = {
  value: number;
  contentId: string;
  contentName?: string;
  email?: string | null;
  externalId?: string | null;
  eventTime?: number;
};

export type ResultadoEnvio = "enviado" | "ja_enviado" | "sem_consentimento" | "nao_configurado" | "em_andamento" | "recusado";

/**
 * Chamada pelo webhook depois de o Asaas confirmar o pagamento. Nunca lança.
 * A reserva (`claimedAt`) é um UPDATE atômico: duas execuções simultâneas para
 * a mesma cobrança não passam as duas. Reserva presa há mais de 10 minutos
 * (processo que caiu no meio) volta a poder ser tomada.
 */
export async function enviarCompraConfirmadaTikTok(
  d: Executor,
  paymentId: string,
  dados: DadosDaCompraConfirmada,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoEnvio> {
  try {
    if (!tiktokEventsConfigurado()) return "nao_configurado";
    await garantirTabelaTikTok(d);
    const reserva = (await d.execute(sql`
      UPDATE "tiktokPurchases"
         SET "claimedAt" = now(), "attempts" = "attempts" + 1
       WHERE "paymentId" = ${paymentId}
         AND "sentAt" IS NULL
         AND ("claimedAt" IS NULL OR "claimedAt" < now() - interval '10 minutes')
      RETURNING "ttclid","ttp","landingUrl","clientIp","clientUserAgent","utmSource","utmMedium","utmCampaign","utmContent"
    `)) as { rows?: Record<string, any>[] };
    const linha = reserva?.rows?.[0];
    if (!linha) {
      const existente = (await d.execute(sql`SELECT "sentAt","claimedAt" FROM "tiktokPurchases" WHERE "paymentId" = ${paymentId} LIMIT 1`)) as { rows?: Record<string, any>[] };
      const e = existente?.rows?.[0];
      if (!e) return "sem_consentimento";
      return e.sentAt ? "ja_enviado" : "em_andamento";
    }

    const r = await enviarCompraTikTok({
      eventId: paymentId,
      value: dados.value,
      currency: "BRL",
      contentId: dados.contentId,
      contentName: dados.contentName,
      email: dados.email,
      externalId: dados.externalId,
      eventTime: dados.eventTime,
      atribuicao: { ...linha, tiktokConsent: true },
    }, fetchImpl);

    if (r.ok) {
      if (process.env.TIKTOK_EVENTS_TEST_CODE) console.warn("[TikTok] ATENCAO: TIKTOK_EVENTS_TEST_CODE esta definido; este Purchase foi para Test Events e NAO conta como conversao. Remova a variavel em producao.");
      // O TikTok ja aceitou: se gravar o sentAt falhar, ainda assim e "enviado" (o event_id deduplica um reenvio).
      await d.execute(sql`UPDATE "tiktokPurchases" SET "sentAt" = now(), "lastCode" = ${r.codigo ?? 0}, "lastError" = NULL WHERE "paymentId" = ${paymentId}`).catch((e: unknown) => console.warn("[TikTok] sentAt nao gravado:", e instanceof Error ? e.message : e));
      console.log(`[TikTok] Purchase aceito: cobrança ${paymentId}${linha.ttclid || linha.ttp ? "" : " (sem ttclid/_ttp: pode não ser atribuído)"}`);
      return "enviado";
    }
    // Libera a reserva e guarda o motivo: o reprocessamento tenta de novo.
    await d.execute(sql`UPDATE "tiktokPurchases" SET "claimedAt" = NULL, "lastCode" = ${r.codigo ?? r.status ?? null}, "lastError" = ${r.erro ?? null} WHERE "paymentId" = ${paymentId}`);
    console.warn(`[TikTok] Purchase recusado (${r.codigo ?? r.status ?? "sem status"}): ${r.erro}`);
    return "recusado";
  } catch (e) {
    console.warn("[TikTok] falha ao enviar Purchase:", e instanceof Error ? e.message : e);
    return "recusado";
  }
}

/** Para o teste. */
export const _internals = { sha256, normalizarEmail, normalizarTelefone };

/**
 * metaCapi.ts — Conversions API da Meta (eventos pelo servidor)
 *
 * Por que pelo servidor. O pagamento do teste acontece na fatura do Asaas,
 * fora do site. Quem paga por PIX ou boleto costuma não voltar, e boleto pode
 * confirmar dias depois. Um `Purchase` disparado pelo navegador dependeria de
 * o comprador retornar: na prática, a maior parte das compras não seria
 * registrada. O webhook do Asaas é o único lugar que sabe, com certeza, que o
 * pagamento entrou.
 *
 * Variáveis (só no Render, nunca no código nem no cliente):
 *   META_PIXEL_ID             mesmo conjunto de dados usado pela conta de anúncios
 *   META_CAPI_ACCESS_TOKEN    token do conjunto de dados (Events Manager)
 *   META_CAPI_TEST_EVENT_CODE opcional, só para ver o evento na aba "Testar eventos"
 *   META_CAPI_API_VERSION     opcional, padrão abaixo
 *
 * Sem as duas primeiras, tudo aqui é no-op silencioso: o site e a liberação do
 * acesso não podem depender de rastreamento.
 *
 * Nada neste módulo lança para quem chama. Falha de rede ou recusa da Meta
 * viram log, nunca uma exceção no caminho que libera o acesso do aluno.
 */

import { createHash } from "crypto";

const VERSAO_PADRAO = "v21.0";

export type DadosDeAtribuicao = {
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  eventSourceUrl?: string | null;
};

export type EventoDeCompra = {
  /**
   * Identificador estável do acontecimento. Usamos o id da cobrança no Asaas:
   * PAYMENT_CONFIRMED e PAYMENT_RECEIVED da mesma cobrança compartilham o
   * mesmo id, então a Meta deduplica sozinha mesmo se os dois chegarem.
   */
  eventId: string;
  /** Valor em reais. */
  value: number;
  currency?: string;
  contentIds: string[];
  contentName?: string;
  /** Segundos desde a época. Quando o pagamento foi confirmado, não agora. */
  eventTime?: number;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
  atribuicao?: DadosDeAtribuicao;
};

export function capiConfigurado(): boolean {
  return !!(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

/** SHA-256 do valor normalizado, como a Meta exige para dados de correspondência. */
function hash(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

function normalizarEmail(email: string): string | null {
  const limpo = email.trim().toLowerCase();
  return limpo.includes("@") ? limpo : null;
}

/**
 * Telefone em formato internacional, só dígitos. Número brasileiro sem código
 * de país recebe o 55; com 55 já na frente, fica como está.
 */
function normalizarTelefone(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  if (digitos.startsWith("55")) return digitos;
  return `55${digitos}`;
}

type RespostaCapi = { ok: boolean; status?: number; erro?: string; eventsReceived?: number };

/**
 * Envia um `Purchase`. Devolve o resultado em vez de lançar.
 *
 * `fetchImpl` e `agora` entram por parâmetro para o teste não precisar de rede
 * nem de relógio real.
 */
export async function enviarCompra(
  evento: EventoDeCompra,
  fetchImpl: typeof fetch = fetch,
  agora: () => number = () => Date.now(),
): Promise<RespostaCapi> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    return { ok: false, erro: "META_PIXEL_ID ou META_CAPI_ACCESS_TOKEN ausente" };
  }

  const atr = evento.atribuicao || {};
  const userData: Record<string, unknown> = {};

  // Dados de correspondência com hash. Sem hash, a Meta rejeita.
  if (evento.email) {
    const e = normalizarEmail(evento.email);
    if (e) userData.em = [hash(e)];
  }
  if (evento.phone) {
    const p = normalizarTelefone(evento.phone);
    if (p) userData.ph = [hash(p)];
  }
  // Identificadores de clique e navegador vão sem hash, por especificação.
  if (atr.fbp) userData.fbp = atr.fbp;
  if (atr.fbc) userData.fbc = atr.fbc;
  if (evento.externalId) userData.external_id = [hash(String(evento.externalId))];
  if (atr.clientIpAddress) userData.client_ip_address = atr.clientIpAddress;
  if (atr.clientUserAgent) userData.client_user_agent = atr.clientUserAgent;

  const corpo: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: evento.eventTime ?? Math.floor(agora() / 1000),
        event_id: evento.eventId,
        action_source: "website",
        ...(atr.eventSourceUrl ? { event_source_url: atr.eventSourceUrl } : {}),
        user_data: userData,
        custom_data: {
          currency: evento.currency || "BRL",
          value: Number(evento.value.toFixed(2)),
          content_ids: evento.contentIds,
          content_type: "product",
          ...(evento.contentName ? { content_name: evento.contentName } : {}),
        },
      },
    ],
  };
  const codigoDeTeste = process.env.META_CAPI_TEST_EVENT_CODE;
  if (codigoDeTeste) corpo.test_event_code = codigoDeTeste;

  const versao = process.env.META_CAPI_API_VERSION || VERSAO_PADRAO;
  const url = `https://graph.facebook.com/${versao}/${pixelId}/events`;

  try {
    const resposta = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // O token vai no corpo, não na URL: URL de requisição costuma ir pra log.
      body: JSON.stringify({ ...corpo, access_token: token }),
    });
    const texto = await resposta.text();
    if (!resposta.ok) {
      return { ok: false, status: resposta.status, erro: texto.slice(0, 500) };
    }
    let recebidos: number | undefined;
    try {
      recebidos = JSON.parse(texto)?.events_received;
    } catch {
      /* resposta sem JSON: o status já diz que foi aceita */
    }
    return { ok: true, status: resposta.status, eventsReceived: recebidos };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Para o teste: expõe a normalização sem depender de rede. */
export const _internals = { hash, normalizarEmail, normalizarTelefone };

/**
 * Conversões e funil do painel Analytics & Marketing (28/11/2026).
 *
 * 1. Reenvio: venda paga que não chegou à Meta, ao GA4 ou ao TikTok (variável
 *    ausente na hora, recusa, queda de rede) é mandada de novo pela rotina de
 *    10 min, com o mesmo id da cobrança (as plataformas descartam repetição) e a
 *    data real do pagamento.
 * 2. Painel: o que está ligado (só sim/não, nunca valores) e o funil por origem,
 *    lido do próprio banco, que não depende de cookie nem de plataforma.
 *
 * Consentimento: o REENVIO só pega venda que trouxe o identificador do navegador
 * (_fbp/_fbc ou client_id do GA4), que só existe com cookies de análise aceitos.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";
import { capiConfigurado } from "./metaCapi";
import { ga4ServidorConfigurado } from "./ga4";
import { enviarCompraConfirmadaTikTok, tiktokEventsConfigurado } from "./tiktokEvents";

/** A Meta aceita evento de até 7 dias atrás; o GA4, de até 72 h. Com folga. */
export const JANELA_META_H = 6 * 24;
export const JANELA_GA4_H = 71;

const linhas = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Consulta que não derruba o painel quando a tabela ainda não existe. */
async function consulta(q: ReturnType<typeof sql>): Promise<any[]> {
  const d = await db.getDb();
  if (!d) return [];
  try {
    return linhas(await d.execute(q));
  } catch (e) {
    console.warn("[Conversoes] consulta falhou:", e instanceof Error ? e.message : e);
    return [];
  }
}

const horas = (n: number) => sql`(now() - (${n} * interval '1 hour'))`;

export async function reenviarConversoesPendentes(): Promise<number> {
  let tentativas = 0;
  const trial = await import("./trial");
  const programa = await import("./programaVenda");

  if (capiConfigurado()) {
    for (const v of await consulta(sql`SELECT "id","asaasPaymentId" FROM "trialPasses"
        WHERE "status" = 'active' AND "capiPurchaseSentAt" IS NULL AND ("fbp" IS NOT NULL OR "fbc" IS NOT NULL) AND "paidAt" > ${horas(JANELA_META_H)} LIMIT 20`)) {
      await trial.enviarCompraParaMeta(Number(v.id), String(v.asaasPaymentId));
      tentativas++;
    }
    for (const v of await consulta(sql`SELECT pc."id", pc."asaasPaymentId", c."title" FROM "programaCompras" pc LEFT JOIN "contentCollections" c ON c."id" = pc."collectionId"
        WHERE pc."status" = 'active' AND pc."origem" = 'asaas' AND pc."capiPurchaseSentAt" IS NULL AND (pc."fbp" IS NOT NULL OR pc."fbc" IS NOT NULL) AND pc."paidAt" > ${horas(JANELA_META_H)} LIMIT 20`)) {
      await programa.enviarCompraParaMeta(Number(v.id), String(v.asaasPaymentId), v.title);
      tentativas++;
    }
  }

  if (ga4ServidorConfigurado()) {
    for (const v of await consulta(sql`SELECT "id","asaasPaymentId" FROM "trialPasses"
        WHERE "status" = 'active' AND "ga4PurchaseSentAt" IS NULL AND "ga4ClientId" IS NOT NULL AND "paidAt" > ${horas(JANELA_GA4_H)} LIMIT 20`)) {
      await trial.enviarCompraParaGA4(Number(v.id), String(v.asaasPaymentId));
      tentativas++;
    }
    for (const v of await consulta(sql`SELECT pc."id", pc."asaasPaymentId", c."title" FROM "programaCompras" pc LEFT JOIN "contentCollections" c ON c."id" = pc."collectionId"
        WHERE pc."status" = 'active' AND pc."origem" = 'asaas' AND pc."ga4PurchaseSentAt" IS NULL AND pc."ga4ClientId" IS NOT NULL AND pc."paidAt" > ${horas(JANELA_GA4_H)} LIMIT 20`)) {
      await programa.enviarCompraParaGA4(Number(v.id), String(v.asaasPaymentId), v.title);
      tentativas++;
    }
  }

  if (tiktokEventsConfigurado()) {
    const d = await db.getDb();
    // Só existe linha em tiktokPurchases para quem consentiu. Até 5 tentativas.
    const pendentes = await consulta(sql`
      SELECT t."paymentId", v."valor", v."conteudo", v."titulo", v."email", v."userId", v."pagoEm"
        FROM "tiktokPurchases" t
        JOIN (
          SELECT p."asaasPaymentId" AS id, p."amountCents" AS valor, 'lesson:' || p."lessonId" AS conteudo, l."title" AS titulo, u."email", p."userId", EXTRACT(EPOCH FROM p."paidAt")::bigint AS "pagoEm"
            FROM "trialPasses" p LEFT JOIN "lessons" l ON l."id" = p."lessonId" LEFT JOIN "users" u ON u."id" = p."userId"
           WHERE p."status" = 'active' AND p."paidAt" > ${horas(JANELA_META_H)}
          UNION ALL
          SELECT pc."asaasPaymentId", pc."amountCents", 'programa:' || pc."collectionId", c."title", u."email", pc."userId", EXTRACT(EPOCH FROM pc."paidAt")::bigint
            FROM "programaCompras" pc LEFT JOIN "contentCollections" c ON c."id" = pc."collectionId" LEFT JOIN "users" u ON u."id" = pc."userId"
           WHERE pc."status" = 'active' AND pc."paidAt" > ${horas(JANELA_META_H)}
        ) v ON v.id = t."paymentId"
       WHERE t."sentAt" IS NULL AND t."attempts" < 5 LIMIT 20`);
    for (const v of pendentes) {
      await enviarCompraConfirmadaTikTok(d as any, String(v.paymentId), {
        value: Number(v.valor || 0) / 100,
        contentId: String(v.conteudo),
        contentName: v.titulo || "Compra",
        email: v.email,
        externalId: String(v.userId),
        eventTime: v.pagoEm ? Number(v.pagoEm) : undefined,
      });
      tentativas++;
    }
  }
  return tentativas;
}

/** O que está ligado no servidor. Só sim/não: nenhum valor de variável sai daqui. */
export function configuracaoDeRastreamento(env: NodeJS.ProcessEnv = process.env) {
  const tem = (n: string) => !!(env[n] || "").trim();
  const item = (nomes: string[], teste?: string) => ({
    ligado: nomes.every(tem),
    faltando: nomes.filter((n) => !tem(n)),
    modoTeste: teste && tem(teste) ? teste : null,
  });
  return {
    metaServidor: item(["META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"], "META_CAPI_TEST_EVENT_CODE"),
    ga4Servidor: item(["GA4_API_SECRET"]),
    tiktokServidor: item(["TIKTOK_PIXEL_ID", "TIKTOK_EVENTS_ACCESS_TOKEN"], "TIKTOK_EVENTS_TEST_CODE"),
    email: item(["RESEND_API_KEY"]),
    avisoDeVenda: item(["EMAIL_AVISOS_ADMIN"]),
  };
}

export type LinhaFunil = { source?: string | null; campaign?: string | null; paga: boolean; centavos: number };

/** Cobranças geradas, vendas pagas e receita por origem/campanha. */
export function montarFunil(entradas: LinhaFunil[]) {
  const mapa = new Map<string, { origem: string; campanha: string; cobrancas: number; pagas: number; receitaCentavos: number }>();
  const total = { cobrancas: 0, pagas: 0, receitaCentavos: 0 };
  for (const e of entradas) {
    const origem = (e.source || "").trim() || "Sem UTM (direto, orgânico ou link sem marcação)";
    const campanha = (e.campaign || "").trim();
    const chave = `${origem}\u0000${campanha}`;
    const g = mapa.get(chave) ?? { origem, campanha, cobrancas: 0, pagas: 0, receitaCentavos: 0 };
    for (const alvo of [g, total]) {
      alvo.cobrancas++;
      if (e.paga) {
        alvo.pagas++;
        alvo.receitaCentavos += e.centavos;
      }
    }
    mapa.set(chave, g);
  }
  const porOrigem = Array.from(mapa.values()).sort((a, b) => b.receitaCentavos - a.receitaCentavos || b.cobrancas - a.cobrancas);
  return { total, porOrigem };
}

export async function painelDeVendas(dias: number) {
  const { ensureTrialSchema } = await import("./trial");
  const { ensureGuestSchema } = await import("./trialGuest");
  const { garantirSchemaComercial } = await import("./programaVenda");
  const { garantirTabelaTikTok } = await import("./tiktokEvents");
  await ensureTrialSchema();
  await ensureGuestSchema();
  await garantirSchemaComercial();
  const d = await db.getDb();
  if (d) await garantirTabelaTikTok(d as any).catch(() => undefined);

  const desde = horas(dias * 24);
  // Compra sem conta paga já virou passe/compra: das tabelas de convidado entram só as não pagas.
  const brutas = await consulta(sql`
    SELECT "utmSource" AS source, "utmCampaign" AS campaign, ("paidAt" IS NOT NULL AND "status" NOT IN ('refunded','cancelled')) AS paga, "amountCents" AS centavos, NULL AS atribuicao
      FROM "trialPasses" WHERE "createdAt" > ${desde}
    UNION ALL
    SELECT "utmSource", "utmCampaign", false, "amountCents", NULL FROM "trialGuestCheckouts" WHERE "status" <> 'paid' AND "createdAt" > ${desde}
    UNION ALL
    SELECT "utmSource", "utmCampaign", ("paidAt" IS NOT NULL AND "status" = 'active'), "amountCents", NULL
      FROM "programaCompras" WHERE "origem" = 'asaas' AND "createdAt" > ${desde}
    UNION ALL
    SELECT NULL, NULL, false, "amountCents", "atribuicao" FROM "programaConvidados" WHERE "status" <> 'paid' AND "createdAt" > ${desde}
  `);
  const funil = montarFunil(brutas.map((b) => {
    let a: any = {};
    try { a = b.atribuicao ? JSON.parse(b.atribuicao) : {}; } catch { /* atribuição ilegível: conta sem origem */ }
    return { source: b.source ?? a.utmSource, campaign: b.campaign ?? a.utmCampaign, paga: b.paga === true, centavos: Number(b.centavos || 0) };
  }));

  const vendas = await consulta(sql`
    SELECT v.id AS cobranca, v.produto, v.centavos, v."paidAt" AS "pagoEm", v.meta, v.ga4, (t."sentAt" IS NOT NULL) AS tiktok, v.consentiu
      FROM (
        SELECT p."asaasPaymentId" AS id, COALESCE(l."title", 'Aula') AS produto, p."amountCents" AS centavos, p."paidAt",
               (p."capiPurchaseSentAt" IS NOT NULL) AS meta, (p."ga4PurchaseSentAt" IS NOT NULL) AS ga4,
               (p."fbp" IS NOT NULL OR p."fbc" IS NOT NULL OR p."ga4ClientId" IS NOT NULL) AS consentiu
          FROM "trialPasses" p LEFT JOIN "lessons" l ON l."id" = p."lessonId" WHERE p."status" = 'active' AND p."paidAt" > ${desde}
        UNION ALL
        SELECT pc."asaasPaymentId", COALESCE(c."title", 'Programa'), pc."amountCents", pc."paidAt",
               (pc."capiPurchaseSentAt" IS NOT NULL), (pc."ga4PurchaseSentAt" IS NOT NULL),
               (pc."fbp" IS NOT NULL OR pc."fbc" IS NOT NULL OR pc."ga4ClientId" IS NOT NULL)
          FROM "programaCompras" pc LEFT JOIN "contentCollections" c ON c."id" = pc."collectionId" WHERE pc."status" = 'active' AND pc."origem" = 'asaas' AND pc."paidAt" > ${desde}
      ) v LEFT JOIN "tiktokPurchases" t ON t."paymentId" = v.id
     ORDER BY v."paidAt" DESC LIMIT 50`);

  return {
    dias,
    ...funil,
    vendas: vendas.map((v) => ({
      cobranca: String(v.cobranca), produto: String(v.produto), centavos: Number(v.centavos || 0), pagoEm: v.pagoEm ? new Date(v.pagoEm) : null,
      meta: v.meta === true, ga4: v.ga4 === true, tiktok: v.tiktok === true, consentiu: v.consentiu === true,
    })),
  };
}

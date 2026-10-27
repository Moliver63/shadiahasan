/**
 * Compra no GA4 enviada pelo SERVIDOR (Measurement Protocol).
 *
 * Por quê (27/10/2026): o pagamento do teste de R$ 19,90 é confirmado pelo
 * Asaas, fora do site. O GA4 só via a compra se o comprador voltasse à tela
 * "aguardando pagamento" depois do Pix; quem pagava no app do banco e não
 * voltava ficava fora dos números.
 *
 * Consentimento (LGPD): só envia quando o navegador mandou o client_id do GA4
 * na hora da compra. Esse id vem do cookie `_ga`, que só existe se a pessoa
 * aceitou cookies de análise. Sem ele, nada é enviado. Sinais de anúncio vão
 * sempre como DENIED, igual ao site.
 *
 * Variáveis (Render):
 *   GA4_API_SECRET       chave secreta do Measurement Protocol (obrigatória)
 *   GA4_MEASUREMENT_ID   padrão G-DGCPN51SD6 (o mesmo do site)
 * Sem GA4_API_SECRET, não faz nada e o site continua mandando a compra pelo
 * navegador (trial.info → ga4CompraPeloServidor = false).
 */

const ID_PADRAO = "G-DGCPN51SD6";

export function ga4ServidorConfigurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!(env.GA4_API_SECRET || "").trim();
}

/** client_id do GA4 tem o formato "123456789.1730000000". Qualquer outra coisa é descartada. */
export function clientIdValido(v: unknown): v is string {
  return typeof v === "string" && /^\d{1,20}\.\d{1,20}$/.test(v);
}

export function sessionIdValido(v: unknown): v is string {
  return typeof v === "string" && /^\d{6,20}$/.test(v);
}

export type CompraGA4 = {
  clientId: string;
  sessionId?: string | null;
  /** id interno do aluno (nunca e-mail ou nome) */
  userId?: number | null;
  transactionId: string;
  valor: number;
  itemId: string;
  itemNome: string;
};

export function montarCorpo(c: CompraGA4) {
  return {
    client_id: c.clientId,
    ...(c.userId ? { user_id: String(c.userId) } : {}),
    consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: c.transactionId,
          currency: "BRL",
          value: c.valor,
          items: [{ item_id: c.itemId, item_name: c.itemNome, price: c.valor, quantity: 1 }],
          // Sem session_id e tempo de engajamento, o GA4 não liga a compra à
          // sessão de origem (e a venda aparece como "não atribuída").
          ...(c.sessionId ? { session_id: c.sessionId } : {}),
          engagement_time_msec: 1,
        },
      },
    ],
  };
}

/** Nunca lança: a aula já foi liberada quando isto roda; falhar aqui só perde a métrica. */
export async function enviarCompraGA4(
  c: CompraGA4,
  opts: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const env = opts.env ?? process.env;
  const segredo = (env.GA4_API_SECRET || "").trim();
  if (!segredo || !clientIdValido(c.clientId)) return false;
  const medicao = (env.GA4_MEASUREMENT_ID || ID_PADRAO).trim();
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(medicao)}&api_secret=${encodeURIComponent(segredo)}`;
  try {
    const r = await (opts.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(montarCorpo(c)),
    });
    // O endpoint de produção responde 2xx mesmo com evento malformado; erro aqui é rede ou chave.
    if (!r.ok) console.warn(`[GA4] compra ${c.transactionId} recusada: HTTP ${r.status}`);
    return r.ok;
  } catch (e) {
    console.warn(`[GA4] falha ao enviar compra ${c.transactionId}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

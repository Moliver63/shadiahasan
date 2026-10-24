/**
 * Sincronização do financeiro com os provedores (Asaas e Stripe).
 *
 * Pedido do Michel (24/10/2026): "verifique o painel financeiro para que
 * apareçam todas as transações feitas". O painel lê só `payment_history`, e
 * essa tabela só recebe o que os webhooks gravaram. Ficam de fora:
 *  - cobranças feitas antes de cada fluxo começar a gravar (o teste de 1 aula
 *    passou a registrar a cobrança pendente e a paga só no commit 1dfef5f);
 *  - webhooks que nunca chegaram (Render dormindo, token do webhook errado,
 *    o Stripe que não validava a assinatura até 23/10);
 *  - eventos que falharam ao vincular o usuário.
 *
 * Esta rotina lê a fonte da verdade (API do Asaas e do Stripe) e faz upsert
 * em `payment_history` pela mesma chave dos webhooks (`asaas:<id>` e o id da
 * fatura do Stripe), então nunca duplica o que o webhook já gravou e nunca
 * rebaixa um pagamento confirmado (regra de `upsertProviderPayment`).
 *
 * Só mexe no financeiro. NÃO libera nem revoga acesso: acesso continua sendo
 * decidido pelos webhooks. Sincronizar um pagamento antigo não pode reativar
 * plano de ninguém.
 */
import * as db from "./db";

export type StatusFinanceiro = "pending" | "completed" | "failed" | "refunded";

// ─── Asaas ──────────────────────────────────────────────────────────────────

export type CobrancaAsaas = {
  id: string;
  customer?: string;
  subscription?: string | null;
  value?: number;
  netValue?: number;
  billingType?: string;
  status?: string;
  externalReference?: string | null;
  dueDate?: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  dateCreated?: string;
  invoiceUrl?: string;
  description?: string | null;
  deleted?: boolean;
};

/** Status da cobrança no Asaas → status do financeiro. */
export function statusDoAsaas(status?: string): StatusFinanceiro {
  switch ((status || "").toUpperCase()) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
    case "DUNNING_RECEIVED":
      return "completed";
    case "REFUNDED":
    case "REFUND_IN_PROGRESS":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "refunded";
    default:
      // PENDING, OVERDUE, AWAITING_RISK_ANALYSIS, REFUND_REQUESTED (ainda não
      // estornado), DUNNING_REQUESTED: dinheiro não entrou ou ainda é dela.
      return "pending";
  }
}

export type ContaAsaas = { userId: number; asaasCustomerId: string; asaasSubscriptionId: string; planSlug: string };

export type VinculoAsaas = { userId: number; planSlug: string | null; tipo: "trial" | "assinatura" | "avulsa"; lessonId?: number };

/**
 * Descobre de quem é a cobrança. Mesma ordem que os webhooks usam:
 * referência externa gravada na criação; depois a assinatura; por fim o
 * cliente Asaas. Sem vínculo, devolve null e a cobrança é contada como
 * "sem usuário" no resultado (não dá para gravar: `userId` é obrigatório).
 */
export function vinculoDaCobrancaAsaas(c: CobrancaAsaas, contas: ContaAsaas[]): VinculoAsaas | null {
  const ref = c.externalReference || "";
  const trial = /^trial:(\d+):(\d+)/.exec(ref);
  if (trial) return { userId: Number(trial[1]), planSlug: "trial", tipo: "trial", lessonId: Number(trial[2]) };

  const userRef = /user:(\d+)/.exec(ref)?.[1];
  const planRef = /plan:(basic|premium|vip)/.exec(ref)?.[1] ?? null;
  if (userRef) return { userId: Number(userRef), planSlug: planRef, tipo: c.subscription ? "assinatura" : "avulsa" };

  if (c.subscription) {
    const conta = contas.find((a) => a.asaasSubscriptionId === c.subscription);
    if (conta) return { userId: conta.userId, planSlug: conta.planSlug, tipo: "assinatura" };
  }
  if (c.customer) {
    const conta = contas.find((a) => a.asaasCustomerId === c.customer);
    if (conta) return { userId: conta.userId, planSlug: c.subscription ? conta.planSlug : null, tipo: c.subscription ? "assinatura" : "avulsa" };
  }
  return null;
}

function nomePlano(slug: string | null): string {
  return slug === "basic" ? "Básico" : slug === "premium" ? "Premium" : slug === "vip" ? "VIP" : "assinatura";
}

/** Data do Asaas ("YYYY-MM-DD", horário de Brasília) → meio-dia em São Paulo, para não virar o dia anterior. */
function dataAsaas(d?: string | null): Date | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return null;
  return new Date(`${d.slice(0, 10)}T12:00:00-03:00`);
}

export function lancamentoDoAsaas(c: CobrancaAsaas, v: VinculoAsaas) {
  const status = statusDoAsaas(c.status);
  const centavos = Math.round(Number(c.value || 0) * 100);
  const descricao = v.tipo === "trial"
    ? `Teste de 1 aula (Asaas)${v.lessonId ? ` — aula ${v.lessonId}` : ""}`
    : v.tipo === "assinatura"
      ? `Assinatura ${nomePlano(v.planSlug)} (Asaas)`
      : (c.description?.trim() || "Cobrança avulsa (Asaas)");
  return {
    userId: v.userId,
    amount: centavos,
    currency: "BRL",
    status,
    paymentMethod: `asaas${c.billingType && c.billingType !== "UNDEFINED" ? `:${c.billingType.toLowerCase()}` : ""}`,
    stripeInvoiceId: `asaas:${c.id}`,
    providerStatus: c.status || null,
    paymentUrl: c.invoiceUrl || null,
    dueDate: c.dueDate || null,
    paidAt: status === "completed" || status === "refunded" ? dataAsaas(c.clientPaymentDate || c.paymentDate) : null,
    refundedAmount: status === "refunded" ? centavos : undefined,
    providerSubscriptionId: c.subscription || null,
    planSlug: v.planSlug,
    description: descricao,
    createdAt: dataAsaas(c.dateCreated) ?? undefined,
  };
}

// ─── Stripe ─────────────────────────────────────────────────────────────────

export type FaturaStripe = {
  id: string;
  status?: string | null; // draft | open | paid | uncollectible | void
  customer?: string | { id: string } | null;
  customer_email?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string | null;
  created?: number;
  due_date?: number | null;
  hosted_invoice_url?: string | null;
  status_transitions?: { paid_at?: number | null } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null; metadata?: Record<string, string> | null } | null } | null;
  lines?: { data?: Array<{ pricing?: { price_details?: { price?: string } }; price?: { id?: string } }> };
};

export function statusDaFaturaStripe(f: FaturaStripe): StatusFinanceiro | null {
  switch (f.status) {
    case "paid": return "completed";
    case "open": return "pending";
    case "uncollectible":
    case "void": return "failed";
    default: return null; // rascunho não é cobrança
  }
}

export type MapaUsuariosStripe = {
  porCliente: Map<string, number>;
  porAssinatura: Map<string, { userId: number; planSlug: string | null }>;
  porEmail: Map<string, number>;
};

export function vinculoDaFaturaStripe(f: FaturaStripe, mapa: MapaUsuariosStripe): { userId: number; planSlug: string | null } | null {
  const sub = f.parent?.subscription_details?.subscription;
  const subId = typeof sub === "string" ? sub : sub?.id ?? null;
  const meta = f.parent?.subscription_details?.metadata || {};
  const metaUser = Number(meta.user_id || 0);
  const metaPlan = meta.plan_slug || null;
  if (subId && mapa.porAssinatura.has(subId)) return mapa.porAssinatura.get(subId)!;
  if (metaUser > 0) return { userId: metaUser, planSlug: metaPlan };
  const cust = typeof f.customer === "string" ? f.customer : f.customer?.id ?? null;
  if (cust && mapa.porCliente.has(cust)) return { userId: mapa.porCliente.get(cust)!, planSlug: metaPlan };
  const email = f.customer_email?.trim().toLowerCase();
  if (email && mapa.porEmail.has(email)) return { userId: mapa.porEmail.get(email)!, planSlug: metaPlan };
  return null;
}

export function lancamentoDaFaturaStripe(f: FaturaStripe, v: { userId: number; planSlug: string | null }) {
  const status = statusDaFaturaStripe(f);
  if (!status) return null;
  const sub = f.parent?.subscription_details?.subscription;
  const subId = typeof sub === "string" ? sub : sub?.id ?? null;
  const pagoEm = f.status_transitions?.paid_at ? new Date(f.status_transitions.paid_at * 1000) : null;
  return {
    userId: v.userId,
    amount: Math.max(0, status === "completed" ? (f.amount_paid ?? 0) : (f.amount_due ?? 0)),
    currency: (f.currency || "brl").toUpperCase(),
    status,
    paymentMethod: "stripe",
    stripeInvoiceId: f.id,
    providerStatus: f.status || null,
    paymentUrl: f.hosted_invoice_url || null,
    dueDate: f.due_date ? new Date(f.due_date * 1000).toISOString().slice(0, 10) : null,
    paidAt: status === "completed" ? (pagoEm ?? (f.created ? new Date(f.created * 1000) : null)) : null,
    providerSubscriptionId: subId,
    planSlug: v.planSlug,
    description: `Assinatura ${nomePlano(v.planSlug)} — fatura ${f.id}`,
    createdAt: f.created ? new Date(f.created * 1000) : undefined,
  };
}

// ─── Execução ───────────────────────────────────────────────────────────────

export type ResultadoProvedor = {
  configurado: boolean;
  lidas: number;
  gravadas: number;
  semUsuario: number;
  ignoradas: number;
  erro?: string;
  exemplosSemUsuario?: string[];
};

export type ResultadoSincronizacao = { asaas: ResultadoProvedor; stripe: ResultadoProvedor; terminouEm: string };

type Deps = {
  listarCobrancasAsaas?: (offset: number) => Promise<{ data: CobrancaAsaas[]; hasMore: boolean }>;
  contasAsaas?: () => Promise<ContaAsaas[]>;
  listarFaturasStripe?: (startingAfter?: string) => Promise<{ data: FaturaStripe[]; has_more: boolean }>;
  mapaStripe?: () => Promise<MapaUsuariosStripe>;
  gravar?: (linha: any) => Promise<unknown>;
  asaasConfigurado?: boolean;
  stripeConfigurado?: boolean;
};

const LIMITE_PAGINAS = 100; // 100 x 100 = 10 mil cobranças por provedor, por execução

async function depsPadrao(): Promise<Required<Deps>> {
  const asaas = await import("./asaas");
  const stripeMod = await import("./stripe");
  const { asaasAccounts, users, subscriptions } = await import("../drizzle/schema");
  return {
    asaasConfigurado: asaas.isAsaasConfigured(),
    stripeConfigurado: stripeMod.isStripeConfigured() && !!stripeMod.stripe,
    listarCobrancasAsaas: (offset) => asaas.asaasRequest("GET", `/payments?offset=${offset}&limit=100`),
    contasAsaas: async () => {
      await asaas.ensureAsaasSchema();
      const d = await db.getDb();
      if (!d) return [];
      return d.select({ userId: asaasAccounts.userId, asaasCustomerId: asaasAccounts.asaasCustomerId, asaasSubscriptionId: asaasAccounts.asaasSubscriptionId, planSlug: asaasAccounts.planSlug }).from(asaasAccounts);
    },
    listarFaturasStripe: async (startingAfter) => {
      const r = await stripeMod.stripe!.invoices.list({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
      return { data: r.data as unknown as FaturaStripe[], has_more: r.has_more };
    },
    mapaStripe: async () => {
      const d = await db.getDb();
      const mapa: MapaUsuariosStripe = { porCliente: new Map(), porAssinatura: new Map(), porEmail: new Map() };
      if (!d) return mapa;
      for (const u of await d.select({ id: users.id, email: users.email, stripeCustomerId: users.stripeCustomerId }).from(users)) {
        if (u.stripeCustomerId) mapa.porCliente.set(u.stripeCustomerId, u.id);
        if (u.email) mapa.porEmail.set(u.email.trim().toLowerCase(), u.id);
      }
      for (const s of await d.select({ userId: subscriptions.userId, plan: subscriptions.plan, stripeCustomerId: subscriptions.stripeCustomerId, stripeSubscriptionId: subscriptions.stripeSubscriptionId }).from(subscriptions)) {
        if (s.stripeCustomerId && !mapa.porCliente.has(s.stripeCustomerId)) mapa.porCliente.set(s.stripeCustomerId, s.userId);
        if (s.stripeSubscriptionId) mapa.porAssinatura.set(s.stripeSubscriptionId, { userId: s.userId, planSlug: s.plan || null });
      }
      return mapa;
    },
    gravar: (linha) => db.upsertProviderPayment(linha),
  };
}

function vazio(configurado: boolean): ResultadoProvedor {
  return { configurado, lidas: 0, gravadas: 0, semUsuario: 0, ignoradas: 0 };
}

export async function sincronizarFinanceiro(injetado: Deps = {}): Promise<ResultadoSincronizacao> {
  const deps = { ...(await (injetado.gravar ? Promise.resolve({} as Required<Deps>) : depsPadrao())), ...injetado } as Required<Deps>;

  // ── Asaas
  const asaas = vazio(!!deps.asaasConfigurado);
  if (asaas.configurado) {
    try {
      const contas = await deps.contasAsaas();
      for (let pagina = 0, offset = 0; pagina < LIMITE_PAGINAS; pagina++) {
        const r = await deps.listarCobrancasAsaas(offset);
        for (const c of r.data || []) {
          asaas.lidas++;
          if (!c?.id || c.deleted) { asaas.ignoradas++; continue; }
          const v = vinculoDaCobrancaAsaas(c, contas);
          if (!v) {
            asaas.semUsuario++;
            if ((asaas.exemplosSemUsuario ??= []).length < 5) asaas.exemplosSemUsuario.push(`${c.id} (${c.status || "?"}, R$ ${Number(c.value || 0).toFixed(2)})`);
            continue;
          }
          await deps.gravar(lancamentoDoAsaas(c, v));
          asaas.gravadas++;
        }
        if (!r.hasMore || !(r.data || []).length) break;
        offset += (r.data || []).length;
      }
    } catch (e) {
      asaas.erro = e instanceof Error ? e.message.slice(0, 300) : String(e);
    }
  }

  // ── Stripe
  const stripe = vazio(!!deps.stripeConfigurado);
  if (stripe.configurado) {
    try {
      const mapa = await deps.mapaStripe();
      let depois: string | undefined;
      for (let pagina = 0; pagina < LIMITE_PAGINAS; pagina++) {
        const r = await deps.listarFaturasStripe(depois);
        for (const f of r.data || []) {
          stripe.lidas++;
          const v = vinculoDaFaturaStripe(f, mapa);
          if (!v) {
            stripe.semUsuario++;
            if ((stripe.exemplosSemUsuario ??= []).length < 5) stripe.exemplosSemUsuario.push(`${f.id} (${f.status || "?"}${f.customer_email ? `, ${f.customer_email}` : ""})`);
            continue;
          }
          const linha = lancamentoDaFaturaStripe(f, v);
          if (!linha) { stripe.ignoradas++; continue; }
          await deps.gravar(linha);
          stripe.gravadas++;
        }
        if (!r.has_more || !(r.data || []).length) break;
        depois = r.data[r.data.length - 1].id;
      }
    } catch (e) {
      stripe.erro = e instanceof Error ? e.message.slice(0, 300) : String(e);
    }
  }

  return { asaas, stripe, terminouEm: new Date().toISOString() };
}

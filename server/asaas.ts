/**
 * asaas.ts — Integração com o Asaas (PIX, boleto e cartão)
 * Localização: server/asaas.ts
 *
 * Variáveis de ambiente (Render):
 *   ASAAS_API_KEY        chave de API (NUNCA no código nem no front)
 *   ASAAS_WEBHOOK_TOKEN  token enviado pelo Asaas no header `asaas-access-token`
 *   ASAAS_BASE_URL       https://api.asaas.com/v3  (sandbox: https://api-sandbox.asaas.com/v3)
 *
 * Fluxo:
 *   1. checkout  → cria cliente + assinatura mensal no Asaas (cliente escolhe PIX/boleto/cartão
 *                  na página de fatura do Asaas) e devolve o link da primeira cobrança.
 *   2. webhook   → PAYMENT_CONFIRMED/RECEIVED libera o plano; OVERDUE pausa; REFUNDED,
 *                  CHARGEBACK e SUBSCRIPTION_DELETED/INACTIVATED revogam.
 *
 * O acesso só é liberado pelo webhook — nunca pelo retorno do checkout.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as db from "./db";
import { asaasAccounts, asaasWebhookEvents, paymentHistory, subscriptionPlans } from "../drizzle/schema";
import { getPlanDisplayName, type PlanSlug } from "../shared/stripe-config";
import { isValidCpfCnpj, onlyDigits } from "../shared/br-document";

// ─── Configuração ────────────────────────────────────────────────────────────

const DEFAULT_PRICES_CENTS: Record<PlanSlug, number> = {
  basic: 4990,
  premium: 9990,
  vip: 29990,
};

export function getAsaasBaseUrl(): string {
  return (process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3").replace(/\/+$/, "");
}

export function isAsaasConfigured(): boolean {
  const key = process.env.ASAAS_API_KEY || "";
  return key !== "" && !key.includes("SUBSTITUA");
}

export function getAsaasWebhookToken(): string {
  return process.env.ASAAS_WEBHOOK_TOKEN || "";
}

// ─── Cliente HTTP ────────────────────────────────────────────────────────────

export class AsaasError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = "AsaasError";
  }
}

async function asaasRequest<T = any>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!isAsaasConfigured()) {
    throw new AsaasError("Asaas não está configurado (ASAAS_API_KEY ausente).", 412);
  }

  const res = await fetch(`${getAsaasBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY as string,
      // O Asaas exige User-Agent nas contas novas
      "User-Agent": "shadiahasan-lms",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* resposta não-JSON */ }

  if (!res.ok) {
    const desc = json?.errors?.[0]?.description || json?.message || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new AsaasError(desc, res.status, json);
  }
  return json as T;
}

// ─── Schema sob demanda (mesmo padrão dos routers de grupos/programas) ──────

let schemaReady: Promise<boolean> | null = null;

export function ensureAsaasSchema(): Promise<boolean> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "asaasAccounts" (
            "id" serial PRIMARY KEY,
            "userId" integer NOT NULL,
            "asaasCustomerId" varchar(64) NOT NULL,
            "asaasSubscriptionId" varchar(64) NOT NULL UNIQUE,
            "planSlug" varchar(32) NOT NULL,
            "status" varchar(16) NOT NULL DEFAULT 'pending',
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "asaasWebhookEvents" (
            "eventId" varchar(100) PRIMARY KEY,
            "event" varchar(64) NOT NULL,
            "paymentId" varchar(64),
            "subscriptionId" varchar(64),
            "status" varchar(16) NOT NULL DEFAULT 'processing',
            "error" text,
            "payload" text NOT NULL,
            "receivedAt" timestamp NOT NULL DEFAULT now(),
            "processedAt" timestamp
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "asaasAccounts_user_idx" ON "asaasAccounts" ("userId")`);
        return true;
      } catch (e) {
        console.error("[Asaas] schema init failed:", e instanceof Error ? e.message : e);
        schemaReady = null; // tenta de novo na próxima chamada
        return false;
      }
    })();
  }
  return schemaReady;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

function todayInSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
}

async function getPlanPriceCents(planSlug: PlanSlug): Promise<number> {
  try {
    const d = await db.getDb();
    if (d) {
      const [plan] = await d.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, planSlug)).limit(1);
      // price é guardado em centavos; valores fora da faixa são ignorados por segurança
      if (plan && plan.price >= 500 && plan.price <= 1_000_000) return plan.price;
      if (plan) console.warn(`[Asaas] preço do plano ${planSlug} fora da faixa (${plan.price}); usando padrão`);
    }
  } catch (e) {
    console.warn("[Asaas] falha ao ler preço do plano:", e instanceof Error ? e.message : e);
  }
  return DEFAULT_PRICES_CENTS[planSlug];
}

async function firstPaymentLink(asaasSubscriptionId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const list = await asaasRequest<{ data?: Array<{ invoiceUrl?: string; status?: string }> }>(
      "GET",
      `/subscriptions/${encodeURIComponent(asaasSubscriptionId)}/payments`,
    );
    const open = (list.data || []).find((p) => p.invoiceUrl && p.status === "PENDING") || (list.data || [])[0];
    if (open?.invoiceUrl) return open.invoiceUrl;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function createAsaasCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string | null;
  planSlug: PlanSlug;
  cpfCnpj: string;
  origin: string;
}): Promise<{ url: string; asaasSubscriptionId: string }> {
  if (!isAsaasConfigured()) throw new AsaasError("Asaas não está configurado.", 412);
  if (!(await ensureAsaasSchema())) throw new AsaasError("Banco indisponível para o Asaas.", 503);
  if (!isValidCpfCnpj(params.cpfCnpj)) throw new AsaasError("CPF/CNPJ inválido.", 400);

  const d = await db.getDb();
  if (!d) throw new AsaasError("Banco indisponível.", 503);

  // Evita assinaturas duplicadas: reaproveita uma pendente (mesmo plano) das últimas 24h
  const [pending] = await d
    .select()
    .from(asaasAccounts)
    .where(and(
      eq(asaasAccounts.userId, params.userId),
      eq(asaasAccounts.planSlug, params.planSlug),
      eq(asaasAccounts.status, "pending"),
      sql`${asaasAccounts.createdAt} > now() - interval '24 hours'`,
    ))
    .orderBy(desc(asaasAccounts.createdAt))
    .limit(1);

  if (pending) {
    const link = await firstPaymentLink(pending.asaasSubscriptionId);
    if (link) return { url: link, asaasSubscriptionId: pending.asaasSubscriptionId };
  }

  // Cliente: reaproveita o existente do usuário
  const [prev] = await d
    .select()
    .from(asaasAccounts)
    .where(eq(asaasAccounts.userId, params.userId))
    .orderBy(desc(asaasAccounts.createdAt))
    .limit(1);

  let customerId = prev?.asaasCustomerId;
  if (!customerId) {
    const customer = await asaasRequest<{ id: string }>("POST", "/customers", {
      name: params.userName?.trim() || params.userEmail.split("@")[0],
      email: params.userEmail,
      cpfCnpj: onlyDigits(params.cpfCnpj),
      externalReference: `user:${params.userId}`,
    });
    customerId = customer.id;
  }

  const valueCents = await getPlanPriceCents(params.planSlug);
  const subscriptionBody: Record<string, unknown> = {
    customer: customerId,
    billingType: "UNDEFINED", // o cliente escolhe PIX, boleto ou cartão na fatura
    value: Number((valueCents / 100).toFixed(2)),
    nextDueDate: todayInSaoPaulo(),
    cycle: "MONTHLY",
    description: `Assinatura ${getPlanDisplayName(params.planSlug)} — Shadia Hasan`,
    // Vincula a cobrança ao aluno: o webhook usa isso se não achar a assinatura
    externalReference: `user:${params.userId}|plan:${params.planSlug}`,
  };

  let subscription: { id: string };
  try {
    subscription = await asaasRequest<{ id: string }>("POST", "/subscriptions", {
      ...subscriptionBody,
      callback: { successUrl: `${params.origin}/checkout/success?provider=asaas`, autoRedirect: false },
    });
  } catch (e) {
    // successUrl precisa ser de um domínio cadastrado no Asaas; sem isso, cria sem redirecionamento
    if (e instanceof AsaasError && e.status === 400 && /callback|successUrl|dom[ií]nio/i.test(e.message)) {
      console.warn("[Asaas] successUrl recusada; criando assinatura sem callback:", e.message);
      subscription = await asaasRequest<{ id: string }>("POST", "/subscriptions", subscriptionBody);
    } else {
      throw e;
    }
  }

  await d.insert(asaasAccounts).values({
    userId: params.userId,
    asaasCustomerId: customerId,
    asaasSubscriptionId: subscription.id,
    planSlug: params.planSlug,
    status: "pending",
  });

  const url = await firstPaymentLink(subscription.id);
  if (!url) throw new AsaasError("Cobrança criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.", 502);

  console.log(`[Asaas] checkout criado: sub ${subscription.id} user ${params.userId} plano ${params.planSlug}`);
  return { url, asaasSubscriptionId: subscription.id };
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    customer?: string;
    subscription?: string | null;
    value?: number;
    billingType?: string;
    externalReference?: string | null;
    dueDate?: string;
  };
  subscription?: {
    id?: string;
    customer?: string;
    externalReference?: string | null;
  };
};

/** Registra o evento (idempotência). Retorna false se já foi recebido antes. */
export async function recordAsaasEvent(body: AsaasWebhookBody): Promise<boolean> {
  if (!(await ensureAsaasSchema())) throw new Error("schema Asaas indisponível");
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  const inserted = await d
    .insert(asaasWebhookEvents)
    .values({
      eventId: String(body.id),
      event: String(body.event),
      paymentId: body.payment?.id ?? null,
      subscriptionId: body.payment?.subscription ?? body.subscription?.id ?? null,
      payload: JSON.stringify(body),
    })
    .onConflictDoNothing()
    .returning({ eventId: asaasWebhookEvents.eventId });

  return inserted.length > 0;
}

function parseExternalReference(ref?: string | null): { userId?: number; planSlug?: PlanSlug } {
  if (!ref) return {};
  const user = /user:(\d+)/.exec(ref)?.[1];
  const plan = /plan:(basic|premium|vip)/.exec(ref)?.[1] as PlanSlug | undefined;
  return { userId: user ? Number(user) : undefined, planSlug: plan };
}

async function resolveAccount(body: AsaasWebhookBody) {
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  const subId = body.payment?.subscription ?? body.subscription?.id ?? null;
  if (subId) {
    const [acc] = await d.select().from(asaasAccounts).where(eq(asaasAccounts.asaasSubscriptionId, subId)).limit(1);
    if (acc) return acc;
  }

  // Fallback: externalReference gravado na criação
  const ref = parseExternalReference(body.payment?.externalReference ?? body.subscription?.externalReference);
  const customer = body.payment?.customer ?? body.subscription?.customer;
  if (subId && customer && ref.userId && ref.planSlug) {
    const [created] = await d
      .insert(asaasAccounts)
      .values({ userId: ref.userId, asaasCustomerId: customer, asaasSubscriptionId: subId, planSlug: ref.planSlug, status: "pending" })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [acc] = await d.select().from(asaasAccounts).where(eq(asaasAccounts.asaasSubscriptionId, subId)).limit(1);
    return acc;
  }
  return undefined;
}

function paymentKey(paymentId: string) {
  return `asaas:${paymentId}`;
}

async function activate(account: typeof asaasAccounts.$inferSelect, body: AsaasWebhookBody) {
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");
  const payment = body.payment!;
  const firstActivation = account.status !== "active";
  const planSlug = account.planSlug as PlanSlug;

  await db.upsertSubscription({
    userId: account.userId,
    plan: planSlug,
    status: "active",
    autoRenew: 1,
    endDate: null,
    notes: "Assinatura via Asaas",
  });

  await d.update(asaasAccounts).set({ status: "active", updatedAt: new Date() }).where(eq(asaasAccounts.id, account.id));

  // Um registro por cobrança (CONFIRMED e RECEIVED chegam para a mesma cobrança no cartão)
  if (payment.id) {
    const key = paymentKey(payment.id);
    const [exists] = await d
      .select({ id: paymentHistory.id })
      .from(paymentHistory)
      .where(eq(paymentHistory.stripeInvoiceId, key))
      .limit(1);
    if (!exists) {
      await db.createPaymentRecord({
        userId: account.userId,
        amount: Math.round(Number(payment.value || 0) * 100), // centavos, como no restante do financeiro
        currency: "BRL",
        status: "completed",
        paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
        stripeInvoiceId: key, // coluna reaproveitada como chave de idempotência
        description: `Assinatura ${getPlanDisplayName(planSlug)} (Asaas)`,
      });
    }
  }

  if (firstActivation) {
    try {
      const { processReferralOnSubscription } = await import("./routes/stripe-webhook");
      await processReferralOnSubscription(account.userId, getPlanDisplayName(planSlug));
    } catch (e) {
      console.error("[Asaas] erro ao processar indicação:", e instanceof Error ? e.message : e);
    }
  }
}

async function setAccountState(
  account: typeof asaasAccounts.$inferSelect,
  state: { subStatus: "paused" | "cancelled"; plan?: "free"; accountStatus?: string },
) {
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  const current = await db.getSubscriptionByUserId(account.userId);
  // Não derruba um plano gerenciado pelo Stripe
  const stripeManaged = !!current?.stripeSubscriptionId;
  if (!stripeManaged) {
    await db.upsertSubscription({
      userId: account.userId,
      plan: state.plan ?? (current?.plan ?? account.planSlug),
      status: state.subStatus,
      autoRenew: 0,
      endDate: null,
      notes: "Assinatura via Asaas",
    });
  }
  if (state.accountStatus) {
    await d.update(asaasAccounts).set({ status: state.accountStatus, updatedAt: new Date() }).where(eq(asaasAccounts.id, account.id));
  }
}

export async function processAsaasEvent(body: AsaasWebhookBody): Promise<void> {
  const event = String(body.event);
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  try {
    const account = await resolveAccount(body);

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        if (!account) { console.log(`[Asaas] ${event} sem assinatura vinculada — ignorado`); break; }
        await activate(account, body);
        break;
      }

      case "PAYMENT_OVERDUE": {
        // Sem agendador, a "carência" é o próprio intervalo até o Asaas marcar a cobrança como vencida.
        if (account) await setAccountState(account, { subStatus: "paused" });
        break;
      }

      case "PAYMENT_REFUNDED": {
        if (body.payment?.id) {
          await d
            .update(paymentHistory)
            .set({ status: "refunded" })
            .where(eq(paymentHistory.stripeInvoiceId, paymentKey(body.payment.id)));
        }
        if (account) await setAccountState(account, { subStatus: "cancelled", plan: "free", accountStatus: "cancelled" });
        break;
      }

      case "PAYMENT_CHARGEBACK_REQUESTED":
      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVATED": {
        if (account) await setAccountState(account, { subStatus: "cancelled", plan: "free", accountStatus: "cancelled" });
        break;
      }

      // Cobrança avulsa removida não cancela a assinatura; criação/atualização não mudam acesso
      case "PAYMENT_DELETED":
      case "SUBSCRIPTION_CREATED":
      case "SUBSCRIPTION_UPDATED":
      default:
        console.log(`[Asaas] evento sem ação de acesso: ${event}`);
    }

    await d
      .update(asaasWebhookEvents)
      .set({ status: "done", processedAt: new Date(), error: null })
      .where(eq(asaasWebhookEvents.eventId, String(body.id)));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[Asaas] erro ao processar ${event} (${body.id}):`, message);
    await d
      .update(asaasWebhookEvents)
      .set({ status: "error", error: message.slice(0, 500), processedAt: new Date() })
      .where(eq(asaasWebhookEvents.eventId, String(body.id)))
      .catch(() => undefined);
  }
}

/**
 * Reprocessa eventos que ficaram travados (servidor reiniciou no meio) ou com erro.
 * Roda uma vez na subida do servidor; nunca derruba o processo.
 */
export async function recoverAsaasEvents(): Promise<number> {
  try {
    if (!isAsaasConfigured() && !getAsaasWebhookToken()) return 0;
    if (!(await ensureAsaasSchema())) return 0;
    const d = await db.getDb();
    if (!d) return 0;
    const stuck = await d
      .select()
      .from(asaasWebhookEvents)
      .where(and(
        inArray(asaasWebhookEvents.status, ["processing", "error"]),
        sql`${asaasWebhookEvents.receivedAt} < now() - interval '1 minute'`,
        sql`${asaasWebhookEvents.receivedAt} > now() - interval '7 days'`,
      ))
      .orderBy(asaasWebhookEvents.receivedAt)
      .limit(50);
    for (const row of stuck) {
      try { await processAsaasEvent(JSON.parse(row.payload)); } catch { /* segue */ }
    }
    if (stuck.length) console.log(`[Asaas] ${stuck.length} evento(s) reprocessado(s)`);
    return stuck.length;
  } catch (e) {
    console.warn("[Asaas] recuperação de eventos falhou:", e instanceof Error ? e.message : e);
    return 0;
  }
}

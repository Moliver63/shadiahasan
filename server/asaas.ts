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
import { asaasAccounts, asaasWebhookEvents, paymentHistory, subscriptionPlans, subscriptions, trialPasses, users } from "../drizzle/schema";
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

export async function asaasRequest<T = any>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
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
        await d.execute(sql`ALTER TABLE "asaasAccounts" ADD COLUMN IF NOT EXISTS "overdueSince" timestamp`);
        await d.execute(sql`ALTER TABLE "asaasAccounts" ADD COLUMN IF NOT EXISTS "remindersSent" integer NOT NULL DEFAULT 0`);
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

export function todayInSaoPaulo(): string {
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

async function firstPaymentDetails(asaasSubscriptionId: string): Promise<{
  id?: string; invoiceUrl?: string; status?: string; dueDate?: string; value?: number; billingType?: string;
} | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const list = await asaasRequest<{ data?: Array<{ id?: string; invoiceUrl?: string; status?: string; dueDate?: string; value?: number; billingType?: string }> }>(
      "GET",
      `/subscriptions/${encodeURIComponent(asaasSubscriptionId)}/payments`,
    );
    const open = (list.data || []).find((p) => p.invoiceUrl && p.status === "PENDING") || (list.data || [])[0];
    if (open?.invoiceUrl) return open;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

export async function firstPaymentLink(asaasSubscriptionId: string): Promise<string | null> {
  return (await firstPaymentDetails(asaasSubscriptionId))?.invoiceUrl ?? null;
}

export async function createAsaasCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string | null;
  planSlug: PlanSlug;
  cpfCnpj: string;
  origin: string;
  /** CREDIT_CARD força cartão (renovação automática); UNDEFINED deixa o aluno escolher na fatura. */
  billingType?: "UNDEFINED" | "CREDIT_CARD";
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
    const payment = await firstPaymentDetails(pending.asaasSubscriptionId);
    if (payment?.invoiceUrl) {
      if (payment.id) await db.upsertProviderPayment({
        userId: params.userId,
        amount: Math.round(Number(payment.value ?? 0) * 100),
        currency: "BRL",
        status: "pending",
        paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
        stripeInvoiceId: paymentKey(payment.id),
        providerStatus: payment.status || "PENDING",
        paymentUrl: payment.invoiceUrl,
        dueDate: payment.dueDate || null,
        providerSubscriptionId: pending.asaasSubscriptionId,
        planSlug: pending.planSlug,
        description: `Assinatura ${getPlanDisplayName(pending.planSlug as PlanSlug)} (Asaas)`,
      }).catch((error) => console.error("[Asaas] não foi possível registrar a cobrança pendente:", error));
      return { url: payment.invoiceUrl, asaasSubscriptionId: pending.asaasSubscriptionId };
    }
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
    billingType: params.billingType ?? "UNDEFINED", // padrão: o cliente escolhe PIX, boleto ou cartão na fatura
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

  const firstPayment = await firstPaymentDetails(subscription.id);
  if (!firstPayment?.invoiceUrl) throw new AsaasError("Cobrança criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.", 502);
  if (firstPayment.id) await db.upsertProviderPayment({
    userId: params.userId,
    amount: Math.round(Number(firstPayment.value ?? valueCents / 100) * 100),
    currency: "BRL",
    status: "pending",
    paymentMethod: `asaas${firstPayment.billingType ? `:${firstPayment.billingType.toLowerCase()}` : ""}`,
    stripeInvoiceId: paymentKey(firstPayment.id),
    providerStatus: firstPayment.status || "PENDING",
    paymentUrl: firstPayment.invoiceUrl,
    dueDate: firstPayment.dueDate || null,
    providerSubscriptionId: subscription.id,
    planSlug: params.planSlug,
    description: `Assinatura ${getPlanDisplayName(params.planSlug)} (Asaas)`,
  }).catch((error) => console.error("[Asaas] não foi possível registrar a cobrança pendente:", error));

  console.log(`[Asaas] checkout criado: sub ${subscription.id} user ${params.userId} plano ${params.planSlug}`);
  return { url: firstPayment.invoiceUrl, asaasSubscriptionId: subscription.id };
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
    status?: string;
    externalReference?: string | null;
    dueDate?: string;
    invoiceUrl?: string;
    paymentDate?: string | null;
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
  // Só a primeira ativação conta para indicação; voltar de uma pausa por atraso não
  const firstActivation = account.status === "pending";
  const planSlug = account.planSlug as PlanSlug;

  await db.upsertSubscription({
    userId: account.userId,
    plan: planSlug,
    status: "active",
    autoRenew: 1,
    endDate: null,
    notes: "Assinatura via Asaas",
  });

  await d
    .update(asaasAccounts)
    .set({ status: "active", overdueSince: null, updatedAt: new Date() })
    .where(eq(asaasAccounts.id, account.id));

  // Um registro por cobrança; CONFIRMED/RECEIVED atualizam o mesmo lançamento pendente.
  if (payment.id) {
    await db.upsertProviderPayment({
      userId: account.userId,
      amount: Math.round(Number(payment.value || 0) * 100),
      currency: "BRL",
      status: "completed",
      paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
      stripeInvoiceId: paymentKey(payment.id),
      providerStatus: payment.status || body.event || "PAYMENT_RECEIVED",
      paymentUrl: payment.invoiceUrl,
      dueDate: payment.dueDate || null,
      paidAt: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
      providerSubscriptionId: account.asaasSubscriptionId,
      planSlug,
      description: `Assinatura ${getPlanDisplayName(planSlug)} (Asaas)`,
    });
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
  state: { subStatus: "paused" | "cancelled"; plan?: "free"; accountStatus?: string; respectEndDate?: boolean },
) {
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  const current = await db.getSubscriptionByUserId(account.userId);
  // Aluno que cancelou a própria assinatura mantém o acesso até o fim do período já pago:
  // o aviso de assinatura removida do Asaas não pode derrubar isso na hora.
  if (state.respectEndDate && account.status === "cancelled" && current?.endDate && current.status === "active") {
    const [{ future }] = (await d.execute(sql`select ("endDate" > now()) as future from subscriptions where id = ${current.id}`)).rows as Array<{ future: boolean }>;
    if (future) return;
  }
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
    // Pagamento avulso do teste de 1 aula (externalReference "trial:..."): não passa pela assinatura
    const { isTrialEvent, processTrialEvent } = await import("./trial");
    if (isTrialEvent(body)) {
      await processTrialEvent(body);
      await d
        .update(asaasWebhookEvents)
        .set({ status: "done", processedAt: new Date(), error: null })
        .where(eq(asaasWebhookEvents.eventId, String(body.id)));
      return;
    }

    const account = await resolveAccount(body);

    switch (event) {
      case "PAYMENT_CREATED":
      case "PAYMENT_UPDATED": {
        const payment = body.payment;
        if (account && payment?.id) {
          const cents = Math.round(Number(payment.value || 0) * 100);
          await db.upsertProviderPayment({
            userId: account.userId,
            amount: cents,
            currency: "BRL",
            status: "pending",
            paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
            stripeInvoiceId: paymentKey(payment.id),
            providerStatus: payment.status || event,
            paymentUrl: payment.invoiceUrl,
            dueDate: payment.dueDate || null,
            providerSubscriptionId: account.asaasSubscriptionId,
            planSlug: account.planSlug,
            description: `Assinatura ${getPlanDisplayName(account.planSlug as PlanSlug)} (Asaas)`,
          });
        }
        break;
      }

      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        if (!account) { console.log(`[Asaas] ${event} sem assinatura vinculada — ignorado`); break; }
        await activate(account, body);
        break;
      }

      case "PAYMENT_OVERDUE": {
        // Carência: só registra o início do atraso. A rotina periódica (runBillingMaintenance)
        // pausa o acesso se o pagamento não chegar em ASAAS_GRACE_DAYS dias.
        if (account && account.status === "active") {
          await d
            .update(asaasAccounts)
            .set({ overdueSince: sql`coalesce(${asaasAccounts.overdueSince}, now())`, updatedAt: new Date() })
            .where(eq(asaasAccounts.id, account.id));
        }
        if (account && body.payment?.id) {
          const payment = body.payment;
          await db.upsertProviderPayment({
            userId: account.userId,
            amount: Math.round(Number(payment.value || 0) * 100),
            currency: "BRL",
            status: "pending",
            paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
            stripeInvoiceId: paymentKey(payment.id),
            providerStatus: payment.status || "PAYMENT_OVERDUE",
            paymentUrl: payment.invoiceUrl,
            dueDate: payment.dueDate || null,
            providerSubscriptionId: account.asaasSubscriptionId,
            planSlug: account.planSlug,
            description: `Assinatura ${getPlanDisplayName(account.planSlug as PlanSlug)} (Asaas) — em atraso`,
          });
        }
        break;
      }

      case "PAYMENT_REFUNDED": {
        if (body.payment?.id && account) {
          const payment = body.payment;
          const cents = Math.round(Number(payment.value || 0) * 100);
          await db.upsertProviderPayment({
            userId: account.userId,
            amount: cents,
            refundedAmount: cents,
            currency: "BRL",
            status: "refunded",
            paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
            stripeInvoiceId: paymentKey(payment.id),
            providerStatus: "PAYMENT_REFUNDED",
            providerSubscriptionId: account.asaasSubscriptionId,
            planSlug: account.planSlug,
            description: `Assinatura ${getPlanDisplayName(account.planSlug as PlanSlug)} (Asaas) — estornada`,
          });
        } else if (body.payment?.id) {
          await d.update(paymentHistory).set({ status: "refunded", providerStatus: "PAYMENT_REFUNDED" })
            .where(eq(paymentHistory.stripeInvoiceId, paymentKey(body.payment.id)));
        }
        if (account) await setAccountState(account, { subStatus: "cancelled", plan: "free", accountStatus: "cancelled" });
        break;
      }

      case "PAYMENT_CHARGEBACK_REQUESTED": {
        if (body.payment?.id && account) {
          const payment = body.payment;
          const cents = Math.round(Number(payment.value || 0) * 100);
          await db.upsertProviderPayment({
            userId: account.userId,
            amount: cents,
            refundedAmount: cents,
            currency: "BRL",
            status: "refunded",
            paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
            stripeInvoiceId: paymentKey(payment.id),
            providerStatus: "PAYMENT_CHARGEBACK_REQUESTED",
            providerSubscriptionId: account.asaasSubscriptionId,
            planSlug: account.planSlug,
            description: `Assinatura ${getPlanDisplayName(account.planSlug as PlanSlug)} (Asaas) — contestada`,
          });
        }
        if (account) await setAccountState(account, { subStatus: "cancelled", plan: "free", accountStatus: "cancelled" });
        break;
      }

      case "PAYMENT_DELETED": {
        if (body.payment?.id && account) {
          const payment = body.payment;
          await db.upsertProviderPayment({
            userId: account.userId,
            amount: Math.round(Number(payment.value || 0) * 100),
            currency: "BRL",
            status: "failed",
            paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
            stripeInvoiceId: paymentKey(payment.id),
            providerStatus: "PAYMENT_DELETED",
            providerSubscriptionId: account.asaasSubscriptionId,
            planSlug: account.planSlug,
            description: `Assinatura ${getPlanDisplayName(account.planSlug as PlanSlug)} (Asaas) — cobrança removida`,
          });
        }
        break;
      }

      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVATED": {
        if (account) await setAccountState(account, { subStatus: "cancelled", plan: "free", accountStatus: "cancelled", respectEndDate: true });
        break;
      }

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


// ─── Rotina periódica: carência, fim do período cancelado e lembretes ───────

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Dias de carência depois do vencimento antes de pausar o acesso (padrão 3). */
export function getGraceDays(): number {
  return intFromEnv("ASAAS_GRACE_DAYS", 3, 0, 30);
}

/** Pausa quem passou da carência sem pagar. Quem paga depois volta sozinho pelo webhook. */
export async function pauseOverdueAccounts(): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const days = getGraceDays();
  const due = await d
    .select()
    .from(asaasAccounts)
    .where(and(
      eq(asaasAccounts.status, "active"),
      sql`${asaasAccounts.overdueSince} IS NOT NULL`,
      sql`${asaasAccounts.overdueSince} < now() - (${days} * interval '1 day')`,
    ));
  for (const account of due) {
    try {
      await setAccountState(account, { subStatus: "paused", accountStatus: "paused" });
      console.log(`[Asaas] acesso pausado por atraso: user ${account.userId}`);
    } catch (e) {
      console.warn("[Asaas] falha ao pausar por atraso:", e instanceof Error ? e.message : e);
    }
  }
  return due.length;
}

/** Encerra o acesso de quem cancelou a própria assinatura e chegou ao fim do período pago. */
export async function endCancelledSubscriptions(): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const expired = await d
    .select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, "active"),
      eq(subscriptions.notes, "Assinatura via Asaas"),
      sql`${subscriptions.stripeSubscriptionId} IS NULL`,
      sql`${subscriptions.endDate} IS NOT NULL`,
      sql`${subscriptions.endDate} < now()`,
    ));
  for (const sub of expired) {
    try {
      await db.upsertSubscription({
        userId: sub.userId,
        plan: "free",
        status: "cancelled",
        autoRenew: 0,
        endDate: null,
        notes: "Assinatura via Asaas",
      });
      console.log(`[Asaas] período pago encerrado: user ${sub.userId}`);
    } catch (e) {
      console.warn("[Asaas] falha ao encerrar assinatura cancelada:", e instanceof Error ? e.message : e);
    }
  }
  return expired.length;
}

/**
 * Cancelamento feito pelo próprio aluno: para as próximas cobranças no Asaas e mantém o acesso
 * até o fim do período já pago (30 dias contados do último pagamento confirmado).
 */
export async function cancelAsaasSubscription(userId: number): Promise<{ accessUntil: Date | null }> {
  if (!isAsaasConfigured()) throw new AsaasError("Asaas não está configurado.", 412);
  if (!(await ensureAsaasSchema())) throw new AsaasError("Banco indisponível.", 503);
  const d = await db.getDb();
  if (!d) throw new AsaasError("Banco indisponível.", 503);

  const [account] = await d
    .select()
    .from(asaasAccounts)
    .where(and(eq(asaasAccounts.userId, userId), inArray(asaasAccounts.status, ["active", "paused"])))
    .orderBy(desc(asaasAccounts.createdAt))
    .limit(1);
  if (!account) throw new AsaasError("Você não tem uma assinatura ativa por PIX, boleto ou cartão (Asaas).", 404);

  try {
    await asaasRequest("DELETE", `/subscriptions/${encodeURIComponent(account.asaasSubscriptionId)}`);
  } catch (e) {
    // Já removida do lado do Asaas: segue o cancelamento local
    if (!(e instanceof AsaasError && e.status === 404)) throw e;
  }

  // Fim do período pago: último pagamento da assinatura + 30 dias
  const rows = (await d.execute(sql`
    select (max("createdAt") + interval '30 days') > now() as active
    from payment_history
    where "userId" = ${userId} and status = 'completed'
      and "stripeInvoiceId" like 'asaas:%' and description like 'Assinatura%'
  `)).rows as Array<{ active: boolean | null }>;
  const stillPaid = account.status === "active" && rows[0]?.active === true;

  if (stillPaid) {
    await d.execute(sql`
      update subscriptions
      set "endDate" = (select max("createdAt") + interval '30 days' from payment_history
                       where "userId" = ${userId} and status = 'completed'
                         and "stripeInvoiceId" like 'asaas:%' and description like 'Assinatura%'),
          "autoRenew" = 0, "updatedAt" = now()
      where "userId" = ${userId} and status = 'active'
    `);
    await d.update(asaasAccounts).set({ status: "cancelled", updatedAt: new Date() }).where(eq(asaasAccounts.id, account.id));
    const current = await db.getSubscriptionByUserId(userId);
    console.log(`[Asaas] assinatura cancelada pelo aluno (acesso até o fim do período): user ${userId}`);
    return { accessUntil: current?.endDate ?? null };
  }

  await setAccountState(account, { subStatus: "cancelled", plan: "free", accountStatus: "cancelled" });
  console.log(`[Asaas] assinatura cancelada pelo aluno (sem período a cumprir): user ${userId}`);
  return { accessUntil: null };
}

const SP_TODAY = () => todayInSaoPaulo();

/**
 * Lembretes de pagamento não concluído (e-mail): 1 hora e cerca de 6 horas depois do primeiro.
 * Só enquanto a cobrança vale (vencimento hoje) e ainda está pendente. Cada lembrete é
 * "reservado" no banco antes de enviar, então nunca sai em duplicidade.
 */
export async function sendPaymentReminders(): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const { sendPaymentReminderEmail } = await import("./_core/email");
  const { ensureTrialSchema } = await import("./trial");
  let sent = 0;

  const person = async (userId: number) => {
    const [u] = await d.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    return u && u.email ? u : null;
  };
  // O segundo envio fica elegível 7h após a criação (1h até o primeiro + 6h).
  const window = (n: number) => (n === 0 ? sql`interval '1 hour'` : sql`interval '7 hours'`);

  // Teste de 1 aula
  if (await ensureTrialSchema()) {
    const pending = await d
      .select()
      .from(trialPasses)
      .where(and(
        eq(trialPasses.status, "pending"),
        sql`${trialPasses.remindersSent} < 2`,
        sql`${trialPasses.invoiceUrl} IS NOT NULL`,
        eq(trialPasses.dueDate, SP_TODAY()),
      ));
    for (const p of pending) {
      const n = p.remindersSent;
      const [{ ready }] = (await d.execute(sql`select ("createdAt" < now() - ${window(n)}) as ready from "trialPasses" where id = ${p.id}`)).rows as Array<{ ready: boolean }>;
      if (!ready) continue;
      const claimed = await d
        .update(trialPasses)
        .set({ remindersSent: n + 1 })
        .where(and(eq(trialPasses.id, p.id), eq(trialPasses.remindersSent, n), eq(trialPasses.status, "pending")))
        .returning({ id: trialPasses.id });
      if (!claimed.length) continue;
      const u = await person(p.userId);
      if (!u) {
        await d.update(trialPasses)
          .set({ remindersSent: n })
          .where(and(eq(trialPasses.id, p.id), eq(trialPasses.remindersSent, n + 1), eq(trialPasses.status, "pending")));
        continue;
      }
      const r = await sendPaymentReminderEmail(u.email, u.name || "", {
        invoiceUrl: p.invoiceUrl!,
        what: "o teste de 1 aula",
        note: "O link vale até o fim de hoje. Depois disso, é só gerar um novo na página da aula.",
      });
      if (r.success) {
        sent++;
      } else {
        // Reabre a tentativa para permitir novo envio após falha transitória do provedor.
        await d.update(trialPasses)
          .set({ remindersSent: n })
          .where(and(eq(trialPasses.id, p.id), eq(trialPasses.remindersSent, n + 1), eq(trialPasses.status, "pending")));
      }
    }
  }

  // Primeira cobrança da assinatura
  const accounts = await d
    .select()
    .from(asaasAccounts)
    .where(and(
      eq(asaasAccounts.status, "pending"),
      sql`${asaasAccounts.remindersSent} < 2`,
      sql`${asaasAccounts.createdAt} > now() - interval '24 hours'`,
    ));
  for (const a of accounts) {
    const n = a.remindersSent;
    const [{ ready }] = (await d.execute(sql`select ("createdAt" < now() - ${window(n)}) as ready from "asaasAccounts" where id = ${a.id}`)).rows as Array<{ ready: boolean }>;
    if (!ready) continue;
    let link: string | null = null;
    try { link = await firstPaymentLink(a.asaasSubscriptionId); } catch { link = null; }
    if (!link) continue;
    const claimed = await d
      .update(asaasAccounts)
      .set({ remindersSent: n + 1 })
      .where(and(eq(asaasAccounts.id, a.id), eq(asaasAccounts.remindersSent, n), eq(asaasAccounts.status, "pending")))
      .returning({ id: asaasAccounts.id });
    if (!claimed.length) continue;
    const u = await person(a.userId);
    if (!u) {
      await d.update(asaasAccounts)
        .set({ remindersSent: n })
        .where(and(eq(asaasAccounts.id, a.id), eq(asaasAccounts.remindersSent, n + 1), eq(asaasAccounts.status, "pending")));
      continue;
    }
    const r = await sendPaymentReminderEmail(u.email, u.name || "", {
      invoiceUrl: link,
      what: `a assinatura ${getPlanDisplayName(a.planSlug as PlanSlug)}`,
    });
    if (r.success) {
      sent++;
    } else {
      // Reabre a tentativa para permitir novo envio após falha transitória do provedor.
      await d.update(asaasAccounts)
        .set({ remindersSent: n })
        .where(and(eq(asaasAccounts.id, a.id), eq(asaasAccounts.remindersSent, n + 1), eq(asaasAccounts.status, "pending")));
    }
  }
  return sent;
}

let maintenanceRunning = false;

/** Roda a rotina inteira; nunca lança e nunca roda duas vezes ao mesmo tempo. */
export async function runBillingMaintenance(): Promise<void> {
  if (maintenanceRunning || !isAsaasConfigured()) return;
  maintenanceRunning = true;
  try {
    if (!(await ensureAsaasSchema())) return;
    await pauseOverdueAccounts();
    await endCancelledSubscriptions();
    await sendPaymentReminders();
  } catch (e) {
    console.warn("[Asaas] rotina de cobrança falhou:", e instanceof Error ? e.message : e);
  } finally {
    maintenanceRunning = false;
  }
}

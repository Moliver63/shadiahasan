/**
 * stripe-webhook.ts — Endpoint de webhooks do Stripe
 * Localização: server/routes/stripe-webhook.ts
 *
 * IMPORTANTE: Esta rota precisa do raw body para validar a assinatura do Stripe.
 * No index.ts ela é registrada ANTES do express.json() para receber o body cru.
 * O express.raw() é aplicado apenas nesta rota.
 */

import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import * as db from "../db";
import { getPlanSlugByPriceId, getPlanDisplayName } from "../../shared/stripe-config";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-01-28.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

// Configuração de pontos por plano
const POINTS_CONFIG = {
  basic:   100,
  premium: 200,
  vip:     600,
  bonuses: {
    third:  150,
    fourth: 200,
    fifth:  250,
  },
};

const FREE_MONTH_THRESHOLD = 2;

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): "active" | "paused" | "cancelled" | "expired" | "trial" {
  if (status === "active") return "active";
  if (status === "trialing") return "trial";
  if (status === "canceled") return "cancelled";
  if (status === "incomplete_expired") return "expired";
  return "paused"; // incomplete, past_due, unpaid ou paused não liberam como ativo
}

/** Sincroniza apenas o estado da assinatura; lançamentos financeiros vêm de eventos de fatura. */
async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id || "";
  const planSlug = getPlanSlugByPriceId(priceId);
  if (!planSlug) {
    console.warn(`[Stripe Webhook] preço sem plano mapeado: ${priceId || "ausente"}`);
    return null;
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !customer.email) return null;
  const user = subscription.metadata?.user_id
    ? await db.getUserById(Number(subscription.metadata.user_id))
    : await db.getUserByEmail(customer.email);
  if (!user) {
    console.warn(`[Stripe Webhook] usuário não encontrado para assinatura ${subscription.id}`);
    return null;
  }

  await db.upsertSubscription({
    userId: user.id,
    plan: planSlug,
    status: mapStripeSubscriptionStatus(subscription.status),
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeCustomerId: customerId,
    autoRenew: subscription.cancel_at_period_end ? 0 : 1,
    endDate: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
  });
  return { user, planSlug, planName: getPlanDisplayName(planSlug), customerId };
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const reference = invoice.parent?.subscription_details?.subscription;
  return typeof reference === "string" ? reference : reference?.id ?? null;
}

function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as any;
  const direct = raw.payment_intent;
  if (typeof direct === "string") return direct;
  const payments = raw.payments?.data ?? [];
  for (const item of payments) {
    const intent = item?.payment?.payment_intent;
    if (typeof intent === "string") return intent;
    if (intent?.id) return String(intent.id);
  }
  return null;
}

/**
 * Processa pontos de indicação quando uma assinatura é paga
 */
export async function processReferralOnSubscription(userId: number, planName: string) {
  try {
    const user = await db.getUserById(userId);
    if (!user?.referredBy) return;

    const referrer = await db.getUserByReferralCode(user.referredBy);
    if (!referrer) return;

    console.log(`[Referral] ${referrer.name} (${referrer.id}) indicou ${user.name} (${user.id})`);

    // Calcula pontos base pelo plano
    let basePoints = 0;
    const planLower = planName.toLowerCase();
    if (planLower.includes("basic") || planLower.includes("básico")) basePoints = POINTS_CONFIG.basic;
    else if (planLower.includes("premium"))                           basePoints = POINTS_CONFIG.premium;
    else if (planLower.includes("vip"))                               basePoints = POINTS_CONFIG.vip;

    if (basePoints === 0) return;

    // Bônus por número de indicações
    const referrals = await db.getReferralsByReferrerId(referrer.id);
    const confirmedCount = referrals.filter(r => r.status === "confirmed").length;

    let bonusPoints = 0;
    if (confirmedCount === 2)      bonusPoints = POINTS_CONFIG.bonuses.third;
    else if (confirmedCount === 3) bonusPoints = POINTS_CONFIG.bonuses.fourth;
    else if (confirmedCount >= 4)  bonusPoints = POINTS_CONFIG.bonuses.fifth;

    const totalPoints = basePoints + bonusPoints;

    // Cria ou atualiza registro de indicação
    const existingReferral = referrals.find(r => r.referredUserId === user.id);
    // Webhooks de renovação/reenvio não concedem pontos novamente.
    if (existingReferral?.status === "confirmed") return;
    if (existingReferral) {
      await db.confirmReferral(existingReferral.id, planName);
    } else {
      await db.createReferral({
        referrerId: referrer.id,
        referredUserId: user.id,
        referralCode: user.referredBy || "",
        status: "confirmed",
        planPurchased: planName,
        pointsAwarded: totalPoints,
      });
    }

    // Adiciona pontos ao referenciador
    await db.updateUserPoints(referrer.id, totalPoints);
    await db.createPointsTransaction({
      userId: referrer.id,
      amount: totalPoints,
      type: "referral_bonus",
      description: `Indicação confirmada: ${user.name} — Plano ${planName}`,
    });

    console.log(`[Referral] ${totalPoints} pontos para ${referrer.name} (${basePoints} base + ${bonusPoints} bônus)`);

    // Verifica se ganhou mês grátis
    const monthlyCount = await db.getMonthlyReferralCount(referrer.id);
    if (monthlyCount > 0 && monthlyCount % FREE_MONTH_THRESHOLD === 0) {
      await db.incrementFreeMonths(referrer.id);
      await db.createPointsTransaction({
        userId: referrer.id,
        amount: 0,
        type: "free_month_applied",
        description: `Mensalidade grátis conquistada (${monthlyCount} indicações no mês)`,
      });
      console.log(`[Referral] Mês grátis concedido a ${referrer.name}`);
    }
  } catch (error) {
    console.error(`[Referral] Erro ao processar indicação:`, error);
  }
}

/**
 * Webhook do Stripe — recebe eventos em tempo real
 *
 * Usa express.raw() para preservar o body cru necessário
 * para validar a assinatura do Stripe (stripe.webhooks.constructEvent)
 */
router.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature header");
  if (!webhookSecret) return res.status(500).send("Webhook secret not configured");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Falha na verificação da assinatura: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let claimed: boolean;
  try {
    claimed = await db.claimStripeWebhookEvent(event.id, event.type, JSON.stringify(event));
  } catch (error) {
    console.error("[Stripe Webhook] Não foi possível registrar o evento:", error);
    return res.status(500).send("Webhook persistence error");
  }
  if (!claimed) return res.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = Number(session.metadata?.user_id || 0);
        if (!Number.isInteger(userId) || userId <= 0) throw new Error(`Checkout ${session.id} sem user_id.`);
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        await db.upsertProviderPayment({
          userId,
          amount: session.amount_total ?? undefined,
          currency: session.currency?.toUpperCase() || "BRL",
          status: "pending", // Checkout concluído ainda não é confirmação de fatura paga.
          paymentMethod: "stripe",
          stripeInvoiceId: `stripe:checkout:${session.id}`,
          checkoutSessionId: session.id,
          providerSubscriptionId: subscriptionId || undefined,
          providerStatus: session.payment_status === "paid" ? "checkout_completed" : "checkout_completed_pending_payment",
          paymentUrl: null,
          planSlug: session.metadata?.plan_slug || null,
          description: `Checkout Stripe — ${session.metadata?.plan_slug || "assinatura"}`,
        });
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = Number(session.metadata?.user_id || 0);
        if (userId > 0) {
          await db.upsertProviderPayment({
            userId,
            status: "failed",
            paymentMethod: "stripe",
            stripeInvoiceId: `stripe:checkout:${session.id}`,
            checkoutSessionId: session.id,
            providerStatus: "checkout_expired",
            paymentUrl: null,
            planSlug: session.metadata?.plan_slug || null,
            description: `Checkout Stripe expirado — ${session.metadata?.plan_slug || "assinatura"}`,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const synced = await syncStripeSubscription(subscription);
        if (!synced) throw new Error(`Não foi possível vincular a fatura ${invoice.id} a um usuário e plano.`);
        await db.upsertProviderPayment({
          userId: synced.user.id,
          amount: Math.max(0, invoice.amount_paid ?? 0),
          currency: (invoice.currency || "brl").toUpperCase(),
          status: "completed",
          paymentMethod: "stripe",
          stripeInvoiceId: invoice.id,
          stripePaymentIntentId: invoicePaymentIntentId(invoice),
          providerStatus: invoice.status || "paid",
          paymentUrl: invoice.hosted_invoice_url,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10) : null,
          paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : new Date(),
          providerSubscriptionId: subscription.id,
          planSlug: synced.planSlug,
          description: `Assinatura ${synced.planName} — fatura ${invoice.id}`,
        });
        if (invoice.billing_reason === "subscription_create" && (invoice.amount_paid ?? 0) > 0) {
          await processReferralOnSubscription(synced.user.id, synced.planName);
        }
        break;
      }

      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
        const synced = subscription ? await syncStripeSubscription(subscription) : null;
        const user = synced?.user ?? (invoice.customer_email ? await db.getUserByEmail(invoice.customer_email) : null);
        if (!user) throw new Error(`Usuário não localizado para a fatura ${invoice.id}.`);
        const actionRequired = event.type === "invoice.payment_action_required";
        await db.upsertProviderPayment({
          userId: user.id,
          amount: Math.max(0, invoice.amount_due ?? 0),
          currency: (invoice.currency || "brl").toUpperCase(),
          status: actionRequired ? "pending" : "failed",
          paymentMethod: "stripe",
          stripeInvoiceId: invoice.id,
          providerStatus: actionRequired ? "payment_action_required" : "payment_failed",
          paymentUrl: invoice.hosted_invoice_url,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10) : null,
          providerSubscriptionId: subscriptionId || undefined,
          planSlug: synced?.planSlug,
          description: actionRequired ? "Ação necessária para concluir o pagamento" : "Pagamento da fatura falhou",
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await syncStripeSubscription(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const synced = await syncStripeSubscription(subscription);
        if (synced) {
          await db.upsertSubscription({
            userId: synced.user.id,
            plan: "free",
            status: "cancelled",
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price.id,
            stripeCustomerId: synced.customerId,
            autoRenew: 0,
            endDate: null,
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intentId) await db.updateStripePaymentRefund(intentId, charge.amount_refunded, charge.amount);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Evento ignorado: ${event.type}`);
    }

    await db.finishStripeWebhookEvent(event.id);
    return res.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Erro ao processar evento ${event.type}:`, error);
    await db.finishStripeWebhookEvent(event.id, error instanceof Error ? error.message : String(error)).catch(() => undefined);
    return res.status(500).send("Webhook processing error");
  }
});

export default router;

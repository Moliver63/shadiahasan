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

/**
 * Atualiza a assinatura do usuário no banco após pagamento confirmado
 */
async function handleSubscriptionActivated(
  userEmail: string,
  stripeSubscriptionId: string,
  stripePriceId: string,
  stripeCustomerId: string
) {
  const user = await db.getUserByEmail(userEmail);
  if (!user) {
    console.log(`[Stripe Webhook] Usuário não encontrado: ${userEmail}`);
    return;
  }

  const planSlug = getPlanSlugByPriceId(stripePriceId);
  const planName = planSlug ? getPlanDisplayName(planSlug) : "Unknown";

  console.log(`[Stripe Webhook] Ativando plano ${planName} para user ${user.id} (${userEmail})`);

  // Atualiza ou cria assinatura no banco
  await db.upsertSubscription({
    userId: user.id,
    plan: planSlug || "basic",
    status: "active",
    stripeSubscriptionId,
    stripePriceId,
    stripeCustomerId,
    autoRenew: 1,
    endDate: null,
  });

  // Registra pagamento
  await db.createPaymentRecord({
    userId: user.id,
    amount: 0, // valor real vem do invoice
    currency: "brl",
    status: "completed",
    paymentMethod: "stripe",
    stripePaymentIntentId: null,
    description: `Assinatura ${planName} ativada`,
  });

  // Processa indicação se o usuário foi referido
  await processReferralOnSubscription(user.id, planName);
}

/**
 * Processa pontos de indicação quando uma assinatura é paga
 */
async function processReferralOnSubscription(userId: number, planName: string) {
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
router.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }), // ← raw body APENAS nesta rota
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("[Stripe Webhook] Sem assinatura no header");
      return res.status(400).send("Missing stripe-signature header");
    }

    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET não configurado");
      return res.status(500).send("Webhook secret not configured");
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`[Stripe Webhook] Falha na verificação da assinatura: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

    try {
      switch (event.type) {

        // ✅ Checkout concluído — usuário pagou
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`[Stripe Webhook] Checkout concluído: ${session.id}`);

          if (session.customer_details?.email && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            const priceId = subscription.items.data[0]?.price.id || "";
            const customerId = typeof session.customer === "string" ? session.customer : "";

            await handleSubscriptionActivated(
              session.customer_details.email,
              subscription.id,
              priceId,
              customerId
            );
          }
          break;
        }

        // ✅ Fatura paga (renovação mensal)
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`[Stripe Webhook] Fatura paga: ${invoice.id}`);

          const email = invoice.customer_email;
          const subscriptionId = typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

          if (email && subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = subscription.items.data[0]?.price.id || "";
            const customerId = typeof invoice.customer === "string" ? invoice.customer : "";

            await handleSubscriptionActivated(email, subscription.id, priceId, customerId);
          }
          break;
        }

        // ✅ Assinatura atualizada (upgrade/downgrade)
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`[Stripe Webhook] Assinatura atualizada: ${subscription.id} — status: ${subscription.status}`);

          if (subscription.status === "active" && subscription.customer) {
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            if (!customer.deleted && customer.email) {
              const priceId = subscription.items.data[0]?.price.id || "";
              await handleSubscriptionActivated(
                customer.email,
                subscription.id,
                priceId,
                subscription.customer as string
              );
            }
          }
          break;
        }

        // ❌ Assinatura cancelada
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`[Stripe Webhook] Assinatura cancelada: ${subscription.id}`);

          if (subscription.customer) {
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            if (!customer.deleted && customer.email) {
              const user = await db.getUserByEmail(customer.email);
              if (user) {
                await db.upsertSubscription({
                  userId: user.id,
                  plan: "free",
                  status: "cancelled",
                  stripeSubscriptionId: subscription.id,
                  autoRenew: 0,
                  endDate: null,
                });
                console.log(`[Stripe Webhook] Plano de ${user.email} revertido para free`);
              }
            }
          }
          break;
        }

        // ❌ Pagamento falhou
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`[Stripe Webhook] Pagamento falhou: ${invoice.id} — ${invoice.customer_email}`);

          if (invoice.customer_email) {
            const user = await db.getUserByEmail(invoice.customer_email);
            if (user) {
              await db.createPaymentRecord({
                userId: user.id,
                amount: invoice.amount_due / 100,
                currency: invoice.currency,
                status: "failed",
                paymentMethod: "stripe",
                stripeInvoiceId: invoice.id,
                description: "Pagamento recusado",
              });
            }
          }
          break;
        }

        default:
          console.log(`[Stripe Webhook] Evento ignorado: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error(`[Stripe Webhook] Erro ao processar evento ${event.type}:`, error);
      res.status(500).send("Webhook processing error");
    }
  }
);

export default router;

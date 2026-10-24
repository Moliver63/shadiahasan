/**
 * stripe.ts — Funções utilitárias do Stripe
 * Localização: server/stripe.ts
 */

import Stripe from "stripe";
import * as db from "./db";

// Instância do Stripe — reutilizada em todo o backend
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-01-28.clover" })
  : null;

/**
 * Verifica se o Stripe está configurado corretamente
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY !== "" &&
    !process.env.STRIPE_SECRET_KEY.includes("SUBSTITUA")
  );
}

/**
 * Cria uma sessão de checkout no Stripe
 */
export async function createCheckoutSession(params: {
  priceId: string;
  userId: number;
  userEmail: string;
  userName?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  if (!stripe) {
    throw new Error("Stripe não está configurado — verifique STRIPE_SECRET_KEY no .env");
  }

  const price = await stripe.prices.retrieve(params.priceId);
  if (price.unit_amount == null || price.unit_amount <= 0) {
    throw new Error("O preço recorrente do Stripe precisa ter um valor unitário positivo para registrar o pedido.");
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    customer_email: params.userEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      user_id: String(params.userId),
      user_email: params.userEmail,
      user_name: params.userName || "",
      ...params.metadata,
    },
    subscription_data: {
      metadata: {
        user_id: String(params.userId),
        user_email: params.userEmail,
        plan_slug: params.metadata?.plan_slug || "",
      },
    },
    locale: "pt-BR",
  });

  try {
    await db.upsertProviderPayment({
      userId: params.userId,
      amount: price.unit_amount,
      currency: (price.currency || "brl").toUpperCase(),
      status: "pending",
      paymentMethod: "stripe",
      stripeInvoiceId: `stripe:checkout:${session.id}`,
      checkoutSessionId: session.id,
      providerStatus: "checkout_created",
      paymentUrl: session.url,
      planSlug: params.metadata?.plan_slug || null,
      description: `Checkout Stripe — ${params.metadata?.plan_slug || "assinatura"}`,
    });
  } catch (error) {
    // Não descartar uma sessão válida por indisponibilidade momentânea do ledger;
    // invoice.paid reconcilia a cobrança pelo webhook.
    console.error("[Stripe] checkout criado, mas não foi possível gravar o pedido pendente:", error);
  }

  console.log(`[Stripe] Checkout session criada: ${session.id} para user ${params.userId}`);
  return session;
}

/**
 * Cria uma sessão do portal do cliente (gerenciar assinatura, cancelar, etc.)
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe não está configurado — verifique STRIPE_SECRET_KEY no .env");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  console.log(`[Stripe] Portal session criada para customer ${customerId}`);
  return session.url;
}

import type { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../stripe";
import { upsertSubscription } from "../db";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Handle Stripe webhook events
 * This endpoint must be registered at /api/stripe/webhook
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  if (!stripe) {
    console.error("[Stripe Webhook] Stripe not configured");
    return res.status(500).json({ error: "Stripe not configured" });
  }

  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error(`[Stripe Webhook] Error processing event ${event.type}:`, error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

/**
 * Handle successful checkout session
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[Stripe Webhook] Processing checkout.session.completed");

  const userId = parseInt(session.client_reference_id || "0");
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error("[Stripe Webhook] Missing user_id in checkout session");
    return;
  }

  // Get subscription details
  if (stripe && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(subscription);
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log("[Stripe Webhook] Processing subscription update");

  const userId = parseInt(subscription.metadata.user_id || "0");
  
  if (!userId) {
    console.error("[Stripe Webhook] Missing user_id in subscription metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const customerId = subscription.customer as string;

  // Map Stripe status to our status
  let status: "active" | "paused" | "cancelled" | "expired" | "trial" = "active";
  
  if (subscription.status === "trialing") {
    status = "trial";
  } else if (subscription.status === "canceled") {
    status = "cancelled";
  } else if (subscription.status === "past_due" || subscription.status === "unpaid") {
    status = "paused";
  }

  // Determine plan from metadata or price ID
  const planSlug = subscription.metadata.plan_slug || "premium";
  let plan: "free" | "basic" | "premium" | "vip" = "premium";
  
  if (planSlug === "basic") plan = "basic";
  else if (planSlug === "vip") plan = "vip";

  await upsertSubscription({
    userId,
    plan,
    status,
    endDate: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null,
    trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    autoRenew: subscription.cancel_at_period_end ? 0 : 1,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeCustomerId: customerId,
  });

  console.log(`[Stripe Webhook] Subscription updated for user ${userId}`);
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("[Stripe Webhook] Processing subscription deletion");

  const userId = parseInt(subscription.metadata.user_id || "0");
  
  if (!userId) {
    console.error("[Stripe Webhook] Missing user_id in subscription metadata");
    return;
  }

  await upsertSubscription({
    userId,
    plan: "free",
    status: "cancelled",
    endDate: new Date(),
    stripeSubscriptionId: subscription.id,
  });

  console.log(`[Stripe Webhook] Subscription cancelled for user ${userId}`);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log("[Stripe Webhook] Processing invoice.paid");
  
  // You can create a payment record here if needed
  // For now, subscription updates are handled by subscription events
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log("[Stripe Webhook] Processing invoice.payment_failed");
  
  // You could send notification to user or admin here
  const customerId = invoice.customer as string;
  console.warn(`[Stripe Webhook] Payment failed for customer ${customerId}`);
}

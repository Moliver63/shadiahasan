import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllSubscriptions,
  getSubscriptionByUserId,
  upsertSubscription,
  updateSubscriptionStatus,
  getPaymentHistoryByUserId,
  getAllPaymentHistory,
  createPaymentRecord,
} from "../db";
import { createCheckoutSession, createCustomerPortalSession, isStripeConfigured } from "../stripe";
import { getStripePriceId, isPlanStripeConfigured } from "../../shared/stripe-config";

export const subscriptionsRouter = router({
  /**
   * Get all subscriptions (admin only)
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    return await getAllSubscriptions();
  }),

  /**
   * Get subscription by user ID
   */
  getByUserId: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Admin can view any subscription, users can only view their own
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await getSubscriptionByUserId(input.userId);
    }),

  /**
   * Create or update subscription (admin only)
   */
  upsert: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        plan: z.enum(["free", "basic", "premium", "vip"]),
        status: z.enum(["active", "paused", "cancelled", "expired", "trial"]),
        endDate: z.string().nullable().optional(),
        trialEndDate: z.string().nullable().optional(),
        autoRenew: z.number().optional(),
        stripeSubscriptionId: z.string().nullable().optional(),
        stripePriceId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const result = await upsertSubscription({
        ...input,
        endDate: input.endDate ? new Date(input.endDate) : null,
        trialEndDate: input.trialEndDate ? new Date(input.trialEndDate) : null,
      });

      return result;
    }),

  /**
   * Update subscription status (admin only)
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        status: z.enum(["active", "paused", "cancelled", "expired", "trial"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      return await updateSubscriptionStatus(input.subscriptionId, input.status);
    }),

  /**
   * Get payment history for a user
   */
  getPaymentHistory: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Admin can view any payment history, users can only view their own
      if (ctx.user.role !== "admin" && ctx.user.id !== input.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await getPaymentHistoryByUserId(input.userId);
    }),

  /**
   * Get all payment history (admin only)
   */
  getAllPaymentHistory: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    return await getAllPaymentHistory();
  }),

  /**
   * Create payment record (admin only)
   */
  createPayment: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        subscriptionId: z.number().nullable().optional(),
        amount: z.number(),
        currency: z.string().optional(),
        status: z.enum(["pending", "completed", "failed", "refunded"]),
        paymentMethod: z.string().nullable().optional(),
        stripePaymentIntentId: z.string().nullable().optional(),
        stripeInvoiceId: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      return await createPaymentRecord(input);
    }),

  /**
   * Create Stripe checkout session
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        planSlug: z.enum(["basic", "premium", "vip"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe não está configurado. Entre em contato com o suporte.",
        });
      }

      const priceId = getStripePriceId(input.planSlug);
      
      if (!priceId || !isPlanStripeConfigured(input.planSlug)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Plano ${input.planSlug} não está configurado no Stripe. Entre em contato com o suporte.`,
        });
      }

      const origin = ctx.req.headers.origin || 'https://shadia-vr-platform.manus.space';
      
      const session = await createCheckoutSession({
        priceId,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userName: ctx.user.name || undefined,
        successUrl: origin + "/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: `${origin}/pricing`,
        metadata: {
          plan_slug: input.planSlug,
        },
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),

  /**
   * Get customer portal URL
   */
  getPortalUrl: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isStripeConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Stripe não está configurado.",
      });
    }

    // Get user's subscription to find Stripe customer ID
    const subscription = await getSubscriptionByUserId(ctx.user.id);
    
    if (!subscription?.stripeCustomerId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Você ainda não possui uma assinatura ativa.",
      });
    }

    const origin = ctx.req.headers.origin || 'https://shadia-vr-platform.manus.space';
    const portalUrl = await createCustomerPortalSession(
      subscription.stripeCustomerId,
      `${origin}/dashboard`
    );

    return { url: portalUrl };
  }),
});

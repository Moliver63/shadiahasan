import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Referral system router
 * Handles user referrals, points, and cashback
 */

// Points configuration based on the mathematical model
const POINTS_CONFIG = {
  basic: 100,    // R$49,90 plan → 100 points
  premium: 200,  // R$99,90 plan → 200 points
  vip: 600,      // R$299,90 plan → 600 points
  conversion: 10, // 100 points = R$10
  bonuses: {
    third: 150,   // 3rd referral bonus
    fourth: 200,  // 4th referral bonus
    fifth: 250,   // 5th+ referral bonus
  },
};

const FREE_MONTH_THRESHOLD = 2; // 2 referrals = free month

export const referralsRouter = router({
  /**
   * Get or generate user's referral code
   */
  getMyReferralCode: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    // If user doesn't have a referral code, generate one
    if (!user.referralCode) {
      const referralCode = await db.generateReferralCode(ctx.user.id);
      return { referralCode, isNew: true };
    }

    return { referralCode: user.referralCode, isNew: false };
  }),

  /**
   * Get user's referral statistics
   */
  getMyStats: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    const referrals = await db.getReferralsByReferrerId(ctx.user.id);
    const confirmedReferrals = referrals.filter(r => r.status === "confirmed");
    const thisMonthReferrals = await db.getMonthlyReferralCount(ctx.user.id);
    
    // Calculate progress to next free month
    const referralsToFreeMonth = Math.max(0, FREE_MONTH_THRESHOLD - thisMonthReferrals);

    return {
      pointsBalance: user.pointsBalance || 0,
      freeMonthsRemaining: user.freeMonthsRemaining || 0,
      totalReferrals: confirmedReferrals.length,
      thisMonthReferrals,
      referralsToFreeMonth,
      cashValue: Math.floor((user.pointsBalance || 0) / POINTS_CONFIG.conversion), // R$ value
    };
  }),

  /**
   * List user's referrals
   */
  listMyReferrals: protectedProcedure.query(async ({ ctx }) => {
    const referrals = await db.getReferralsByReferrerId(ctx.user.id);
    
    // Enrich with referred user info
    const enrichedReferrals = await Promise.all(
      referrals.map(async (referral) => {
        if (referral.referredUserId) {
          const referredUser = await db.getUserById(referral.referredUserId);
          return {
            ...referral,
            referredUserName: referredUser?.name || "Unknown",
            referredUserEmail: referredUser?.email || "Unknown",
          };
        }
        return {
          ...referral,
          referredUserName: null,
          referredUserEmail: null,
        };
      })
    );

    return enrichedReferrals;
  }),

  /**
   * Get points transaction history
   */
  getPointsHistory: protectedProcedure.query(async ({ ctx }) => {
    const transactions = await db.getPointsTransactionsByUserId(ctx.user.id);
    return transactions;
  }),

  /**
   * Request cashback redemption
   */
  requestCashback: protectedProcedure
    .input(
      z.object({
        pointsAmount: z.number().min(100), // Minimum 100 points (R$10)
        paymentMethod: z.enum(["pix", "bank_transfer", "credit_account"]),
        pixKey: z.string().optional(),
        bankDetails: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserById(ctx.user.id);
      
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Check if user has enough points
      if ((user.pointsBalance || 0) < input.pointsAmount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient points balance",
        });
      }

      // Validate payment method details
      if (input.paymentMethod === "pix" && !input.pixKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PIX key is required for PIX payment method",
        });
      }

      if (input.paymentMethod === "bank_transfer" && !input.bankDetails) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bank details are required for bank transfer",
        });
      }

      // Calculate cash amount (in cents)
      const cashAmount = Math.floor((input.pointsAmount / POINTS_CONFIG.conversion) * 100);

      // Create cashback request
      const requestId = await db.createCashbackRequest({
        userId: ctx.user.id,
        pointsAmount: input.pointsAmount,
        cashAmount,
        paymentMethod: input.paymentMethod,
        pixKey: input.pixKey,
        bankDetails: input.bankDetails,
      });

      // Deduct points from user balance (pending approval)
      await db.updateUserPoints(ctx.user.id, -input.pointsAmount);

      // Record transaction
      await db.createPointsTransaction({
        userId: ctx.user.id,
        amount: -input.pointsAmount,
        type: "cashback_redeemed",
        description: `Cashback request #${requestId} - ${input.paymentMethod}`,
      });

      return { success: true, requestId };
    }),

  /**
   * Validate referral code (public - used during signup)
   */
  validateReferralCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const user = await db.getUserByReferralCode(input.code);
      
      if (!user) {
        return { valid: false, referrerName: null };
      }

      return {
        valid: true,
        referrerName: user.name || "Unknown",
        referrerId: user.id,
      };
    }),

  /**
   * ADMIN: List all cashback requests
   */
  listCashbackRequests: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "rejected"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      const user = await db.getUserById(ctx.user.id);
      if (!user || user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const requests = await db.getAllCashbackRequests(input?.status);

      // Enrich with user info
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const requestUser = await db.getUserById(request.userId);
          return {
            ...request,
            userName: requestUser?.name || "Unknown",
            userEmail: requestUser?.email || "Unknown",
          };
        })
      );

      return enrichedRequests;
    }),

  /**
   * ADMIN: Process cashback request (approve/reject)
   */
  processCashbackRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number(),
        status: z.enum(["approved", "rejected"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      const user = await db.getUserById(ctx.user.id);
      if (!user || user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const request = await db.getCashbackRequestById(input.requestId);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      }

      if (request.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Request has already been processed",
        });
      }

      // Update request status
      await db.updateCashbackRequestStatus(
        input.requestId,
        input.status,
        ctx.user.id,
        input.adminNotes
      );

      // If rejected, refund points to user
      if (input.status === "rejected") {
        await db.updateUserPoints(request.userId, request.pointsAmount);
        await db.createPointsTransaction({
          userId: request.userId,
          amount: request.pointsAmount,
          type: "cashback_refunded",
          description: `Cashback request #${input.requestId} rejected - points refunded`,
        });
      }

      return { success: true };
    }),
});

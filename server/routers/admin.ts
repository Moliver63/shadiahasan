import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";

// Admin-only procedure helper
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Super admin procedure - requires manageAdmins permission
const superAdminProcedure = adminProcedure.use(async ({ ctx, next }) => {
  const permissions = await db.getAdminPermissions(ctx.user.id);
  if (!permissions?.manageAdmins) {
    throw new TRPCError({ 
      code: 'FORBIDDEN', 
      message: 'Permission to manage admins required' 
    });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // List all admins with their permissions
  listAdmins: superAdminProcedure
    .query(async () => {
      return await db.listAllAdminsAndSuperAdmins();
    }),

  // Add new admin with permissions
  addAdmin: superAdminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      permissions: z.object({
        manageCourses: z.boolean(),
        manageStudents: z.boolean(),
        manageContent: z.boolean(),
        manageAdmins: z.boolean(),
        manageSettings: z.boolean(),
        viewAnalytics: z.boolean(),
      }),
    }))
    .mutation(async ({ input }) => {
      return await db.addNewAdmin(input.email, input.name, input.permissions);
    }),

  // Update admin permissions
  updateAdminPermissions: superAdminProcedure
    .input(z.object({
      userId: z.number(),
      permissions: z.object({
        manageCourses: z.boolean(),
        manageStudents: z.boolean(),
        manageContent: z.boolean(),
        manageAdmins: z.boolean(),
        manageSettings: z.boolean(),
        viewAnalytics: z.boolean(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      // Prevent self-modification of manageAdmins permission
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot modify your own admin permissions',
        });
      }
      return await db.updateAdminPermissions(input.userId, input.permissions);
    }),

  // Remove admin (downgrade to user)
  removeAdmin: superAdminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Prevent self-removal
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove yourself as admin',
        });
      }
      return await db.removeAdmin(input.userId);
    }),

  // Update own email (any admin can do this)
  updateOwnEmail: adminProcedure
    .input(z.object({
      newEmail: z.string().email(),
      password: z.string(), // Require password confirmation
    }))
    .mutation(async ({ input, ctx }) => {
      return await db.updateAdminEmail(ctx.user.id, input.newEmail, input.password);
    }),

  // Get own permissions
  getMyPermissions: adminProcedure
    .query(async ({ ctx }) => {
      return await db.getAdminPermissions(ctx.user.id);
    }),

  // Admin invite system
  inviteAdmin: superAdminProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(["admin", "superadmin"]).default("admin"),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createAdminInvite(
        input.email,
        input.role,
        ctx.user.id
      );
      
      // Generate invite URL
      const origin = ctx.req.headers.origin || "https://shadiahasan.club";
      const inviteUrl = `${origin}/admin/accept-invite?token=${result.token}`;
      
      console.log(`[Admin Invite] Invite created for ${input.email}`);
      console.log(`[Admin Invite] URL: ${inviteUrl}`);
      console.log(`[Admin Invite] Expires at: ${result.expiresAt}`);
      
      return {
        success: true,
        inviteUrl,
        expiresAt: result.expiresAt,
      };
    }),

  acceptInvite: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8),
      name: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.acceptAdminInvite(
        input.token,
        input.password,
        input.name
      );
      
      if (!user) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Failed to create admin account',
        });
      }
      
      // Set session cookie
      const { getSessionCookieOptions } = await import("../_core/cookies");
      const { COOKIE_NAME } = await import("@shared/const");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      ctx.res.cookie(COOKIE_NAME, JSON.stringify(userData), cookieOptions);
      
      return { success: true, user: userData };
    }),

  listInvites: superAdminProcedure
    .query(async () => {
      return await db.listAdminInvites();
    }),

  cancelInvite: superAdminProcedure
    .input(z.object({
      inviteId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await db.cancelAdminInvite(input.inviteId);
      return { success: true };
    }),
});

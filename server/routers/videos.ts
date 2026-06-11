/**
 * server/routers/videos.ts
 *
 * Rotas para gerenciamento e acesso a vídeos (YouTube + Cloudflare Stream)
 *
 * Admin:
 *   videos.admin.createUploadUrl   — gera URL de upload direto para CF Stream
 *   videos.admin.updateLesson      — atualiza provider/assetId/playbackUrl/isAccessRestricted
 *   videos.admin.listCFVideos      — lista vídeos na conta CF Stream
 *   videos.admin.deleteVideo       — deleta vídeo do CF Stream
 *
 * Usuário:
 *   videos.getPlaybackUrl          — retorna URL de playback (com verificação de acesso)
 *   videos.hasAccess               — verifica se usuário tem acesso a uma aula
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import {
  lessons,
  subscriptions,
  coursePurchases,
  userSubscriptions,
} from "../../drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import {
  createDirectUploadUrl,
  listVideos,
  deleteVideo,
  resolveVideoUrl,
  isCloudflareConfigured,
} from "../cloudflare-stream";

// ─── Admin procedure ──────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Helper: verifica acesso do usuário a uma aula ────────────────────────────

async function checkUserHasAccess(
  userId: number,
  lesson: { isAccessRestricted: number; courseId: number }
): Promise<boolean> {
  // Aula gratuita — todos acessam
  if (!lesson.isAccessRestricted) return true;

  // Verifica assinatura ativa na tabela subscriptions (gerenciada pelo admin)
  const activeSub = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    )
    .limit(1);

  if (activeSub.length > 0) return true;

  // Verifica assinatura ativa via Stripe (userSubscriptions)
  const stripeSub = await db
    .select()
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active")
      )
    )
    .limit(1);

  if (stripeSub.length > 0) return true;

  // Verifica compra avulsa do curso
  const purchase = await db
    .select()
    .from(coursePurchases)
    .where(
      and(
        eq(coursePurchases.userId, userId),
        eq(coursePurchases.courseId, lesson.courseId),
        eq(coursePurchases.status, "completed")
      )
    )
    .limit(1);

  return purchase.length > 0;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const videosRouter = router({
  // ── Admin ──────────────────────────────────────────────────────────────────

  admin: router({
    /**
     * Gera URL de upload direto para Cloudflare Stream
     * O frontend envia o arquivo diretamente para a CF via TUS
     * sem passar pelo servidor (evita timeout no Render free tier)
     */
    createUploadUrl: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          isProtected: z.boolean().default(false),
          maxDurationSeconds: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (!isCloudflareConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Cloudflare Stream não configurado. Adicione CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no Render.",
          });
        }

        const result = await createDirectUploadUrl({
          name: input.name,
          requireSignedURLs: input.isProtected,
          maxDurationSeconds: input.maxDurationSeconds,
        });

        return result; // { uploadUrl, uid }
      }),

    /**
     * Atualiza os campos de vídeo de uma aula
     * Suporta: youtube, cloudflare, ou qualquer URL HLS
     */
    updateLessonVideo: adminProcedure
      .input(
        z.object({
          lessonId: z.number(),
          videoProvider: z.enum(["youtube", "cloudflare", "hls", "other"]),
          videoAssetId: z.string().nullable().optional(), // UID do CF Stream
          videoPlaybackUrl: z.string().nullable().optional(), // URL do YouTube ou HLS
          isAccessRestricted: z.number().min(0).max(1).optional(), // 0 = grátis, 1 = pago
          duration: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { lessonId, ...updates } = input;

        await db
          .update(lessons)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(lessons.id, lessonId));

        return { success: true };
      }),

    /**
     * Lista todos os vídeos na conta Cloudflare Stream
     */
    listCFVideos: adminProcedure.query(async () => {
      if (!isCloudflareConfigured()) {
        return { configured: false, videos: [] };
      }

      const videos = await listVideos();
      return {
        configured: true,
        videos: videos.map((v) => ({
          uid: v.uid,
          name: v.meta?.name,
          status: v.status?.state,
          duration: v.duration,
          thumbnail: v.thumbnail,
          readyToStream: v.readyToStream,
          requireSignedURLs: v.requireSignedURLs,
          hls: v.playback?.hls,
        })),
      };
    }),

    /**
     * Deleta vídeo do Cloudflare Stream
     */
    deleteCFVideo: adminProcedure
      .input(z.object({ uid: z.string() }))
      .mutation(async ({ input }) => {
        if (!isCloudflareConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cloudflare Stream não configurado.",
          });
        }

        await deleteVideo(input.uid);
        return { success: true };
      }),

    /**
     * Verifica se Cloudflare Stream está configurado
     */
    cfStatus: adminProcedure.query(() => {
      return { configured: isCloudflareConfigured() };
    }),
  }),

  // ── Usuário ────────────────────────────────────────────────────────────────

  /**
   * Retorna a URL de playback de uma aula
   * - Verifica se o usuário tem acesso (assinatura ou compra avulsa)
   * - Para CF Stream protegido: retorna Signed URL (expira em 1h)
   * - Para YouTube: retorna URL direta
   */
  getPlaybackUrl: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ input, ctx }) => {
      const result = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId))
        .limit(1);

      const lesson = result[0];
      if (!lesson) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Aula não encontrada" });
      }

      // Admin sempre tem acesso
      const isAdmin =
        ctx.user.role === "admin" || ctx.user.role === "superadmin";

      const hasAccess =
        isAdmin ||
        (await checkUserHasAccess(ctx.user.id, {
          isAccessRestricted: lesson.isAccessRestricted ?? 0,
          courseId: lesson.courseId,
        }));

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Acesso restrito. Assine um plano ou adquira este curso para assistir.",
        });
      }

      const url = await resolveVideoUrl({
        videoProvider: lesson.videoProvider,
        videoAssetId: lesson.videoAssetId,
        videoPlaybackUrl: lesson.videoPlaybackUrl,
        isAccessRestricted: lesson.isAccessRestricted ?? 0,
      });

      return {
        url,
        provider: lesson.videoProvider,
        isProtected: (lesson.isAccessRestricted ?? 0) === 1,
      };
    }),

  /**
   * Verifica se o usuário tem acesso a uma aula (sem retornar a URL)
   * Útil para exibir lock/unlock no frontend
   */
  hasAccess: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ input, ctx }) => {
      const result = await db
        .select({
          isAccessRestricted: lessons.isAccessRestricted,
          courseId: lessons.courseId,
        })
        .from(lessons)
        .where(eq(lessons.id, input.lessonId))
        .limit(1);

      const lesson = result[0];
      if (!lesson) return { hasAccess: false };

      const isAdmin =
        ctx.user.role === "admin" || ctx.user.role === "superadmin";

      const access =
        isAdmin ||
        (await checkUserHasAccess(ctx.user.id, {
          isAccessRestricted: lesson.isAccessRestricted ?? 0,
          courseId: lesson.courseId,
        }));

      return { hasAccess: access };
    }),

  /**
   * Endpoint público para listar aulas de um curso
   * Retorna metadados mas NÃO retorna URLs de vídeos protegidos
   */
  listLessons: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const result = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          order: lessons.order,
          description: lessons.description,
          duration: lessons.duration,
          isPublished: lessons.isPublished,
          isAccessRestricted: lessons.isAccessRestricted,
          videoProvider: lessons.videoProvider,
          // Nunca expõe videoAssetId ou videoPlaybackUrl publicamente
        })
        .from(lessons)
        .where(
          and(eq(lessons.courseId, input.courseId), eq(lessons.isPublished, 1))
        )
        .orderBy(lessons.order);

      return result;
    }),
});

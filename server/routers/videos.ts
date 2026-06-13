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
import { getDb } from "../db";
import {
  lessons,
  subscriptions,
  coursePurchases,
  userSubscriptions,
  subscriptionPlans,
  enrollments,
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

/**
 * Regras de acesso por plano:
 *
 * 1. Aula não restrita (isAccessRestricted=0) → todos acessam.
 * 2. Compra avulsa do curso (coursePurchases, status=completed) → libera SEMPRE
 *    aquele curso, independente de assinatura.
 * 3. Assinatura ativa (subscriptions OU userSubscriptions+subscription_plans):
 *    - plano "premium" ou "vip" → libera TODOS os cursos restritos.
 *    - plano "basic" → libera no máximo `maxCourses` cursos simultâneos
 *      (matrícula automática via `enrollments` na primeira vez que o aluno
 *      acessa um curso restrito, respeitando o limite do plano).
 *    - plano "free" ou sem assinatura → sem acesso (só avulso).
 */

async function ensureEnrollment(db: any, userId: number, courseId: number) {
  const existing = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(enrollments).values({ userId, courseId, progress: 0 });
  }
}

export async function checkUserHasAccess(
  userId: number,
  lesson: { isAccessRestricted: number; courseId: number }
): Promise<boolean> {
  // Aula gratuita — todos acessam
  if (!lesson.isAccessRestricted) return true;

  const db = await getDb();

  // 1. Compra avulsa do curso — libera sempre, independente do plano
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

  if (purchase.length > 0) {
    await ensureEnrollment(db, userId, lesson.courseId);
    return true;
  }

  // 2. Descobrir o plano ativo do usuário (slug: free | basic | premium | vip)
  let planSlug: string | null = null;
  let maxCourses: number | null = null;

  // 2a. Assinatura gerenciada manualmente pelo admin (tabela subscriptions)
  const manualSub = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .limit(1);

  if (manualSub.length > 0) {
    planSlug = manualSub[0].plan; // "free" | "basic" | "premium" | "vip"
  }

  // 2b. Assinatura via Stripe (userSubscriptions) — descobre o plano pelo stripePriceId
  if (!planSlug) {
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

    if (stripeSub.length > 0 && stripeSub[0].stripePriceId) {
      const plan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.stripePriceId, stripeSub[0].stripePriceId!))
        .limit(1);

      if (plan.length > 0) {
        planSlug = plan[0].slug;
        maxCourses = plan[0].maxCourses ?? null;
      }
    }
  }

  // Sem plano ativo (ou plano "free") → sem acesso a conteúdo restrito
  if (!planSlug || planSlug === "free") return false;

  // Premium / VIP → acesso ilimitado a todo conteúdo restrito
  if (planSlug === "premium" || planSlug === "vip") {
    await ensureEnrollment(db, userId, lesson.courseId);
    return true;
  }

  // Plano Básico → limite de cursos simultâneos (padrão 3 se não definido)
  if (planSlug === "basic") {
    if (maxCourses == null) {
      const basicPlan = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.slug, "basic"))
        .limit(1);
      maxCourses = basicPlan[0]?.maxCourses ?? 3;
    }

    // Já matriculado neste curso? → acesso liberado
    const existingEnrollment = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, userId),
          eq(enrollments.courseId, lesson.courseId)
        )
      )
      .limit(1);

    if (existingEnrollment.length > 0) return true;

    // Ainda não matriculado: conta apenas matrículas em cursos PAGOS
    // (cursos com pelo menos uma aula isAccessRestricted=1).
    // Cursos gratuitos não consomem a cota do plano Básico.
    const paidCourseIds = await db
      .select({ courseId: lessons.courseId })
      .from(lessons)
      .where(eq(lessons.isAccessRestricted, 1));

    const paidCourseIdSet = new Set(paidCourseIds.map((r) => r.courseId));

    const allEnrollments = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.userId, userId));

    const paidEnrollmentsCount = allEnrollments.filter((e) =>
      paidCourseIdSet.has(e.courseId)
    ).length;

    if (paidEnrollmentsCount < maxCourses) {
      // Matrícula automática no primeiro acesso a este curso
      await db.insert(enrollments).values({
        userId,
        courseId: lesson.courseId,
        progress: 0,
      });
      return true;
    }

    // Limite de cursos simultâneos do plano Básico atingido
    return false;
  }

  return false;
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
        const db = await getDb();
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

    /**
     * Consulta o status de processamento de um vídeo no Cloudflare Stream.
     * Quando o vídeo fica "ready", preenche automaticamente
     * videoPlaybackUrl e duration na aula correspondente (se lessonId for informado).
     *
     * O frontend faz polling deste endpoint a cada poucos segundos
     * após o upload, até receber readyToStream=true.
     */
    checkUploadStatus: adminProcedure
      .input(
        z.object({
          uid: z.string(),
          lessonId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        if (!isCloudflareConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Cloudflare Stream não configurado.",
          });
        }

        const details = await getVideoDetails(input.uid);

        const result = {
          uid: details.uid,
          readyToStream: details.readyToStream,
          status: details.status?.state,
          duration: details.duration,
          playbackUrl: details.playback?.hls ?? null,
          thumbnail: details.thumbnail,
        };

        // Quando pronto e lessonId informado, salva automaticamente no banco
        if (details.readyToStream && input.lessonId) {
          const db = await getDb();
          await db
            .update(lessons)
            .set({
              videoPlaybackUrl: details.playback?.hls ?? null,
              duration: Math.round(details.duration || 0),
              updatedAt: new Date(),
            })
            .where(eq(lessons.id, input.lessonId));
        }

        return result;
      }),

    /**
     * RECONCILIAÇÃO: varre todas as aulas com videoProvider="cloudflare" e
     * videoAssetId preenchido, mas videoPlaybackUrl vazio/nulo (casos onde o
     * admin salvou antes do Cloudflare terminar o processamento, ou o
     * polling foi interrompido). Para cada uma, consulta o status real no
     * Cloudflare e, se "ready", preenche videoPlaybackUrl + duration.
     *
     * Use o botão "Sincronizar vídeos pendentes" no admin sempre que um
     * vídeo aparecer como "não disponível" mesmo após o upload.
     */
    syncPendingVideos: adminProcedure.mutation(async () => {
      if (!isCloudflareConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cloudflare Stream não configurado.",
        });
      }

      const db = await getDb();

      const pending = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          videoAssetId: lessons.videoAssetId,
        })
        .from(lessons)
        .where(eq(lessons.videoProvider, "cloudflare"));

      const toCheck = pending.filter(
        (l) => l.videoAssetId && l.videoAssetId.length > 0
      );

      let updated = 0;
      let stillProcessing = 0;
      let errors = 0;
      const details: Array<{ id: number; title: string; status: string }> = [];

      for (const lesson of toCheck) {
        try {
          const cf = await getVideoDetails(lesson.videoAssetId!);

          if (cf.readyToStream) {
            await db
              .update(lessons)
              .set({
                videoPlaybackUrl: cf.playback?.hls ?? null,
                duration: Math.round(cf.duration || 0),
                updatedAt: new Date(),
              })
              .where(eq(lessons.id, lesson.id));

            updated++;
            details.push({ id: lesson.id, title: lesson.title, status: "atualizado" });
          } else {
            stillProcessing++;
            details.push({ id: lesson.id, title: lesson.title, status: "processando" });
          }
        } catch (err) {
          errors++;
          details.push({ id: lesson.id, title: lesson.title, status: "erro" });
        }
      }

      return {
        checked: toCheck.length,
        updated,
        stillProcessing,
        errors,
        details,
      };
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
      const db = await getDb();
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
      const db = await getDb();
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
      const db = await getDb();
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

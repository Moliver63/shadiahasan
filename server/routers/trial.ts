/**
 * Router: trial
 * Teste pago de 1 aula via Asaas (padrão R$ 19,90). Ver server/trial.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { lessons } from "../../drizzle/schema";
import { AsaasError } from "../asaas";
import {
  createTrialCheckout, getEntryLessonForCourse, getEntryLessons, getTrialPriceCents, getTrialStatus,
  getTrialValidDays, setEntryLesson, TrialError,
} from "../trial";
import { isAsaasConfigured } from "../asaas";
import { checkUserHasAccess } from "./videos";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const trialRouter = router({
  /** Aula de entrada de cada curso (a home usa para montar os cards). Não expõe URL de vídeo. */
  entryLessons: publicProcedure.query(async () => {
    const entries = await getEntryLessons();
    return entries.map(({ source, ...rest }) => rest);
  }),

  /** Admin: aula de entrada do curso (escolhida ou automática). */
  adminEntryForCourse: adminProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ input }) => getEntryLessonForCourse(input.courseId)),

  /** Admin: escolhe a aula de entrada do curso; lessonId null volta ao automático. */
  adminSetEntry: adminProcedure
    .input(z.object({ courseId: z.number().int().positive(), lessonId: z.number().int().positive().nullable() }))
    .mutation(async ({ input }) => {
      try {
        await setEntryLesson(input.courseId, input.lessonId);
        return { success: true };
      } catch (e) {
        if (e instanceof TrialError) {
          throw new TRPCError({ code: e.code === "UNAVAILABLE" ? "INTERNAL_SERVER_ERROR" : e.code, message: e.message });
        }
        throw e;
      }
    }),

  /** Preço e validade do teste (a tela de planos usa isto para divulgar a opção). */
  info: publicProcedure.query(() => ({
    enabled: isAsaasConfigured(),
    priceCents: getTrialPriceCents(),
    validDays: getTrialValidDays(),
  })),

  /** Preço, validade e situação do aluno para uma aula (a tela de aula bloqueada usa isto). */
  status: publicProcedure
    .input(z.object({ lessonId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      return getTrialStatus(ctx.user?.id ?? null, input.lessonId);
    }),

  /** Cria a cobrança avulsa e devolve o link da fatura do Asaas (PIX, boleto ou cartão). */
  createCheckout: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      cpfCnpj: z.string().min(11).max(18),
    }))
    .mutation(async ({ input, ctx }) => {
      const d = await getDb();
      if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [lesson] = await d.select().from(lessons).where(eq(lessons.id, input.lessonId)).limit(1);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Aula não encontrada." });

      // Sem o id da aula, o passe de teste não entra na conta: aqui só interessa plano/compra
      const alreadyHasAccess = await checkUserHasAccess(ctx.user.id, {
        isAccessRestricted: lesson.isAccessRestricted ?? 0,
        courseId: lesson.courseId,
      });

      const origin = ctx.req.headers.origin || "https://shadiahasan.club";
      try {
        const result = await createTrialCheckout({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          lessonId: input.lessonId,
          cpfCnpj: input.cpfCnpj,
          origin,
          alreadyHasAccess,
        });
        return { url: result.url };
      } catch (e) {
        if (e instanceof TrialError) {
          const code = e.code === "UNAVAILABLE" ? "INTERNAL_SERVER_ERROR" : e.code;
          throw new TRPCError({ code, message: e.message });
        }
        if (e instanceof AsaasError) {
          console.error("[Trial] Asaas falhou:", e.status, e.message);
          throw new TRPCError({
            code: e.status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
            message: e.status === 400 ? e.message : "Não foi possível iniciar o pagamento. Tente novamente em instantes.",
          });
        }
        throw e;
      }
    }),
});

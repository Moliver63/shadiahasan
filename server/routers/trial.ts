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
  createTrialCheckout, getEntryDiagnostics, getEntryLessonForCourse, getEntryLessons, getTrialPriceCents, getTrialStatus,
  getTrialValidDays, setEntryLesson, TrialError,
} from "../trial";
import { isAsaasConfigured } from "../asaas";
import { checkUserHasAccess } from "./videos";

/**
 * IP real do visitante. No Render a aplicação fica atrás de proxy, então
 * `req.ip` traz o IP do proxy; o primeiro endereço de `x-forwarded-for` é o
 * do cliente. Só o primeiro: os seguintes são os proxies do caminho.
 */
function ipDoRequest(req: { headers: Record<string, unknown>; ip?: string }): string | null {
  const encaminhado = req.headers["x-forwarded-for"];
  const bruto = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  const primeiro = typeof bruto === "string" ? bruto.split(",")[0]?.trim() : "";
  return primeiro || req.ip || null;
}

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

  /** Admin: por que cada curso tem (ou não) aula de entrada. */
  adminDiagnose: adminProcedure.query(async () => getEntryDiagnostics()),

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
      /**
       * Origem do visitante, capturada pelo navegador. Opcional de propósito:
       * bloqueador de rastreamento, navegação privada ou visita direta chegam
       * sem isso, e a compra não pode depender de rastreamento para acontecer.
       * Limites de tamanho para não virar campo livre de texto no banco.
       */
      atribuicao: z
        .object({
          fbp: z.string().max(128).optional(),
          fbc: z.string().max(255).optional(),
          utmSource: z.string().max(128).optional(),
          utmMedium: z.string().max(128).optional(),
          utmCampaign: z.string().max(191).optional(),
          utmContent: z.string().max(191).optional(),
          utmTerm: z.string().max(191).optional(),
          landingUrl: z.string().max(2048).optional(),
        })
        .partial()
        .optional(),
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
          // IP e user-agent vêm do request, não do cliente: a Meta usa os dois
          // para correspondência, e dado que o navegador declara sobre si
          // mesmo não vale como evidência de origem.
          atribuicao: {
            ...(input.atribuicao || {}),
            clientIp: ipDoRequest(ctx.req),
            clientUserAgent: (ctx.req.headers["user-agent"] as string | undefined) ?? null,
          },
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

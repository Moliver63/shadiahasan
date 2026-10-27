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
  getTrialValidDays, isEntryLesson, setEntryLesson, TrialError,
} from "../trial";
import { isAsaasConfigured } from "../asaas";
import { checkUserHasAccess } from "./videos";
import { and, isNotNull, notInArray } from "drizzle-orm";
import { trialPasses, users } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { assinarSessao } from "../_core/sessionCookie";
import { CompraSemContaError, compraSemContaLigada, criarCompraDeConvidado, normalizarEmail, statusDaCompra } from "../trialGuest";

const TRINTA_DIAS_S = 30 * 24 * 60 * 60;

const atribuicaoSchema = z
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
  .optional();

function erroDaCompraSemConta(e: unknown): never {
  if (e instanceof CompraSemContaError) {
    throw new TRPCError({ code: e.code === "UNAVAILABLE" ? "INTERNAL_SERVER_ERROR" : e.code, message: e.message });
  }
  throw e;
}

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
    /** Visitante sem conta paga primeiro; a conta nasce no pagamento (ver server/trialGuest.ts). */
    compraSemConta: isAsaasConfigured() && compraSemContaLigada(),
  })),

  /** Compra sem conta: nome, e-mail e CPF. Não cria conta (só quando o pagamento for confirmado). */
  guestCheckout: publicProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      nome: z.string().min(1).max(120),
      email: z.string().min(3).max(254),
      cpfCnpj: z.string().min(11).max(18),
      atribuicao: atribuicaoSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const origin = (ctx.req.headers.origin as string | undefined) || "https://shadiahasan.com";
      try {
        return await criarCompraDeConvidado({
          nome: input.nome,
          email: input.email,
          cpfCnpj: input.cpfCnpj,
          lessonId: input.lessonId,
          origin,
          aula: { precoCentavos: getTrialPriceCents(), ehAulaDeEntrada: isEntryLesson },
          contaExistente: async (email, aula) => {
            const d = await getDb();
            if (!d) return null;
            const [u] = await d.select({ id: users.id }).from(users).where(eq(users.email, normalizarEmail(email))).limit(1);
            if (!u) return null;
            const jaTemAcesso = await checkUserHasAccess(u.id, { isAccessRestricted: aula.isAccessRestricted ?? 0, courseId: aula.courseId });
            const usados = await d
              .select({ id: trialPasses.id })
              .from(trialPasses)
              .where(and(eq(trialPasses.userId, u.id), isNotNull(trialPasses.paidAt), notInArray(trialPasses.status, ["refunded", "cancelled"])))
              .limit(1);
            return { jaTemAcesso, jaUsouTeste: usados.length > 0 };
          },
          atribuicao: {
            ...(input.atribuicao || {}),
            clientIp: ipDoRequest(ctx.req),
            clientUserAgent: (ctx.req.headers["user-agent"] as string | undefined) ?? null,
          },
        });
      } catch (e) {
        erroDaCompraSemConta(e);
      }
    }),

  /**
   * Tela "aguardando pagamento". Consulta o Asaas na hora se ainda pendente.
   * Paga e com conta criada por esta compra: entra sozinho (sessão provisória).
   */
  guestStatus: publicProcedure
    .input(z.object({ token: z.string().min(20).max(128) }))
    .query(async ({ input, ctx }) => {
      const r = await statusDaCompra(input.token);
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Compra não encontrada." });
      let logado = !!ctx.user && r.entrarSozinho?.userId === ctx.user.id;
      if (r.entrarSozinho && !ctx.user) {
        ctx.res.cookie(
          COOKIE_NAME,
          await assinarSessao({ id: r.entrarSozinho.userId, email: r.entrarSozinho.email }, { provisoria: true, validadeS: TRINTA_DIAS_S }),
          { ...getSessionCookieOptions(ctx.req), maxAge: TRINTA_DIAS_S * 1000 },
        );
        logado = true;
      }
      return {
        situacao: r.situacao,
        lessonId: r.lessonId,
        invoiceUrl: r.invoiceUrl,
        pix: r.pix,
        emailMascarado: r.emailMascarado,
        logado,
        // Logado em outra conta, ou e-mail que já tinha conta: precisa entrar na conta do e-mail
        precisaEntrar: r.situacao === "paga" && !logado,
        compra: r.compra,
      };
    }),

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

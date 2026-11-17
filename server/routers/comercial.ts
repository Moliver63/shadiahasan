/**
 * Router: comercial
 * Modelo comercial do site (assinatura x compra avulsa) e venda avulsa de Programas.
 * Regras em server/programaVenda.ts e shared/comercial.ts.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { isAsaasConfigured, AsaasError } from "../asaas";
import { urlCanonica } from "../_core/seo";
import {
  ProgramaError, comprasDoAluno, conferirCobranca, criarCheckoutPrograma, definirMetodosPagamento,
  definirModeloComercial, historicoConfig, lerConfigComercial, liberarManual, listarComprasAdmin,
  programasComprados, resumoPorPrograma, revogarCompra,
} from "../programaVenda";
import { METODOS, type MetodoPagamento } from "../../shared/comercial";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { assinarSessao } from "../_core/sessionCookie";
import { registrarAutorizacao } from "./marketing";
import { criarCompraConvidado, reenviarLinkConvidado, statusConvidado } from "../programaVenda";

const TRINTA_DIAS_S = 30 * 24 * 60 * 60;

/** Origem do visitante (mesmo formato do teste de 1 aula). Opcional: a compra nunca depende disso. */
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
    ga4ClientId: z.string().regex(/^\d{1,20}\.\d{1,20}$/).optional().catch(undefined),
    ga4SessionId: z.string().regex(/^\d{6,20}$/).optional().catch(undefined),
  })
  .partial()
  .optional();

function ipDoRequest(req: { headers: Record<string, unknown>; ip?: string }): string | null {
  const encaminhado = req.headers["x-forwarded-for"];
  const bruto = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  const primeiro = typeof bruto === "string" ? bruto.split(",")[0]?.trim() : "";
  return primeiro || req.ip || null;
}

function atribuicaoDe(input: z.infer<typeof atribuicaoSchema>, req: any) {
  const { utmTerm: _t, ...resto } = input || {};
  return { ...resto, clientIp: ipDoRequest(req), clientUserAgent: (req.headers["user-agent"] as string | undefined) ?? null };
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }
  return next({ ctx });
});

function erro(e: unknown): never {
  if (e instanceof ProgramaError) {
    throw new TRPCError({ code: e.code === "UNAVAILABLE" ? "INTERNAL_SERVER_ERROR" : e.code, message: e.message });
  }
  if (e instanceof AsaasError) {
    console.error("[Programa] Asaas recusou:", e.message);
    throw new TRPCError({ code: "BAD_REQUEST", message: "O pagamento não pôde ser criado agora. Confira os dados e tente de novo." });
  }
  if (e instanceof Error && !(e instanceof TRPCError)) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  throw e;
}

const metodoSchema = z.enum(METODOS as [MetodoPagamento, ...MetodoPagamento[]]);

export const comercialRouter = router({
  /** Público: o que a vitrine precisa saber para mostrar preço e botão de compra. */
  config: publicProcedure.query(async () => {
    const { modelo, metodos } = await lerConfigComercial();
    const asaas = isAsaasConfigured();
    return {
      modelo,
      /** Só vende avulso com o modelo ligado E o Asaas configurado. */
      vendaAvulsa: modelo === "avulso" && asaas,
      metodos: METODOS.filter((m) => metodos[m]),
    };
  }),

  /** Programas que o aluno logado já comprou (ids). */
  meusProgramas: protectedProcedure.query(async ({ ctx }) => programasComprados(ctx.user.id)),

  /** Histórico de compras de Programas do aluno (Minha Área). */
  minhasCompras: protectedProcedure.query(async ({ ctx }) => comprasDoAluno(ctx.user.id)),

  /** Cria a cobrança. O valor vem do banco; o navegador só diz qual Programa e a forma. */
  checkout: protectedProcedure
    .input(z.object({
      collectionId: z.number().int().positive(),
      cpfCnpj: z.string().min(11).max(18),
      metodo: metodoSchema,
      atribuicao: atribuicaoSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await criarCheckoutPrograma({
          atribuicao: atribuicaoDe(input.atribuicao, ctx.req),
          userId: ctx.user.id,
          userEmail: ctx.user.email ?? "",
          userName: ctx.user.name,
          collectionId: input.collectionId,
          cpfCnpj: input.cpfCnpj,
          metodo: input.metodo,
          origin: urlCanonica(),
        });
      } catch (e) {
        erro(e);
      }
    }),

  /** Compra sem conta: nome, e-mail e CPF. A conta só nasce quando o pagamento for confirmado. */
  guestCheckout: publicProcedure
    .input(z.object({
      collectionId: z.number().int().positive(),
      nome: z.string().min(1).max(120),
      email: z.string().min(3).max(254),
      cpfCnpj: z.string().min(11).max(18),
      metodo: metodoSchema,
      aceitaNovidades: z.boolean().optional(),
      atribuicao: atribuicaoSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const r = await criarCompraConvidado({
          nome: input.nome,
          email: input.email,
          cpfCnpj: input.cpfCnpj,
          collectionId: input.collectionId,
          metodo: input.metodo,
          origin: urlCanonica(),
          atribuicao: atribuicaoDe(input.atribuicao, ctx.req),
        });
        if (input.aceitaNovidades === true) void registrarAutorizacao({ email: input.email, nome: input.nome, origem: "compra-programa" });
        return r;
      } catch (e) { erro(e); }
    }),

  /** Tela "aguardando". Paga e com conta criada por esta compra: entra sozinho (sessão provisória, 48 h). */
  guestStatus: publicProcedure
    .input(z.object({ token: z.string().min(20).max(128) }))
    .query(async ({ input, ctx }) => {
      const r = await statusConvidado(input.token);
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Compra não encontrada." });
      let logado = !!ctx.user && !!r.donoId && r.donoId === ctx.user.id;
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
        collectionId: r.collectionId,
        invoiceUrl: r.invoiceUrl,
        pix: r.pix,
        emailMascarado: r.emailMascarado,
        logado,
        precisaEntrar: r.situacao === "paga" && !logado,
        compra: r.compra,
      };
    }),

  guestEnviarLink: publicProcedure
    .input(z.object({ token: z.string().min(20).max(128) }))
    .mutation(async ({ input }) => {
      try {
        const r = await reenviarLinkConvidado(input.token);
        if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Compra não encontrada ou ainda não paga." });
        if (!r.enviado) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não conseguimos enviar o e-mail agora. Tente de novo em instantes." });
        return { emailMascarado: r.emailMascarado };
      } catch (e) { erro(e); }
    }),

  // ── Admin ────────────────────────────────────────────────────────────────

  adminConfig: adminProcedure.query(async () => {
    const { modelo, metodos } = await lerConfigComercial();
    return { modelo, metodos, asaasConfigurado: isAsaasConfigured(), historico: await historicoConfig() };
  }),

  definirModelo: adminProcedure
    .input(z.object({ modelo: z.enum(["assinatura", "avulso"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await definirModeloComercial(input.modelo, ctx.user.id);
        return { success: true };
      } catch (e) { erro(e); }
    }),

  definirMetodos: adminProcedure
    .input(z.object({ pix: z.boolean(), cartao: z.boolean(), boleto: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await definirMetodosPagamento(input, ctx.user.id);
        return { success: true };
      } catch (e) { erro(e); }
    }),

  compras: adminProcedure
    .input(z.object({
      collectionId: z.number().int().positive().optional(),
      status: z.enum(["pending", "active", "refunded", "revoked", "cancelled"]).optional(),
      busca: z.string().max(120).optional(),
    }).optional())
    .query(async ({ input }) => listarComprasAdmin(input ?? {})),

  resumo: adminProcedure.query(async () => resumoPorPrograma()),

  /** Consulta a cobrança no Asaas agora e libera se estiver paga (webhook atrasado). */
  conferir: adminProcedure
    .input(z.object({ asaasPaymentId: z.string().min(3).max(64) }))
    .mutation(async ({ input }) => {
      try {
        return { resultado: await conferirCobranca(input.asaasPaymentId) };
      } catch (e) { erro(e); }
    }),

  liberar: adminProcedure
    .input(z.object({ email: z.string().email().max(254), collectionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await liberarManual(input.email, input.collectionId, ctx.user.id);
        return { success: true };
      } catch (e) { erro(e); }
    }),

  revogar: adminProcedure
    .input(z.object({ compraId: z.number().int().positive(), motivo: z.string().min(3).max(300) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await revogarCompra(input.compraId, input.motivo, ctx.user.id);
        return { success: true };
      } catch (e) { erro(e); }
    }),
});

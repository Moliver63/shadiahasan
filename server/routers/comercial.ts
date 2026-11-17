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
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await criarCheckoutPrograma({
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

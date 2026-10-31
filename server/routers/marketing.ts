/**
 * Router do e-mail marketing: inscrição pública (com autorização) e painel de campanhas (admin).
 * Regras de negócio em server/marketing.ts e server/marketingEnvio.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { enviarEmail } from "../_core/email";
import {
  criarLimitador, emailValido, ORIGENS, registrarContato, resumoContatos, ROTULO_ORIGEM, TEXTO_CONSENTIMENTO,
} from "../marketing";
import { montarEmailCampanha, montarEmailConfirmacao } from "../marketingEmail";
import { calcularResultado, PERFIS } from "../../shared/autoavaliacao";
import { definirAtiva, descreverIntervalo, estatisticasSequencia, JANELA_FIM_H, JANELA_INICIO_H, MAX_DIAS, MAX_PASSOS, obterSequencia, salvarPassos } from "../marketingSequencia";
import {
  campanhaEmAndamento, cancelarCampanha, contarSegmento, enviarTeste, errosDaCampanha, excluirRascunho, iniciarEnvio, listarCampanhas,
  obterCampanha, reenviarErros, salvarCampanha, validarConteudo,
} from "../marketingEnvio";

const origemSchema = z.enum(ORIGENS);
const limitePorIp = criarLimitador(6, 60 * 60 * 1000);

function ipDe(req: any): string {
  const bruto = req?.headers?.["x-forwarded-for"];
  const primeiro = typeof bruto === "string" ? bruto.split(",")[0]?.trim() : "";
  return primeiro || req?.ip || "desconhecido";
}

/** Manda o e-mail de confirmação sem nunca falhar a chamada (a tela responde igual de qualquer jeito). */
export async function mandarConfirmacao(email: string, nome: string | null | undefined, token: string, resultado?: { titulo: string; resumo: string }) {
  try {
    const m = montarEmailConfirmacao({ email, nome, token, resultado });
    await enviarEmail({ para: email, assunto: m.assunto, html: m.html, texto: m.texto, departamento: "psicologa" });
  } catch (e) {
    console.warn("[Marketing] confirmação não enviada:", e instanceof Error ? e.message : e);
  }
}

/**
 * Usado por cadastro e compra da aula (caixa marcada = autorização). Nunca lança:
 * falha aqui não pode atrapalhar conta nem pagamento.
 */
export async function registrarAutorizacao(p: { email: string; nome?: string | null; origem: "cadastro" | "compra-aula"; userId?: number | null }) {
  try {
    const r = await registrarContato(p);
    if (r.enviarConfirmacao && r.token) await mandarConfirmacao(p.email, p.nome, r.token);
  } catch (e) {
    console.warn("[Marketing] autorização não registrada:", e instanceof Error ? e.message : e);
  }
}

const segmentoSchema = z.object({ origens: z.array(origemSchema).max(10), semAssinatura: z.boolean() });
const conteudoSchema = z.object({
  nome: z.string().max(160),
  assunto: z.string().max(200),
  corpo: z.string().max(20000),
  botaoTexto: z.string().max(60).nullish(),
  botaoUrl: z.string().max(500).nullish(),
});

function paraTrpc(e: unknown): never {
  throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : "Não foi possível concluir." });
}

export const marketingRouter = router({
  /** Texto exato da caixa de autorização (os formulários mostram o mesmo texto que é gravado). */
  textoConsentimento: publicProcedure.query(() => ({ texto: TEXTO_CONSENTIMENTO })),

  /**
   * Formulário da home. Dupla confirmação: sempre responde igual, exista o e-mail ou não,
   * e só manda o link de confirmação se o endereço ainda não está ativo.
   */
  inscrever: publicProcedure
    .input(z.object({ email: z.string().max(254), nome: z.string().max(120).optional(), aceito: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      if (!emailValido(input.email)) throw new TRPCError({ code: "BAD_REQUEST", message: "Confira o e-mail digitado." });
      if (!limitePorIp(ipDe(ctx.req))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Tente de novo mais tarde." });
      const r = await registrarContato({ email: input.email, nome: input.nome, origem: "home" });
      if (r.enviarConfirmacao && r.token) await mandarConfirmacao(input.email.trim().toLowerCase(), input.nome, r.token);
      return { ok: true };
    }),

  /**
   * Autoavaliação (página de anúncios). O resultado já apareceu na tela sem pedir nada; aqui a
   * pessoa escolhe receber por e-mail e autoriza novidades. O perfil é recalculado das respostas
   * (não se confia no que o navegador diz) e a origem do clique serve para medir cada campanha.
   */
  inscreverAutoavaliacao: publicProcedure
    .input(z.object({
      email: z.string().max(254),
      nome: z.string().max(120).optional(),
      aceito: z.literal(true),
      respostas: z.array(z.number().int().min(0).max(3)).length(8),
      utmSource: z.string().max(100).optional(),
      utmCampaign: z.string().max(150).optional(),
      utmTerm: z.string().max(200).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!emailValido(input.email)) throw new TRPCError({ code: "BAD_REQUEST", message: "Confira o e-mail digitado." });
      if (!limitePorIp(ipDe(ctx.req))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Tente de novo mais tarde." });
      const r = calcularResultado(input.respostas);
      if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "Respostas inválidas. Refaça a autoavaliação." });
      const reg = await registrarContato({
        email: input.email, nome: input.nome, origem: "autoavaliacao", perfil: r.principal,
        utmSource: input.utmSource, utmCampaign: input.utmCampaign, utmTerm: input.utmTerm,
      });
      if (reg.enviarConfirmacao && reg.token) {
        const perfil = PERFIS[r.principal];
        await mandarConfirmacao(input.email.trim().toLowerCase(), input.nome, reg.token, { titulo: perfil.titulo, resumo: perfil.resumo });
      }
      return { ok: true };
    }),

  // ── Admin ────────────────────────────────────────────────────────────────
  resumo: adminProcedure.query(async () => {
    const r = await resumoContatos();
    return { ...r, porOrigem: r.porOrigem.map((o) => ({ ...o, rotulo: (ROTULO_ORIGEM as Record<string, string>)[o.origem] ?? o.origem })) };
  }),

  origens: adminProcedure.query(() => ORIGENS.map((o) => ({ id: o, rotulo: ROTULO_ORIGEM[o] }))),

  contar: adminProcedure.input(segmentoSchema).query(async ({ input }) => ({ total: await contarSegmento(input) })),

  campanhas: adminProcedure.query(async () => {
    const lista = await listarCampanhas();
    return lista.map((c) => ({ ...c, emAndamentoNoServidor: campanhaEmAndamento(c.id) }));
  }),

  campanha: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const c = await obterCampanha(input.id);
    if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    const resumo = (await listarCampanhas()).find((x) => x.id === c.id);
    return { campanha: c, resumo, erros: await errosDaCampanha(c.id), emAndamentoNoServidor: campanhaEmAndamento(c.id) };
  }),

  salvar: adminProcedure
    .input(conteudoSchema.extend({ id: z.number().int().positive().nullish(), segmento: segmentoSchema }))
    .mutation(async ({ input, ctx }) => {
      try {
        const id = await salvarCampanha({ ...input, origens: input.segmento.origens, semAssinatura: input.segmento.semAssinatura, criadoPor: ctx.user.id });
        return { id };
      } catch (e) {
        return paraTrpc(e);
      }
    }),

  excluir: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const ok = await excluirRascunho(input.id);
    if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Só rascunhos podem ser excluídos." });
    return { ok: true };
  }),

  /** HTML do e-mail como a pessoa vai ver (exemplo com o nome "Maria"). */
  previa: adminProcedure.input(conteudoSchema.omit({ nome: true })).query(({ input }) => {
    const m = montarEmailCampanha(input, { nome: "Maria", token: "exemplo".padEnd(32, "0") });
    return { html: m.html, assunto: m.assunto };
  }),

  /** Um e-mail de teste para quem está logado. */
  testar: adminProcedure.input(conteudoSchema.omit({ nome: true })).mutation(async ({ input, ctx }) => {
    const para = ctx.user.email;
    if (!para) throw new TRPCError({ code: "BAD_REQUEST", message: "Seu usuário não tem e-mail cadastrado." });
    const r = await enviarTeste(input, para);
    if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.erro ?? "Não foi possível enviar o teste." });
    return { para };
  }),

  /** Envia para o público (já salvo). Roda em segundo plano; a tela acompanha pelo status. */
  enviar: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const r = await iniciarEnvio(input.id);
    if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.erro ?? "Não foi possível iniciar o envio." });
    return { total: r.total ?? 0 };
  }),

  /** Retoma uma campanha "enviando" que parou (servidor reiniciou). */
  continuar: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const r = await iniciarEnvio(input.id);
    if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.erro ?? "Não foi possível continuar." });
    return { ok: true };
  }),

  /** Tenta de novo quem deu erro no envio. */
  reenviarErros: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const r = await reenviarErros(input.id);
    if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.erro ?? "Não foi possível reenviar." });
    return { total: r.total ?? 0 };
  }),

  cancelar: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const ok = await cancelarCampanha(input.id);
    if (!ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Só dá para parar uma campanha que está enviando." });
    return { ok: true };
  }),

  // ── Sequência automática ─────────────────────────────────────────────────
  sequencia: adminProcedure.query(async () => {
    const sequencia = await obterSequencia();
    if (!sequencia) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
    const est = await estatisticasSequencia();
    return {
      sequencia: { ...sequencia, passos: sequencia.passos.map((p) => ({ ...p, quando: descreverIntervalo(p.ordem, p.diasDepois) })) },
      estatisticas: est.passos,
      naSequencia: est.naSequencia,
      janela: { inicio: JANELA_INICIO_H, fim: JANELA_FIM_H },
      limites: { maxPassos: MAX_PASSOS, maxDias: MAX_DIAS },
    };
  }),

  salvarSequencia: adminProcedure
    .input(z.object({
      passos: z.array(conteudoSchema.omit({ nome: true }).extend({
        id: z.number().int().positive().nullish(),
        diasDepois: z.number().int().min(0).max(MAX_DIAS),
        pularSeAssina: z.boolean(),
      })).min(1).max(MAX_PASSOS),
    }))
    .mutation(async ({ input }) => {
      try {
        await salvarPassos(input.passos);
        return { ok: true };
      } catch (e) {
        return paraTrpc(e);
      }
    }),

  ativarSequencia: adminProcedure.input(z.object({ ativa: z.boolean() })).mutation(async ({ input }) => {
    try {
      await definirAtiva(input.ativa);
      return { ok: true };
    } catch (e) {
      return paraTrpc(e);
    }
  }),

  validar: adminProcedure.input(conteudoSchema).query(({ input }) => ({ erro: validarConteudo(input) })),
});

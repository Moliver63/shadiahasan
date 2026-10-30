/**
 * Caixas de e-mail do admin (/admin/emails). Ver server/caixaEmail.ts.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { emailCaixas, emailEnviados, emailRecebidos } from "../../drizzle/schema";
import {
  caixaPadrao,
  contarNaoLidas,
  dominioCaixa,
  ensureCaixaSchema,
  enderecoCompleto,
  extrairEndereco,
  listarCaixas,
  listarEnviados,
  listarRecebidos,
  moverMensagensParaPadrao,
  obterCaixa,
  obterRecebido,
  remetenteDaCaixa,
  sincronizarCaixa,
  type Caixa,
} from "../caixaEmail";
import { emailRespostaContato, enviarEmail, getResend } from "../_core/email";

async function banco() {
  if (!(await ensureCaixaSchema())) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  const d = await db.getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  return d;
}

function exigirResend() {
  const resend = getResend();
  if (!resend) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "RESEND_API_KEY não está configurada no servidor." });
  }
  return resend;
}

/** Caixa de uma mensagem; sem caixa (dado antigo), a padrão. */
async function caixaOuPadrao(caixaId: number | null | undefined): Promise<Caixa> {
  const caixa = (caixaId ? await obterCaixa(caixaId) : null) ?? (await caixaPadrao());
  if (!caixa) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhuma caixa de e-mail configurada." });
  return caixa;
}

function assinaturaDa(caixa: Caixa) {
  // A caixa padrão e a caixa pessoal da Shadia assinam como a psicóloga (com CRP);
  // as de setor (Financeiro, RH, TI...) assinam com o nome do setor, sem CRP.
  const daPsicologa = caixa.padrao || caixa.endereco === "shadia" || caixa.nome.trim().toLowerCase() === "admin";
  return { setor: daPsicologa ? null : caixa.nome, endereco: enderecoCompleto(caixa) };
}

// Endereços que não podem virar caixa: o noreply@ dos e-mails automáticos e
// os nomes que provedores usam para avisos de entrega.
const RESERVADOS = new Set(["noreply", "no-reply", "postmaster", "abuse", "mailer-daemon", "bounce", "bounces", "send"]);

const enderecoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/, "Use só letras minúsculas, números, ponto, hífen ou sublinhado.")
  .refine((v) => !RESERVADOS.has(v), "Este endereço é reservado.");

const caixaSchema = z.object({
  endereco: enderecoSchema,
  nome: z.string().trim().min(1, "Dê um nome à caixa.").max(80),
  nomeRemetente: z.string().trim().min(1).max(120),
  copiaPara: z
    .string()
    .trim()
    .max(320)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\S+@\S+\.\S+$/.test(v), "E-mail de cópia inválido."),
});

const idInput = z.object({ id: z.number().int().positive() });

export const caixaEmailRouter = router({
  /** Situação da configuração, para o painel explicar o que falta. */
  status: adminProcedure.query(() => ({
    resendConfigurado: !!process.env.RESEND_API_KEY,
    webhookAssinado: !!process.env.RESEND_WEBHOOK_SECRET,
    avisosPara: process.env.EMAIL_AVISOS_ADMIN || null,
    dominio: dominioCaixa(),
  })),

  // ─── Caixas ────────────────────────────────────────────────────────────────

  caixas: adminProcedure.query(async () => {
    const caixas = await listarCaixas();
    return caixas.map((c) => ({ ...c, enderecoCompleto: enderecoCompleto(c) }));
  }),

  criarCaixa: adminProcedure.input(caixaSchema).mutation(async ({ input }) => {
    const d = await banco();
    const caixas = await listarCaixas();
    if (input.copiaPara?.toLowerCase().endsWith(`@${dominioCaixa()}`)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A cópia precisa ir para um e-mail fora do domínio (ex.: um Gmail)." });
    }
    if (caixas.some((c) => c.endereco === input.endereco)) {
      throw new TRPCError({ code: "CONFLICT", message: `Já existe a caixa ${input.endereco}@${dominioCaixa()}.` });
    }
    const [nova] = await d
      .insert(emailCaixas)
      .values({ ...input, padrao: caixas.length === 0, ordem: caixas.length })
      .returning();
    return nova;
  }),

  editarCaixa: adminProcedure
    .input(caixaSchema.extend({ id: z.number().int().positive(), padrao: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const d = await banco();
      const caixas = await listarCaixas();
      const atual = caixas.find((c) => c.id === input.id);
      if (!atual) throw new TRPCError({ code: "NOT_FOUND", message: "Caixa não encontrada." });
      if (input.copiaPara?.toLowerCase().endsWith(`@${dominioCaixa()}`)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A cópia precisa ir para um e-mail fora do domínio (ex.: um Gmail)." });
      }
      if (caixas.some((c) => c.id !== input.id && c.endereco === input.endereco)) {
        throw new TRPCError({ code: "CONFLICT", message: `Já existe a caixa ${input.endereco}@${dominioCaixa()}.` });
      }
      if (input.padrao === true && !atual.padrao) {
        await d.update(emailCaixas).set({ padrao: false });
      }
      await d
        .update(emailCaixas)
        .set({
          endereco: input.endereco,
          nome: input.nome,
          nomeRemetente: input.nomeRemetente,
          copiaPara: input.copiaPara,
          // A padrão só deixa de ser padrão quando outra assume.
          padrao: atual.padrao || input.padrao === true,
        })
        .where(eq(emailCaixas.id, input.id));
      return { ok: true as const };
    }),

  excluirCaixa: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const d = await banco();
    const caixa = await obterCaixa(input.id);
    if (!caixa) return { ok: true as const, movidas: 0 };
    if (caixa.padrao) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A caixa padrão não pode ser excluída. Defina outra como padrão antes." });
    }
    const padrao = await caixaPadrao();
    if (!padrao) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhuma caixa padrão." });
    await moverMensagensParaPadrao(caixa.id, padrao.id);
    await d.delete(emailCaixas).where(eq(emailCaixas.id, caixa.id));
    return { ok: true as const };
  }),

  // ─── Mensagens ─────────────────────────────────────────────────────────────

  listar: adminProcedure
    .input(
      z.object({
        pasta: z.enum(["entrada", "arquivadas", "lixeira"]).default("entrada"),
        caixaId: z.number().int().positive().nullable().optional(),
      }),
    )
    .query(({ input }) => listarRecebidos(input.pasta, input.caixaId)),

  listarEnviados: adminProcedure
    .input(z.object({ caixaId: z.number().int().positive().nullable().optional() }).optional())
    .query(({ input }) => listarEnviados(input?.caixaId)),

  contarNaoLidas: adminProcedure.query(() => contarNaoLidas()),

  /** Abre a mensagem e marca como lida. */
  obter: adminProcedure.input(idInput).query(async ({ input }) => {
    const m = await obterRecebido(input.id);
    if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
    if (!m.lida) {
      const d = await banco();
      await d.update(emailRecebidos).set({ lida: true }).where(eq(emailRecebidos.id, input.id));
    }
    return m;
  }),

  /** Passa a mensagem para outra caixa (ex.: chegou no contato@, é do financeiro). */
  moverParaCaixa: adminProcedure
    .input(z.object({ id: z.number().int().positive(), caixaId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const d = await banco();
      if (!(await obterCaixa(input.caixaId))) throw new TRPCError({ code: "NOT_FOUND", message: "Caixa não encontrada." });
      await d.update(emailRecebidos).set({ caixaId: input.caixaId }).where(eq(emailRecebidos.id, input.id));
      return { ok: true as const };
    }),

  marcarLida: adminProcedure
    .input(z.object({ id: z.number().int().positive(), lida: z.boolean() }))
    .mutation(async ({ input }) => {
      const d = await banco();
      await d.update(emailRecebidos).set({ lida: input.lida }).where(eq(emailRecebidos.id, input.id));
      return { ok: true as const };
    }),

  arquivar: adminProcedure
    .input(z.object({ id: z.number().int().positive(), arquivada: z.boolean() }))
    .mutation(async ({ input }) => {
      const d = await banco();
      await d.update(emailRecebidos).set({ arquivada: input.arquivada, excluida: false }).where(eq(emailRecebidos.id, input.id));
      return { ok: true as const };
    }),

  /** Lixeira (restaurável). */
  excluir: adminProcedure
    .input(z.object({ id: z.number().int().positive(), excluida: z.boolean() }))
    .mutation(async ({ input }) => {
      const d = await banco();
      await d.update(emailRecebidos).set({ excluida: input.excluida }).where(eq(emailRecebidos.id, input.id));
      return { ok: true as const };
    }),

  /** Apaga de vez. Só para o que já está na lixeira. */
  excluirDeVez: adminProcedure.input(idInput).mutation(async ({ input }) => {
    const d = await banco();
    const [m] = await d.select({ excluida: emailRecebidos.excluida }).from(emailRecebidos).where(eq(emailRecebidos.id, input.id)).limit(1);
    if (!m) return { ok: true as const };
    if (!m.excluida) throw new TRPCError({ code: "BAD_REQUEST", message: "Mova para a lixeira antes de apagar de vez." });
    await d.delete(emailRecebidos).where(eq(emailRecebidos.id, input.id));
    return { ok: true as const };
  }),

  /** Traz do Resend o que o webhook não entregou. */
  sincronizar: adminProcedure.mutation(async () => {
    try {
      return await sincronizarCaixa();
    } catch (e) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: e instanceof Error ? e.message : "Falha ao buscar no Resend." });
    }
  }),

  /** Link de download do anexo. O do Resend expira, então é gerado na hora. */
  linkAnexo: adminProcedure
    .input(z.object({ id: z.number().int().positive(), anexoId: z.string().min(1).max(100) }))
    .mutation(async ({ input }) => {
      const m = await obterRecebido(input.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      if (!m.anexos.some((a) => a.id === input.anexoId)) throw new TRPCError({ code: "NOT_FOUND", message: "Anexo não encontrado." });
      const resend = exigirResend();
      const { data, error } = await resend.emails.receiving.attachments.get({ emailId: m.resendEmailId, id: input.anexoId });
      if (error || !data) throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível gerar o link do anexo agora." });
      return { url: data.download_url };
    }),

  /** Encaminha a mensagem original inteira (com anexos) para outro endereço. */
  encaminhar: adminProcedure
    .input(z.object({ id: z.number().int().positive(), para: z.string().trim().email() }))
    .mutation(async ({ input }) => {
      const m = await obterRecebido(input.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      const caixa = await caixaOuPadrao(m.caixaId);
      const resend = exigirResend();
      const { error } = await resend.emails.receiving.forward({
        emailId: m.resendEmailId,
        to: input.para,
        from: remetenteDaCaixa(caixa),
        passthrough: true,
      });
      if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: `Não foi possível encaminhar: ${error.message}` });
      return { ok: true as const };
    }),

  /** Responde a partir da caixa que recebeu a mensagem. */
  responder: adminProcedure
    .input(z.object({ id: z.number().int().positive(), corpo: z.string().trim().min(1).max(20000) }))
    .mutation(async ({ ctx, input }) => {
      const m = await obterRecebido(input.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      const caixa = await caixaOuPadrao(m.caixaId);

      const destino = extrairEndereco(m.remetente);
      const original = m.assunto || "";
      const assunto = /^re:/i.test(original) ? original : `Re: ${original || "sua mensagem"}`;
      const corpoOriginal = (m.corpoTexto || "").trim();

      const r = await enviarEmail({
        para: destino,
        assunto,
        de: remetenteDaCaixa(caixa),
        responderPara: enderecoCompleto(caixa),
        html: emailRespostaContato({
          corpo: input.corpo,
          ...assinaturaDa(caixa),
          citacao: corpoOriginal
            ? {
                remetente: m.remetente,
                data: new Date(m.recebidoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                corpo: corpoOriginal.slice(0, 8000),
              }
            : undefined,
        }),
      });
      if (!r.success) throw new TRPCError({ code: "BAD_GATEWAY", message: `Não foi possível enviar: ${r.error || "erro no Resend"}` });

      const d = await banco();
      await d.update(emailRecebidos).set({ respondida: true, lida: true }).where(eq(emailRecebidos.id, m.id));
      await d.insert(emailEnviados).values({
        mensagemOrigemId: m.id,
        destinatario: destino,
        assunto,
        corpo: input.corpo,
        resendId: r.id ?? null,
        enviadoPor: ctx.user.id,
        caixaId: caixa.id,
        remetente: enderecoCompleto(caixa),
      });
      return { ok: true as const };
    }),

  enviarNovo: adminProcedure
    .input(
      z.object({
        caixaId: z.number().int().positive().optional(),
        para: z.string().trim().email(),
        assunto: z.string().trim().min(1).max(300),
        corpo: z.string().trim().min(1).max(20000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const caixa = await caixaOuPadrao(input.caixaId);
      const r = await enviarEmail({
        para: input.para,
        assunto: input.assunto,
        de: remetenteDaCaixa(caixa),
        responderPara: enderecoCompleto(caixa),
        html: emailRespostaContato({ corpo: input.corpo, ...assinaturaDa(caixa) }),
      });
      if (!r.success) throw new TRPCError({ code: "BAD_GATEWAY", message: `Não foi possível enviar: ${r.error || "erro no Resend"}` });
      const d = await banco();
      await d.insert(emailEnviados).values({
        mensagemOrigemId: null,
        destinatario: input.para,
        assunto: input.assunto,
        corpo: input.corpo,
        resendId: r.id ?? null,
        enviadoPor: ctx.user.id,
        caixaId: caixa.id,
        remetente: enderecoCompleto(caixa),
      });
      return { ok: true as const };
    }),
});

/**
 * Caixa de e-mail do admin (/admin/emails). Ver server/caixaEmail.ts.
 */

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { emailEnviados, emailRecebidos } from "../../drizzle/schema";
import {
  contarNaoLidas,
  dominioCaixa,
  ensureCaixaSchema,
  extrairEndereco,
  listarEnviados,
  listarRecebidos,
  obterRecebido,
  sincronizarCaixa,
} from "../caixaEmail";
import { emailRespostaContato, enviarEmail, getResend, remetenteContato } from "../_core/email";
import { emailContato } from "../_core/emailLayout";

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

const idInput = z.object({ id: z.number().int().positive() });

export const caixaEmailRouter = router({
  /** Situação da configuração, para o painel explicar o que falta. */
  status: adminProcedure.query(() => ({
    resendConfigurado: !!process.env.RESEND_API_KEY,
    webhookAssinado: !!process.env.RESEND_WEBHOOK_SECRET,
    avisosPara: process.env.EMAIL_AVISOS_ADMIN || null,
    endereco: emailContato(),
    dominio: dominioCaixa(),
  })),

  listar: adminProcedure
    .input(z.object({ pasta: z.enum(["entrada", "arquivadas", "lixeira"]).default("entrada") }))
    .query(({ input }) => listarRecebidos(input.pasta)),

  listarEnviados: adminProcedure.query(() => listarEnviados()),

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
      const resend = exigirResend();
      const { error } = await resend.emails.receiving.forward({
        emailId: m.resendEmailId,
        to: input.para,
        from: remetenteContato(),
        passthrough: true,
      });
      if (error) throw new TRPCError({ code: "BAD_GATEWAY", message: `Não foi possível encaminhar: ${error.message}` });
      return { ok: true as const };
    }),

  responder: adminProcedure
    .input(z.object({ id: z.number().int().positive(), corpo: z.string().trim().min(1).max(20000) }))
    .mutation(async ({ ctx, input }) => {
      const m = await obterRecebido(input.id);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });

      const destino = extrairEndereco(m.remetente);
      const original = m.assunto || "";
      const assunto = /^re:/i.test(original) ? original : `Re: ${original || "sua mensagem"}`;
      const corpoOriginal = (m.corpoTexto || "").trim();

      const r = await enviarEmail({
        para: destino,
        assunto,
        de: remetenteContato(),
        responderPara: emailContato(),
        html: emailRespostaContato({
          corpo: input.corpo,
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
      });
      return { ok: true as const };
    }),

  enviarNovo: adminProcedure
    .input(
      z.object({
        para: z.string().trim().email(),
        assunto: z.string().trim().min(1).max(300),
        corpo: z.string().trim().min(1).max(20000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const r = await enviarEmail({
        para: input.para,
        assunto: input.assunto,
        de: remetenteContato(),
        responderPara: emailContato(),
        html: emailRespostaContato({ corpo: input.corpo }),
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
      });
      return { ok: true as const };
    }),
});

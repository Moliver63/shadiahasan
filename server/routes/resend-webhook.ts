/**
 * resend-webhook.ts — e-mail recebido em contato@shadiahasan.com
 * Localização: server/routes/resend-webhook.ts
 *
 * POST /api/webhooks/resend (evento `email.received` cadastrado no Resend)
 *  - Com RESEND_WEBHOOK_SECRET, valida a assinatura (Svix) sobre o corpo CRU.
 *    Por isso a rota é montada ANTES do express.json() em _core/index.ts.
 *  - Sem o segredo, aceita mesmo assim: o payload só traz o id, e o conteúdo é
 *    sempre buscado na API do Resend com a nossa chave. Um POST forjado não
 *    consegue inserir mensagem inventada, no máximo pede um id que não existe.
 *  - Responde 200 rápido e importa depois; se falhar, "Buscar novas" no painel
 *    recupera (ver caixaEmail.ts).
 */

import express, { Router } from "express";
import { getResend } from "../_core/email";
import { avisarNovaMensagem, importarEmailRecebido } from "../caixaEmail";

const router = Router();

router.post("/webhooks/resend", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const bruto = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : "";
  let evento: any;

  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  if (segredo) {
    const resend = getResend();
    if (!resend) return res.sendStatus(200);
    try {
      evento = resend.webhooks.verify({
        payload: bruto,
        headers: {
          id: req.header("svix-id") ?? "",
          timestamp: req.header("svix-timestamp") ?? "",
          signature: req.header("svix-signature") ?? "",
        },
        webhookSecret: segredo,
      });
    } catch {
      console.warn("[Resend Webhook] assinatura inválida");
      return res.sendStatus(401);
    }
  } else {
    try {
      evento = JSON.parse(bruto || "{}");
    } catch {
      return res.sendStatus(400);
    }
  }

  res.sendStatus(200);

  const emailId = evento?.type === "email.received" ? evento?.data?.email_id : null;
  if (typeof emailId !== "string" || !emailId) return;

  try {
    const id = await importarEmailRecebido(emailId);
    if (id !== null) {
      console.log(`[Resend Webhook] mensagem recebida gravada (#${id})`);
      void avisarNovaMensagem(id);
    }
  } catch (e) {
    console.error("[Resend Webhook] falha ao importar:", e instanceof Error ? e.message : e);
  }
});

export default router;

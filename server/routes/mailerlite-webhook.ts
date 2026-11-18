/**
 * mailerlite-webhook.ts — cancelamento feito pelo link do rodapé do MailerLite
 * Localização: server/routes/mailerlite-webhook.ts
 *
 * POST /api/webhooks/mailerlite (evento `subscriber.unsubscribed` cadastrado no MailerLite)
 *  - Exige MAILERLITE_WEBHOOK_SECRET e valida a assinatura (HMAC-SHA256 do corpo CRU,
 *    cabeçalho Signature). Sem o segredo, recusa: um POST forjado poderia cancelar
 *    a inscrição de qualquer pessoa.
 *  - Montada ANTES do express.json() em _core/index.ts (precisa do corpo cru).
 *  - Só cancela; nunca inscreve ninguém por aqui.
 */
import express, { Router } from "express";
import { assinaturaValida, descadastrarPorEmails, emailsCancelados } from "../mailerlite";

const router = Router();

router.post("/webhooks/mailerlite", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const segredo = process.env.MAILERLITE_WEBHOOK_SECRET?.trim();
  if (!segredo) return res.sendStatus(503);
  const bruto = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : "";
  if (!assinaturaValida(bruto, req.header("signature"), segredo)) {
    console.warn("[MailerLite Webhook] assinatura inválida");
    return res.sendStatus(401);
  }
  let payload: any;
  try {
    payload = JSON.parse(bruto || "{}");
  } catch {
    return res.sendStatus(400);
  }
  try {
    const n = await descadastrarPorEmails(emailsCancelados(payload));
    if (n) console.log(`[MailerLite Webhook] ${n} cancelamento(s) gravado(s)`);
    res.sendStatus(200);
  } catch (e) {
    console.warn("[MailerLite Webhook] erro:", e instanceof Error ? e.message : e);
    res.sendStatus(500); // MailerLite tenta de novo
  }
});

export default router;

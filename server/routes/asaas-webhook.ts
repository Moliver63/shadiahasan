/**
 * asaas-webhook.ts — Endpoint de webhooks do Asaas
 * Localização: server/routes/asaas-webhook.ts
 *
 * POST /api/webhooks/asaas
 *  - autentica pelo header `asaas-access-token` (ASAAS_WEBHOOK_TOKEN)
 *  - grava o evento (idempotência pelo id) e responde 200 rápido
 *  - processa depois; falhas ficam registradas e são reprocessadas na subida do servidor
 */

import { Router } from "express";
import { timingSafeEqual } from "crypto";
import {
  getAsaasWebhookToken,
  processAsaasEvent,
  recordAsaasEvent,
  type AsaasWebhookBody,
} from "../asaas";

const router = Router();

function tokenMatches(received: unknown, expected: string): boolean {
  if (typeof received !== "string" || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post("/webhooks/asaas", async (req, res) => {
  const expected = getAsaasWebhookToken();
  if (!expected) {
    console.error("[Asaas Webhook] ASAAS_WEBHOOK_TOKEN não configurado");
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!tokenMatches(req.headers["asaas-access-token"], expected)) {
    console.warn("[Asaas Webhook] token inválido");
    return res.status(401).json({ error: "unauthorized" });
  }

  const body = req.body as AsaasWebhookBody;
  if (!body || typeof body !== "object" || !body.id || !body.event) {
    return res.status(400).json({ error: "invalid payload" });
  }

  try {
    const isNew = await recordAsaasEvent(body);
    // Responde já: o Asaas pausa a fila se receber erros ou demora
    res.status(200).json({ received: true, duplicate: !isNew });
    if (isNew) void processAsaasEvent(body);
  } catch (e) {
    console.error("[Asaas Webhook] falha ao registrar evento:", e instanceof Error ? e.message : e);
    // 500 → o Asaas reenvia; o evento ainda não foi gravado
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  }
});

export default router;

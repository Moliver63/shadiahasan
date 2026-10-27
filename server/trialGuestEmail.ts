/**
 * E-mail depois do pagamento da compra sem conta (ver trialGuest.ts).
 * A confirmação do e-mail acontece DEPOIS do pagamento, nunca antes: antes,
 * ela recolocaria a barreira que derrubava as vendas.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import * as db from "./db";
import { passwordResetTokens, users } from "../drizzle/schema";
import { hostCanonico } from "./_core/canonicalHost";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export async function enviarEmailDeAcesso(p: { userId: number; lessonId: number; contaNova: boolean }): Promise<void> {
  const d = await db.getDb();
  if (!d) return;
  const [user] = await d.select().from(users).where(eq(users.id, p.userId)).limit(1);
  if (!user?.email) return;

  const siteUrl = `https://${hostCanonico() || "shadiahasan.com"}`;
  let createPasswordUrl: string | null = null;
  if (p.contaNova && !user.passwordHash) {
    const token = crypto.randomUUID();
    await d.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await d.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt: new Date(Date.now() + SETE_DIAS_MS) });
    createPasswordUrl = `${siteUrl}/reset-password?token=${token}&novo=1`;
  }

  // O botão "Assistir à aula" já entra na conta (link de uso único): quem tem
  // conta pelo Google e está no navegador do Facebook, onde o Google bloqueia
  // o login, consegue assistir mesmo assim. Ver linkDeAcesso.ts.
  let lessonUrl = `${siteUrl}/lesson/${p.lessonId}`;
  try {
    const { criarLinkDeAcesso } = await import("./linkDeAcesso");
    const { token } = await criarLinkDeAcesso(user.id, `/lesson/${p.lessonId}`);
    lessonUrl = `${siteUrl}/api/auth/link?t=${encodeURIComponent(token)}`;
  } catch (e) {
    console.warn("[TrialGuest] link de acesso não criado; vai o link direto da aula:", e instanceof Error ? e.message : e);
  }

  const { sendTrialAccessEmail } = await import("./_core/email");
  const r = await sendTrialAccessEmail({
    email: user.email,
    name: user.name || "",
    siteUrl,
    lessonUrl,
    createPasswordUrl,
  });
  if (!r.success) console.warn(`[TrialGuest] e-mail de acesso falhou para usuário ${user.id}: ${r.error}`);
}

/**
 * Reenvia só o link de acesso (tela "pagamento confirmado" e tela de entrar).
 * Nunca diz se o e-mail tem conta: quem chama responde igual nos dois casos.
 */
export async function enviarLinkDeAcesso(p: { userId: number; destino: string }): Promise<boolean> {
  const d = await db.getDb();
  if (!d) return false;
  const [user] = await d.select().from(users).where(eq(users.id, p.userId)).limit(1);
  if (!user?.email || user.status === "suspended") return false;
  const { criarLinkDeAcesso, destinoSeguro } = await import("./linkDeAcesso");
  const siteUrl = `https://${hostCanonico() || "shadiahasan.com"}`;
  const { token } = await criarLinkDeAcesso(user.id, destinoSeguro(p.destino), 24 * 60 * 60 * 1000);
  const { sendLinkDeAcessoEmail } = await import("./_core/email");
  const r = await sendLinkDeAcessoEmail(user.email, user.name || "", `${siteUrl}/api/auth/link?t=${encodeURIComponent(token)}`);
  return r.success;
}

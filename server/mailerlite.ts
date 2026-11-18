/**
 * Espelho da lista de marketing no MailerLite (18/11/2026).
 *
 * Por que existe: as sequências e campanhas passam a poder rodar no MailerLite, mas a
 * autorização (LGPD) continua sendo dada e provada AQUI, em `marketingContatos`, com dupla
 * confirmação. O MailerLite só recebe quem já confirmou; nunca é a porta de entrada.
 *
 * Regras:
 *  - Sem MAILERLITE_API_KEY, não faz nada (o site funciona igual).
 *  - Só sincroniza origens que tenham grupo em MAILERLITE_GRUPOS (JSON origem -> id do grupo;
 *    a chave "*" vale para as demais). Ex.: {"autoavaliacao":"204468296120010379"}.
 *    Assim dá para ligar outra origem (ou outro cliente) só mudando a variável.
 *  - Confirmou aqui: cria/atualiza o inscrito como "active" no grupo da origem, com nome,
 *    perfil da autoavaliação e UTMs.
 *  - Cancelou aqui: marca "unsubscribed" lá.
 *  - Cancelou lá (link do rodapé do MailerLite): o webhook /api/webhooks/mailerlite marca
 *    o cancelamento aqui, para as campanhas do site também pararem.
 *  - Nunca bloqueia a pessoa: erro de rede ou da API vira só log.
 *
 * Funções puras no topo (testáveis sem rede nem banco).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import * as db from "./db";
import { garantirTabelasMarketing, linhasDe, normalizarEmail, tokenValido } from "./marketing";

const API = "https://connect.mailerlite.com/api";
const TEMPO_LIMITE_MS = 8000;

// ─── Regras puras ───────────────────────────────────────────────────────────

export type MapaGrupos = Record<string, string>;

/** Lê MAILERLITE_GRUPOS. JSON inválido ou ids não numéricos são ignorados. */
export function lerMapaGrupos(bruto: string | undefined | null): MapaGrupos {
  if (!bruto || !bruto.trim()) return {};
  try {
    const obj = JSON.parse(bruto);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const mapa: MapaGrupos = {};
    for (const [origem, id] of Object.entries(obj)) {
      const s = String(id ?? "").trim();
      if (/^\d+$/.test(s)) mapa[origem] = s;
    }
    return mapa;
  } catch {
    return {};
  }
}

/** Grupo da origem, ou o "*" se houver; null quando a origem não deve ir ao MailerLite. */
export function grupoDaOrigem(mapa: MapaGrupos, origem: string): string | null {
  return mapa[origem] ?? mapa["*"] ?? null;
}

export type ContatoSync = {
  email: string;
  nome: string | null;
  origem: string;
  perfil: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  confirmadoEm: Date | string | null;
};

/** Corpo do POST /subscribers (cria ou atualiza pelo e-mail). Campos vazios ficam de fora. */
export function montarInscrito(c: ContatoSync, grupo: string) {
  const fields: Record<string, string> = {};
  const nome = (c.nome ?? "").trim().split(/\s+/)[0];
  if (nome) fields.name = nome;
  fields.origem = c.origem;
  if (c.perfil) fields.perfil = c.perfil;
  if (c.utmSource) fields.utm_source = c.utmSource;
  if (c.utmCampaign) fields.utm_campaign = c.utmCampaign;
  if (c.utmTerm) fields.utm_term = c.utmTerm;
  const corpo: Record<string, unknown> = {
    email: normalizarEmail(c.email),
    fields,
    groups: [grupo],
    status: "active",
  };
  const quando = c.confirmadoEm ? new Date(c.confirmadoEm) : null;
  if (quando && !Number.isNaN(quando.getTime())) {
    // Formato aceito pela API: "AAAA-MM-DD HH:MM:SS" (UTC).
    corpo.opted_in_at = quando.toISOString().slice(0, 19).replace("T", " ");
  }
  return corpo;
}

/** Confere a assinatura do webhook (HMAC-SHA256 do corpo cru, em hex, no cabeçalho Signature). */
export function assinaturaValida(corpoCru: string, assinatura: string | undefined, segredo: string): boolean {
  if (!assinatura || !segredo) return false;
  const esperada = createHmac("sha256", segredo).update(corpoCru).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(assinatura.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** E-mails cancelados num payload de webhook (aceita envio simples e em lote). */
export function emailsCancelados(payload: any): string[] {
  const eventos: any[] = Array.isArray(payload?.events) ? payload.events : [payload];
  const saida = new Set<string>();
  for (const ev of eventos) {
    const tipo = String(ev?.type ?? ev?.event ?? payload?.type ?? "");
    if (tipo && tipo !== "subscriber.unsubscribed") continue;
    const email = ev?.subscriber?.email ?? ev?.data?.email ?? ev?.email;
    if (typeof email === "string" && email.includes("@")) saida.add(normalizarEmail(email));
  }
  return Array.from(saida);
}

// ─── Chamadas à API ─────────────────────────────────────────────────────────

function chave(): string | null {
  return process.env.MAILERLITE_API_KEY?.trim() || null;
}

async function chamar(caminho: string, corpo: unknown): Promise<boolean> {
  const k = chave();
  if (!k) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(`${API}${caminho}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const texto = await r.text().catch(() => "");
      console.warn(`[MailerLite] ${caminho} respondeu ${r.status}: ${texto.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[MailerLite] falha de rede:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function contatoPorTokenCompleto(token: string): Promise<(ContatoSync & { descadastradoEm: unknown }) | null> {
  if (!tokenValido(token) || !(await garantirTabelasMarketing())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const c = linhasDe(await d.execute(sql`
    SELECT "email","nome","origem","perfil","utmSource","utmCampaign","utmTerm","confirmadoEm","descadastradoEm"
    FROM "marketingContatos" WHERE "token" = ${token}
  `))[0];
  return c ?? null;
}

/** Depois da confirmação: envia o contato ao grupo da origem. Não lança erro. */
export async function sincronizarConfirmado(token: string): Promise<boolean> {
  try {
    if (!chave()) return false;
    const c = await contatoPorTokenCompleto(token);
    if (!c || !c.confirmadoEm || c.descadastradoEm) return false;
    const grupo = grupoDaOrigem(lerMapaGrupos(process.env.MAILERLITE_GRUPOS), c.origem);
    if (!grupo) return false;
    const ok = await chamar("/subscribers", montarInscrito(c, grupo));
    if (ok) console.log(`[MailerLite] contato confirmado enviado (origem ${c.origem})`);
    return ok;
  } catch (e) {
    console.warn("[MailerLite] sincronizarConfirmado:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Depois do cancelamento no site: marca como cancelado no MailerLite. Não lança erro. */
export async function sincronizarDescadastro(token: string): Promise<boolean> {
  try {
    if (!chave()) return false;
    const c = await contatoPorTokenCompleto(token);
    if (!c) return false;
    return await chamar("/subscribers", { email: normalizarEmail(c.email), status: "unsubscribed" });
  } catch (e) {
    console.warn("[MailerLite] sincronizarDescadastro:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Cancelamento que veio do MailerLite: grava aqui. Idempotente. Devolve quantos mudaram. */
export async function descadastrarPorEmails(emails: string[]): Promise<number> {
  if (!emails.length || !(await garantirTabelasMarketing())) return 0;
  const d = await db.getDb();
  if (!d) return 0;
  let n = 0;
  for (const email of emails) {
    const r = linhasDe(await d.execute(sql`
      UPDATE "marketingContatos" SET "descadastradoEm" = now()
      WHERE "email" = ${normalizarEmail(email)} AND "descadastradoEm" IS NULL
      RETURNING "id"
    `));
    n += r.length;
  }
  return n;
}

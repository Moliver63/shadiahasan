/**
 * caixaEmail.ts — caixa de e-mail do admin (contato@shadiahasan.com).
 *
 * Como chega: o Resend recebe o e-mail (MX do domínio) e
 *   1. avisa o site pelo webhook POST /api/webhooks/resend (email.received), e
 *   2. guarda a mensagem do lado dele, que o botão "Buscar novas" lista.
 * O webhook só traz metadados; o corpo é buscado pela API
 * (resend.emails.receiving.get) e gravado em `emailRecebidos`.
 *
 * O item 2 existe porque o Render pode estar dormindo quando o webhook chega:
 * nada se perde, a próxima busca traz o que faltou. Importar é idempotente
 * pelo id do Resend.
 */

import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import * as db from "./db";
import { emailEnviados, emailRecebidos } from "../drizzle/schema";
import { getResend } from "./_core/email";

export type Anexo = { id: string; filename: string; size: number; contentType: string };

let schemaPronto: Promise<boolean> | null = null;

export function ensureCaixaSchema(): Promise<boolean> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "emailRecebidos" (
            "id" serial PRIMARY KEY,
            "resendEmailId" varchar(100) NOT NULL UNIQUE,
            "remetente" varchar(320) NOT NULL,
            "destinatario" text,
            "assunto" varchar(500),
            "corpoTexto" text,
            "corpoHtml" text,
            "anexos" text,
            "lida" boolean NOT NULL DEFAULT false,
            "respondida" boolean NOT NULL DEFAULT false,
            "arquivada" boolean NOT NULL DEFAULT false,
            "excluida" boolean NOT NULL DEFAULT false,
            "recebidoEm" timestamp NOT NULL DEFAULT now(),
            "criadoEm" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "emailEnviados" (
            "id" serial PRIMARY KEY,
            "mensagemOrigemId" integer,
            "destinatario" varchar(320) NOT NULL,
            "assunto" varchar(500),
            "corpo" text NOT NULL,
            "resendId" varchar(100),
            "enviadoPor" integer,
            "criadoEm" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "emailRecebidos_recebidoEm_idx" ON "emailRecebidos" ("recebidoEm" DESC)`);
        return true;
      } catch (e) {
        console.error("[Caixa] falha ao criar tabelas:", e instanceof Error ? e.message : e);
        schemaPronto = null;
        return false;
      }
    })();
  }
  return schemaPronto;
}

/** Domínio cujas mensagens entram na caixa (a conta do Resend pode ter outros). */
export function dominioCaixa(): string {
  return (process.env.EMAIL_CAIXA_DOMINIO || "shadiahasan.com").toLowerCase();
}

function paraODominio(destinos: string[] | null | undefined): boolean {
  const dominio = `@${dominioCaixa()}`;
  return (destinos ?? []).some((t) => t.toLowerCase().replace(/>$/, "").trim().endsWith(dominio));
}

/** "Nome <email@x.com>" → "email@x.com". */
export function extrairEndereco(remetente: string): string {
  const m = remetente.match(/<([^>]+)>/);
  return (m ? m[1] : remetente).trim();
}

/**
 * Busca a mensagem no Resend e grava. Retorna o id local se for nova,
 * null se já existia, se é de outro domínio ou se falhou.
 */
export async function importarEmailRecebido(resendEmailId: string): Promise<number | null> {
  const resend = getResend();
  if (!resend || !(await ensureCaixaSchema())) return null;
  const d = await db.getDb();
  if (!d) return null;

  const [existe] = await d
    .select({ id: emailRecebidos.id })
    .from(emailRecebidos)
    .where(eq(emailRecebidos.resendEmailId, resendEmailId))
    .limit(1);
  if (existe) return null;

  const { data: email, error } = await resend.emails.receiving.get(resendEmailId);
  if (error || !email) {
    console.warn("[Caixa] não foi possível buscar o e-mail", resendEmailId, error?.message);
    return null;
  }
  if (!paraODominio(email.to)) return null;

  const anexos: Anexo[] = (email.attachments ?? []).map((a) => ({
    id: a.id,
    filename: a.filename || "arquivo",
    size: a.size,
    contentType: a.content_type,
  }));

  const [nova] = await d
    .insert(emailRecebidos)
    .values({
      resendEmailId,
      remetente: (email.from || "desconhecido").slice(0, 320),
      destinatario: (email.to ?? []).join(", "),
      assunto: (email.subject || "(sem assunto)").slice(0, 500),
      corpoTexto: email.text ?? null,
      corpoHtml: email.html ?? null,
      anexos: anexos.length ? JSON.stringify(anexos) : null,
      recebidoEm: email.created_at ? new Date(email.created_at) : new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: emailRecebidos.id });

  return nova?.id ?? null;
}

/** Avisa a equipe que chegou mensagem nova (se EMAIL_AVISOS_ADMIN estiver configurado). */
export async function avisarNovaMensagem(id: number) {
  try {
    if (!process.env.EMAIL_AVISOS_ADMIN) return;
    const d = await db.getDb();
    if (!d) return;
    const [m] = await d.select().from(emailRecebidos).where(eq(emailRecebidos.id, id)).limit(1);
    if (!m) return;
    const { enviarAvisoInterno } = await import("./_core/email");
    const { siteUrl } = await import("./_core/emailLayout");
    const previa = (m.corpoTexto || "").replace(/\s+/g, " ").trim().slice(0, 240);
    await enviarAvisoInterno(
      "Mensagem nova em contato@",
      [`De: ${m.remetente}`, `Assunto: ${m.assunto || "(sem assunto)"}`, previa].filter(Boolean),
      { texto: "Abrir a caixa de e-mail", url: `${siteUrl()}/admin/emails` },
    );
  } catch (e) {
    console.warn("[Caixa] aviso de mensagem nova falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * Traz do Resend o que o webhook não entregou. Percorre as mensagens mais
 * recentes e para quando encontra uma página inteira já importada.
 */
export async function sincronizarCaixa(maxPaginas = 3): Promise<{ novas: number; lidas: number }> {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY não configurada no servidor.");
  if (!(await ensureCaixaSchema())) throw new Error("Banco indisponível.");
  const d = await db.getDb();
  if (!d) throw new Error("Banco indisponível.");

  let novas = 0;
  let lidas = 0;
  let after: string | undefined;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const { data, error } = await resend.emails.receiving.list(after ? { limit: 50, after } : { limit: 50 });
    if (error || !data) throw new Error(error?.message || "Resend não respondeu.");
    const itens = data.data ?? [];
    lidas += itens.length;
    if (!itens.length) break;

    const ids = itens.filter((i) => paraODominio(i.to)).map((i) => i.id);
    const jaTem = ids.length
      ? await d
          .select({ id: emailRecebidos.resendEmailId })
          .from(emailRecebidos)
          .where(inArray(emailRecebidos.resendEmailId, ids))
      : [];
    const conhecidos = new Set(jaTem.map((r) => r.id));
    const faltam = ids.filter((id) => !conhecidos.has(id));

    for (const id of faltam) {
      if ((await importarEmailRecebido(id)) !== null) novas++;
    }

    // Página inteira já conhecida: o resto (mais antigo) também está.
    if (!faltam.length || !data.has_more) break;
    after = itens[itens.length - 1]?.id;
  }

  return { novas, lidas };
}

// ─── Consultas do painel ─────────────────────────────────────────────────────

export type Pasta = "entrada" | "arquivadas" | "lixeira";

export async function listarRecebidos(pasta: Pasta) {
  if (!(await ensureCaixaSchema())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const cond =
    pasta === "lixeira"
      ? eq(emailRecebidos.excluida, true)
      : pasta === "arquivadas"
        ? and(eq(emailRecebidos.arquivada, true), eq(emailRecebidos.excluida, false))
        : and(eq(emailRecebidos.arquivada, false), eq(emailRecebidos.excluida, false));

  // A lista não carrega o HTML (pode ser grande); ele vem em `obter`.
  const linhas = await d
    .select({
      id: emailRecebidos.id,
      remetente: emailRecebidos.remetente,
      assunto: emailRecebidos.assunto,
      previa: sql<string>`left(regexp_replace(coalesce(${emailRecebidos.corpoTexto}, ''), '\\s+', ' ', 'g'), 160)`,
      temAnexo: sql<boolean>`${emailRecebidos.anexos} is not null`,
      lida: emailRecebidos.lida,
      respondida: emailRecebidos.respondida,
      arquivada: emailRecebidos.arquivada,
      excluida: emailRecebidos.excluida,
      recebidoEm: emailRecebidos.recebidoEm,
    })
    .from(emailRecebidos)
    .where(cond)
    .orderBy(desc(emailRecebidos.recebidoEm))
    .limit(300);
  return linhas;
}

export async function obterRecebido(id: number) {
  if (!(await ensureCaixaSchema())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const [m] = await d.select().from(emailRecebidos).where(eq(emailRecebidos.id, id)).limit(1);
  if (!m) return null;
  let anexos: Anexo[] = [];
  try {
    anexos = m.anexos ? (JSON.parse(m.anexos) as Anexo[]) : [];
  } catch {
    anexos = [];
  }
  const respostas = await d
    .select()
    .from(emailEnviados)
    .where(eq(emailEnviados.mensagemOrigemId, id))
    .orderBy(emailEnviados.criadoEm);
  return { ...m, anexos, respostas };
}

export async function contarNaoLidas(): Promise<number> {
  if (!(await ensureCaixaSchema())) return 0;
  const d = await db.getDb();
  if (!d) return 0;
  const [{ total }] = await d
    .select({ total: count() })
    .from(emailRecebidos)
    .where(and(eq(emailRecebidos.lida, false), eq(emailRecebidos.arquivada, false), eq(emailRecebidos.excluida, false)));
  return Number(total);
}

export async function listarEnviados() {
  if (!(await ensureCaixaSchema())) return [];
  const d = await db.getDb();
  if (!d) return [];
  return d.select().from(emailEnviados).orderBy(desc(emailEnviados.criadoEm)).limit(300);
}

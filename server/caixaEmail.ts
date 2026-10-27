/**
 * caixaEmail.ts — caixas de e-mail do admin (contato@, financeiro@, rh@...).
 *
 * Como chega: o MX do domínio aponta para o Resend, que aceita QUALQUER
 * endereço @shadiahasan.com e
 *   1. avisa o site pelo webhook POST /api/webhooks/resend (email.received), e
 *   2. guarda a mensagem do lado dele, que o botão "Buscar novas" lista.
 * O webhook só traz metadados; o corpo é buscado pela API
 * (resend.emails.receiving.get) e gravado em `emailRecebidos`.
 *
 * Caixas por setor: cada linha de `emailCaixas` é um endereço (parte antes do
 * @). A mensagem entra na caixa que bate com o destinatário; se nenhuma bate,
 * vai para a caixa padrão. Criar uma caixa nova não exige mexer no DNS.
 *
 * O item 2 existe porque o Render pode estar dormindo quando o webhook chega:
 * nada se perde, a próxima busca traz o que faltou. Importar é idempotente
 * pelo id do Resend.
 */

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import * as db from "./db";
import { emailCaixas, emailEnviados, emailRecebidos } from "../drizzle/schema";
import { getResend } from "./_core/email";

export type Anexo = { id: string; filename: string; size: number; contentType: string };
export type Caixa = typeof emailCaixas.$inferSelect;

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
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "emailCaixas" (
            "id" serial PRIMARY KEY,
            "endereco" varchar(64) NOT NULL UNIQUE,
            "nome" varchar(80) NOT NULL,
            "nomeRemetente" varchar(120) NOT NULL,
            "copiaPara" varchar(320),
            "padrao" boolean NOT NULL DEFAULT false,
            "ordem" integer NOT NULL DEFAULT 0,
            "criadoEm" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`ALTER TABLE "emailRecebidos" ADD COLUMN IF NOT EXISTS "caixaId" integer`);
        await d.execute(sql`ALTER TABLE "emailEnviados" ADD COLUMN IF NOT EXISTS "caixaId" integer`);
        await d.execute(sql`ALTER TABLE "emailEnviados" ADD COLUMN IF NOT EXISTS "remetente" varchar(320)`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "emailRecebidos_recebidoEm_idx" ON "emailRecebidos" ("recebidoEm" DESC)`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "emailRecebidos_caixa_idx" ON "emailRecebidos" ("caixaId")`);

        // Primeira subida: cria a caixa padrão (contato@) e adota o que já chegou.
        const local = enderecoContatoLocal();
        await d.execute(sql`
          INSERT INTO "emailCaixas" ("endereco", "nome", "nomeRemetente", "padrao", "ordem")
          SELECT ${local}, 'Contato', 'Shadia Hasan', true, 0
          WHERE NOT EXISTS (SELECT 1 FROM "emailCaixas")
        `);
        await d.execute(sql`
          UPDATE "emailRecebidos" SET "caixaId" = (SELECT id FROM "emailCaixas" WHERE padrao ORDER BY id LIMIT 1)
          WHERE "caixaId" IS NULL
        `);
        await d.execute(sql`
          UPDATE "emailEnviados" SET "caixaId" = (SELECT id FROM "emailCaixas" WHERE padrao ORDER BY id LIMIT 1)
          WHERE "caixaId" IS NULL
        `);
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

/** Domínio cujas mensagens entram nas caixas (a conta do Resend pode ter outros). */
export function dominioCaixa(): string {
  return (process.env.EMAIL_CAIXA_DOMINIO || "shadiahasan.com").toLowerCase();
}

function enderecoContatoLocal(): string {
  const contato = (process.env.EMAIL_CONTATO || "contato@shadiahasan.com").toLowerCase();
  return contato.split("@")[0] || "contato";
}

/** "Nome <email@x.com>" → "email@x.com". */
export function extrairEndereco(remetente: string): string {
  const m = remetente.match(/<([^>]+)>/);
  return (m ? m[1] : remetente).trim();
}

/** Partes locais (antes do @) dos destinatários que são do nosso domínio. */
function locaisDoDominio(destinos: string[] | null | undefined): string[] {
  const dominio = `@${dominioCaixa()}`;
  return (destinos ?? [])
    .map((t) => extrairEndereco(t).toLowerCase())
    .filter((t) => t.endsWith(dominio))
    .map((t) => t.slice(0, -dominio.length));
}

/** Endereço completo de uma caixa. */
export function enderecoCompleto(caixa: Pick<Caixa, "endereco">): string {
  return `${caixa.endereco}@${dominioCaixa()}`;
}

/** "Financeiro · Shadia Hasan <financeiro@shadiahasan.com>" */
export function remetenteDaCaixa(caixa: Pick<Caixa, "endereco" | "nomeRemetente">): string {
  const nome = caixa.nomeRemetente.replace(/["<>]/g, "").trim() || "Shadia Hasan";
  return `${nome} <${enderecoCompleto(caixa)}>`;
}

// ─── Caixas ──────────────────────────────────────────────────────────────────

export async function listarCaixas(): Promise<Caixa[]> {
  if (!(await ensureCaixaSchema())) return [];
  const d = await db.getDb();
  if (!d) return [];
  return d.select().from(emailCaixas).orderBy(asc(emailCaixas.ordem), asc(emailCaixas.id));
}

export async function obterCaixa(id: number): Promise<Caixa | null> {
  const caixas = await listarCaixas();
  return caixas.find((c) => c.id === id) ?? null;
}

export async function caixaPadrao(): Promise<Caixa | null> {
  const caixas = await listarCaixas();
  return caixas.find((c) => c.padrao) ?? caixas[0] ?? null;
}

/** Escolhe a caixa pelo destinatário; sem correspondência, a padrão. */
async function caixaDoDestino(destinos: string[] | null | undefined): Promise<Caixa | null> {
  const caixas = await listarCaixas();
  const locais = locaisDoDominio(destinos);
  for (const local of locais) {
    // Aceita "financeiro+algo@" como financeiro@ (subendereço).
    const base = local.split("+")[0];
    const achou = caixas.find((c) => c.endereco === local || c.endereco === base);
    if (achou) return achou;
  }
  return caixas.find((c) => c.padrao) ?? caixas[0] ?? null;
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

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
  const destinos = [...(email.to ?? []), ...(email.cc ?? [])];
  if (!locaisDoDominio(destinos).length) return null;

  const caixa = await caixaDoDestino(destinos);
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
      caixaId: caixa?.id ?? null,
      recebidoEm: email.created_at ? new Date(email.created_at) : new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: emailRecebidos.id });

  if (nova && caixa?.copiaPara) void encaminharCopia(resendEmailId, caixa);
  return nova?.id ?? null;
}

/** Cópia automática para o e-mail pessoal do responsável pela caixa. */
async function encaminharCopia(resendEmailId: string, caixa: Caixa) {
  try {
    const destino = (caixa.copiaPara || "").trim();
    // Nunca para o próprio domínio: a cópia voltaria como mensagem nova, em laço.
    if (!destino || destino.toLowerCase().endsWith(`@${dominioCaixa()}`)) return;
    const resend = getResend();
    if (!resend) return;
    const { error } = await resend.emails.receiving.forward({
      emailId: resendEmailId,
      to: destino,
      from: remetenteDaCaixa(caixa),
      passthrough: true,
    });
    if (error) console.warn(`[Caixa] cópia para ${destino} falhou:`, error.message);
  } catch (e) {
    console.warn("[Caixa] cópia automática falhou:", e instanceof Error ? e.message : e);
  }
}

/** Avisa a equipe que chegou mensagem nova (se EMAIL_AVISOS_ADMIN estiver configurado). */
export async function avisarNovaMensagem(id: number) {
  try {
    if (!process.env.EMAIL_AVISOS_ADMIN) return;
    const d = await db.getDb();
    if (!d) return;
    const [m] = await d.select().from(emailRecebidos).where(eq(emailRecebidos.id, id)).limit(1);
    if (!m) return;
    const caixa = m.caixaId ? await obterCaixa(m.caixaId) : null;
    const { enviarAvisoInterno } = await import("./_core/email");
    const { siteUrl } = await import("./_core/emailLayout");
    const previa = (m.corpoTexto || "").replace(/\s+/g, " ").trim().slice(0, 240);
    await enviarAvisoInterno(
      `Mensagem nova em ${caixa ? enderecoCompleto(caixa) : "contato@"}`,
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

    const ids = itens.filter((i) => locaisDoDominio([...(i.to ?? []), ...(i.cc ?? [])]).length).map((i) => i.id);
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

/** caixaId ausente = todas as caixas. */
export async function listarRecebidos(pasta: Pasta, caixaId?: number | null) {
  if (!(await ensureCaixaSchema())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const condPasta =
    pasta === "lixeira"
      ? eq(emailRecebidos.excluida, true)
      : pasta === "arquivadas"
        ? and(eq(emailRecebidos.arquivada, true), eq(emailRecebidos.excluida, false))
        : and(eq(emailRecebidos.arquivada, false), eq(emailRecebidos.excluida, false));
  const cond = caixaId ? and(condPasta, eq(emailRecebidos.caixaId, caixaId)) : condPasta;

  // A lista não carrega o HTML (pode ser grande); ele vem em `obter`.
  return d
    .select({
      id: emailRecebidos.id,
      caixaId: emailRecebidos.caixaId,
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

/** Não lidas na entrada, por caixa. */
export async function contarNaoLidas(): Promise<{ total: number; porCaixa: Record<number, number> }> {
  if (!(await ensureCaixaSchema())) return { total: 0, porCaixa: {} };
  const d = await db.getDb();
  if (!d) return { total: 0, porCaixa: {} };
  const linhas = await d
    .select({ caixaId: emailRecebidos.caixaId, total: count() })
    .from(emailRecebidos)
    .where(and(eq(emailRecebidos.lida, false), eq(emailRecebidos.arquivada, false), eq(emailRecebidos.excluida, false)))
    .groupBy(emailRecebidos.caixaId);
  const porCaixa: Record<number, number> = {};
  let total = 0;
  for (const l of linhas) {
    const n = Number(l.total);
    total += n;
    if (l.caixaId) porCaixa[l.caixaId] = n;
  }
  return { total, porCaixa };
}

export async function listarEnviados(caixaId?: number | null) {
  if (!(await ensureCaixaSchema())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const q = d.select().from(emailEnviados);
  return (caixaId ? q.where(eq(emailEnviados.caixaId, caixaId)) : q).orderBy(desc(emailEnviados.criadoEm)).limit(300);
}

/** Antes de excluir uma caixa, as mensagens dela vão para a padrão. */
export async function moverMensagensParaPadrao(caixaId: number, padraoId: number) {
  const d = await db.getDb();
  if (!d) return;
  await d.update(emailRecebidos).set({ caixaId: padraoId }).where(eq(emailRecebidos.caixaId, caixaId));
  await d.update(emailEnviados).set({ caixaId: padraoId }).where(eq(emailEnviados.caixaId, caixaId));
}


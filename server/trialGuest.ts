/**
 * trialGuest.ts — Teste de 1 aula SEM conta: paga primeiro, a conta nasce depois.
 *
 * Por quê (25/10/2026, campanha 804): ~25 visitantes do anúncio chegaram à
 * oferta de R$ 19,90 e NENHUM passou da tela de login. O público é 55+, no
 * navegador do app do Facebook, onde o login com Google é bloqueado pelo
 * próprio Google (403 disallowed_useragent). Exigir conta antes do Pix
 * derrubava 100% das vendas.
 *
 * Fluxo:
 *   1. criarCompraDeConvidado → nome, e-mail e CPF numa tela só. Grava uma
 *      "compra pendente" (tabela trialGuestCheckouts), cria a cobrança no Asaas
 *      com externalReference "trialguest:<compraId>:<aulaId>" e devolve um
 *      token secreto que fica só no navegador de quem comprou.
 *      NENHUMA conta é criada aqui: robô que preenche o formulário e não paga
 *      não deixa conta nenhuma para trás.
 *   2. Pagamento confirmado (webhook, conferência periódica ou a conferência
 *      imediata do item 3) → processTrialEvent chama materializarCompra, que
 *      cria a conta (ou usa a que já existe com aquele e-mail) e o passe da
 *      aula. Daí em diante é o MESMO caminho do teste com conta: libera a
 *      aula, grava o financeiro e manda o Purchase para a Meta.
 *   3. statusDaCompra(token) → a tela de "aguardando Pix" pergunta a cada
 *      poucos segundos; se ainda pendente, pergunta ao Asaas na hora (não
 *      espera os 10 min da manutenção nem depende do webhook).
 *
 * Login automático, com as travas:
 *   - Só quando a CONTA FOI CRIADA por esta compra. E-mail que já tinha conta
 *     nunca entra sozinho: a pessoa precisa entrar com a senha ou o Google.
 *     Assim ninguém acessa a conta de outro digitando o e-mail dele.
 *   - A sessão é "provisória" (ver sessaoValidaPara em _core/sessionCookie):
 *     cai assim que alguém provar ser dono do e-mail (confirma pelo link,
 *     cria senha ou entra com Google).
 *
 * Chave liga/desliga: TRIAL_GUEST_CHECKOUT=off no Render volta ao fluxo antigo
 * (login antes de pagar). Sem a variável, fica ligado.
 */

import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import * as db from "./db";
import { lessons, trialPasses, users } from "../drizzle/schema";
import { asaasRequest, AsaasError, ensureAsaasSchema, isAsaasConfigured, todayInSaoPaulo } from "./asaas";
import { isValidCpfCnpj, onlyDigits } from "../shared/br-document";

// ─── Configuração e regras puras (testadas em trialGuest.test.ts) ────────────

export const GUEST_REF = /^trialguest:(\d+):(\d+)$/;

export function compraSemContaLigada(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.TRIAL_GUEST_CHECKOUT ?? "on").trim().toLowerCase() !== "off";
}

export function normalizarEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

/** Conferência de formato só; a prova de que o e-mail é da pessoa vem depois, pelo link. */
export function emailValido(email: string): boolean {
  const e = normalizarEmail(email);
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
}

/** "fulana.silva@gmail.com" → "fu•••••••@gmail.com". A tela mostra para a pessoa conferir. */
export function mascararEmail(email: string): string {
  const [nome, dominio] = normalizarEmail(email).split("@");
  if (!nome || !dominio) return "";
  return `${nome.slice(0, 2)}${"•".repeat(Math.max(3, nome.length - 2))}@${dominio}`;
}

export function hashDe(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Limite de tentativas em memória (por IP, por CPF, por e-mail). Simples de
 * propósito: o serviço roda numa instância só no Render. Se um dia escalar,
 * o limite por CPF/e-mail também é conferido no banco (contarRecentes).
 */
export function criarLimitador(limite: number, janelaMs: number) {
  const marcas = new Map<string, number[]>();
  return (chave: string, agora = Date.now()): boolean => {
    const recentes = (marcas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
    if (recentes.length >= limite) {
      marcas.set(chave, recentes);
      return false;
    }
    recentes.push(agora);
    marcas.set(chave, recentes);
    if (marcas.size > 5000) {
      // Evita crescer sem fim com IPs que não voltam
      marcas.forEach((ts, k) => { if (ts.every((t) => agora - t >= janelaMs)) marcas.delete(k); });
    }
    return true;
  };
}

const UMA_HORA = 60 * 60 * 1000;
const porIp = criarLimitador(6, UMA_HORA);
const porDocumento = criarLimitador(4, 24 * UMA_HORA);
const porEmail = criarLimitador(4, 24 * UMA_HORA);

export function dentroDoLimite(ip: string | null, cpfHash: string, email: string, agora = Date.now()): boolean {
  // Avalia os três sempre (não para no primeiro) para contar a tentativa em todos
  const a = porIp(`ip:${ip || "?"}`, agora);
  const b = porDocumento(`doc:${cpfHash}`, agora);
  const c = porEmail(`email:${email}`, agora);
  return a && b && c;
}

export type SituacaoDaCompra = "pendente" | "paga" | "cancelada";

/** O que a tela de "aguardando" deve fazer, a partir do que está gravado. */
export function decidirRetorno(c: {
  status: string;
  userId: number | null;
  userCreated: number;
  paidAt: Date | null;
}, agora = new Date()): { situacao: SituacaoDaCompra; entrarSozinho: boolean; precisaEntrar: boolean } {
  if (c.status === "cancelled" || c.status === "failed") return { situacao: "cancelada", entrarSozinho: false, precisaEntrar: false };
  if (c.status !== "paid" || !c.userId) return { situacao: "pendente", entrarSozinho: false, precisaEntrar: false };
  // Login automático só para a conta que esta compra criou, e só nas primeiras 48 h
  const recente = !!c.paidAt && agora.getTime() - c.paidAt.getTime() < 48 * UMA_HORA;
  const entrarSozinho = c.userCreated === 1 && recente;
  return { situacao: "paga", entrarSozinho, precisaEntrar: !entrarSozinho };
}

// ─── Tabela ──────────────────────────────────────────────────────────────────

export const trialGuestCheckouts = pgTable("trialGuestCheckouts", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  cpfHash: varchar("cpfHash", { length: 64 }).notNull(),
  lessonId: integer("lessonId").notNull(),
  courseId: integer("courseId").notNull(),
  asaasCustomerId: varchar("asaasCustomerId", { length: 64 }),
  asaasPaymentId: varchar("asaasPaymentId", { length: 64 }).unique(),
  invoiceUrl: text("invoiceUrl"),
  dueDate: varchar("dueDate", { length: 10 }),
  amountCents: integer("amountCents").notNull(),
  /** creating → pending → paid | cancelled | failed */
  status: varchar("status", { length: 16 }).notNull().default("creating"),
  remindersSent: integer("remindersSent").notNull().default(0),
  userId: integer("userId"),
  /** 1 quando a conta foi criada por esta compra (só então pode entrar sozinho) */
  userCreated: integer("userCreated").notNull().default(0),
  paidAt: timestamp("paidAt"),
  lastCheckAt: timestamp("lastCheckAt"),
  fbp: varchar("fbp", { length: 128 }),
  fbc: varchar("fbc", { length: 255 }),
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 191 }),
  utmContent: varchar("utmContent", { length: 191 }),
  landingUrl: text("landingUrl"),
  clientIp: varchar("clientIp", { length: 64 }),
  clientUserAgent: text("clientUserAgent"),
  ga4ClientId: varchar("ga4ClientId", { length: 32 }),
  ga4SessionId: varchar("ga4SessionId", { length: 24 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

let schemaPronto: Promise<boolean> | null = null;
export function ensureGuestSchema(): Promise<boolean> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "trialGuestCheckouts" (
            "id" serial PRIMARY KEY,
            "tokenHash" varchar(64) NOT NULL UNIQUE,
            "name" varchar(120) NOT NULL,
            "email" varchar(320) NOT NULL,
            "cpfHash" varchar(64) NOT NULL,
            "lessonId" integer NOT NULL,
            "courseId" integer NOT NULL,
            "asaasCustomerId" varchar(64),
            "asaasPaymentId" varchar(64) UNIQUE,
            "invoiceUrl" text,
            "dueDate" varchar(10),
            "amountCents" integer NOT NULL,
            "status" varchar(16) NOT NULL DEFAULT 'creating',
            "remindersSent" integer NOT NULL DEFAULT 0,
            "userId" integer,
            "userCreated" integer NOT NULL DEFAULT 0,
            "paidAt" timestamp,
            "lastCheckAt" timestamp,
            "fbp" varchar(128),
            "fbc" varchar(255),
            "utmSource" varchar(128),
            "utmMedium" varchar(128),
            "utmCampaign" varchar(191),
            "utmContent" varchar(191),
            "landingUrl" text,
            "clientIp" varchar(64),
            "clientUserAgent" text,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`ALTER TABLE "trialGuestCheckouts" ADD COLUMN IF NOT EXISTS "remindersSent" integer NOT NULL DEFAULT 0`);
        await d.execute(sql`ALTER TABLE "trialGuestCheckouts" ADD COLUMN IF NOT EXISTS "ga4ClientId" varchar(32), ADD COLUMN IF NOT EXISTS "ga4SessionId" varchar(24)`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "trialGuest_email_idx" ON "trialGuestCheckouts" ("email")`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "trialGuest_cpf_idx" ON "trialGuestCheckouts" ("cpfHash")`);
        return true;
      } catch (e) {
        console.error("[TrialGuest] schema init failed:", e instanceof Error ? e.message : e);
        schemaPronto = null;
        return false;
      }
    })();
  }
  return schemaPronto;
}

// ─── 1. Criar a compra ───────────────────────────────────────────────────────

export class CompraSemContaError extends Error {
  constructor(message: string, public code: "BAD_REQUEST" | "CONFLICT" | "PRECONDITION_FAILED" | "UNAVAILABLE" | "TOO_MANY_REQUESTS") {
    super(message);
    this.name = "CompraSemContaError";
  }
}

export type AtribuicaoDaCompra = {
  fbp?: string | null;
  fbc?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  landingUrl?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  ga4ClientId?: string | null;
  ga4SessionId?: string | null;
};

export type PixDaCompra = { imagemBase64: string; copiaECola: string } | null;

async function buscarPix(paymentId: string): Promise<PixDaCompra> {
  try {
    const r = await asaasRequest<{ encodedImage?: string; payload?: string }>("GET", `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
    return r?.payload ? { imagemBase64: r.encodedImage || "", copiaECola: r.payload } : null;
  } catch (e) {
    // Sem Pix na tela, a pessoa ainda paga pela fatura do Asaas
    console.warn("[TrialGuest] Pix indisponível para", paymentId, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function criarCompraDeConvidado(params: {
  nome: string;
  email: string;
  cpfCnpj: string;
  lessonId: number;
  origin: string;
  /** Regras de aula/preço vêm de trial.ts (injetadas pelo router, sem import circular) */
  aula: { precoCentavos: number; ehAulaDeEntrada: (lessonId: number) => Promise<boolean> };
  /** Conta já existente com este e-mail: já tem acesso / já usou o teste? (router decide) */
  contaExistente: (email: string, aula: { id: number; courseId: number; isAccessRestricted: number | null }) => Promise<{ jaTemAcesso: boolean; jaUsouTeste: boolean } | null>;
  atribuicao?: AtribuicaoDaCompra | null;
}): Promise<{ token: string; invoiceUrl: string; pix: PixDaCompra; emailMascarado: string; contaJaExiste: boolean }> {
  if (!compraSemContaLigada()) throw new CompraSemContaError("Compra sem conta desativada.", "PRECONDITION_FAILED");
  if (!isAsaasConfigured()) throw new CompraSemContaError("Pagamento indisponível no momento.", "PRECONDITION_FAILED");

  const nome = String(params.nome || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const email = normalizarEmail(params.email);
  const documento = onlyDigits(params.cpfCnpj);
  if (nome.length < 3) throw new CompraSemContaError("Digite seu nome completo.", "BAD_REQUEST");
  if (!emailValido(email)) throw new CompraSemContaError("E-mail inválido. Confira e tente de novo.", "BAD_REQUEST");
  if (!isValidCpfCnpj(documento)) throw new CompraSemContaError("CPF inválido. Confira os números e tente de novo.", "BAD_REQUEST");

  const cpfHash = hashDe(documento);
  if (!dentroDoLimite(params.atribuicao?.clientIp ?? null, cpfHash, email)) {
    throw new CompraSemContaError("Muitas tentativas seguidas. Aguarde um pouco e tente de novo.", "TOO_MANY_REQUESTS");
  }

  if (!(await ensureAsaasSchema()) || !(await ensureGuestSchema())) throw new CompraSemContaError("Banco indisponível. Tente de novo em instantes.", "UNAVAILABLE");
  const d = await db.getDb();
  if (!d) throw new CompraSemContaError("Banco indisponível.", "UNAVAILABLE");

  // Segunda barreira, no banco (sobrevive a reinício do servidor): 4 compras por CPF em 24 h
  const [{ n }] = (await d
    .select({ n: sql<number>`count(*)::int` })
    .from(trialGuestCheckouts)
    .where(and(eq(trialGuestCheckouts.cpfHash, cpfHash), sql`${trialGuestCheckouts.createdAt} > now() - interval '24 hours'`))) as Array<{ n: number }>;
  if (Number(n) >= 4) throw new CompraSemContaError("Muitas tentativas com este CPF hoje. Fale com a gente pelo WhatsApp.", "TOO_MANY_REQUESTS");

  const [lesson] = await d.select().from(lessons).where(eq(lessons.id, params.lessonId)).limit(1);
  if (!lesson || lesson.isPublished !== 1) throw new CompraSemContaError("Aula não encontrada.", "BAD_REQUEST");
  if (lesson.isAccessRestricted !== 1) throw new CompraSemContaError("Esta aula já é gratuita.", "BAD_REQUEST");
  if (!lesson.videoAssetId && !lesson.videoPlaybackUrl) throw new CompraSemContaError("Esta aula ainda não tem vídeo disponível.", "BAD_REQUEST");
  if (!(await params.aula.ehAulaDeEntrada(lesson.id))) throw new CompraSemContaError("Esta aula não faz parte do teste de 1 aula.", "BAD_REQUEST");

  const existente = await params.contaExistente(email, { id: lesson.id, courseId: lesson.courseId, isAccessRestricted: lesson.isAccessRestricted });
  if (existente?.jaTemAcesso) throw new CompraSemContaError("Este e-mail já tem acesso a esta aula. Entre na sua conta para assistir.", "CONFLICT");
  if (existente?.jaUsouTeste) throw new CompraSemContaError("Este e-mail já usou o teste de 1 aula. Entre na sua conta para conhecer os planos.", "CONFLICT");

  const token = gerarToken();
  const amountCents = params.aula.precoCentavos;
  const today = todayInSaoPaulo();
  const a = params.atribuicao || {};
  const [compra] = await d
    .insert(trialGuestCheckouts)
    .values({
      tokenHash: hashDe(token),
      name: nome,
      email,
      cpfHash,
      lessonId: lesson.id,
      courseId: lesson.courseId,
      amountCents,
      dueDate: today,
      status: "creating",
      fbp: a.fbp ?? null,
      fbc: a.fbc ?? null,
      utmSource: a.utmSource ?? null,
      utmMedium: a.utmMedium ?? null,
      utmCampaign: a.utmCampaign ?? null,
      utmContent: a.utmContent ?? null,
      landingUrl: a.landingUrl ?? null,
      clientIp: a.clientIp ?? null,
      clientUserAgent: a.clientUserAgent ?? null,
      ga4ClientId: a.ga4ClientId ?? null,
      ga4SessionId: a.ga4SessionId ?? null,
    })
    .returning();

  try {
    const customer = await asaasRequest<{ id: string }>("POST", "/customers", {
      name: nome,
      email,
      cpfCnpj: documento,
      externalReference: `guest:${compra.id}`,
    });
    const paymentBody: Record<string, unknown> = {
      customer: customer.id,
      billingType: "UNDEFINED",
      value: Number((amountCents / 100).toFixed(2)),
      dueDate: today,
      description: `Teste de 1 aula — Shadia Hasan: ${lesson.title}`.slice(0, 500),
      externalReference: `trialguest:${compra.id}:${lesson.id}`,
    };
    const successUrl = `${params.origin}/compra/aguardando`;
    let payment: { id: string; invoiceUrl?: string };
    try {
      payment = await asaasRequest("POST", "/payments", { ...paymentBody, callback: { successUrl, autoRedirect: false } });
    } catch (e) {
      if (e instanceof AsaasError && e.status === 400 && /callback|successUrl|dom[ií]nio/i.test(e.message)) {
        payment = await asaasRequest("POST", "/payments", paymentBody);
      } else {
        throw e;
      }
    }
    if (!payment.invoiceUrl) throw new Error("cobrança sem link de pagamento");

    await d
      .update(trialGuestCheckouts)
      .set({ asaasCustomerId: customer.id, asaasPaymentId: payment.id, invoiceUrl: payment.invoiceUrl, status: "pending", updatedAt: new Date() })
      .where(eq(trialGuestCheckouts.id, compra.id));

    console.log(`[TrialGuest] compra ${compra.id} criada: cobrança ${payment.id} aula ${lesson.id}${existente ? " (e-mail já tem conta)" : ""}`);
    return {
      token,
      invoiceUrl: payment.invoiceUrl,
      pix: await buscarPix(payment.id),
      emailMascarado: mascararEmail(email),
      contaJaExiste: !!existente,
    };
  } catch (e) {
    await d.update(trialGuestCheckouts).set({ status: "failed", updatedAt: new Date() }).where(eq(trialGuestCheckouts.id, compra.id));
    console.error(`[TrialGuest] falha ao criar cobrança da compra ${compra.id}:`, e instanceof Error ? e.message : e);
    if (e instanceof AsaasError && e.status === 400) {
      throw new CompraSemContaError(`O Asaas recusou os dados: ${e.message}`, "BAD_REQUEST");
    }
    throw new CompraSemContaError("Não foi possível gerar o pagamento agora. Tente de novo em instantes.", "UNAVAILABLE");
  }
}

// ─── 2. Pagamento confirmado: a conta nasce aqui ─────────────────────────────

function codigoDeIndicacao(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/**
 * Chamada por processTrialEvent quando o Asaas confirma o pagamento de uma
 * compra sem conta. Idempotente: webhook e conferência podem chegar juntos.
 * Devolve o usuário dono do passe, ou null se a compra não confere.
 */
export async function materializarCompra(compraId: number, paymentId: string): Promise<{ userId: number; lessonId: number; contaNova: boolean } | null> {
  if (!(await ensureGuestSchema())) throw new Error("schema da compra sem conta indisponível");
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  const [compra] = await d.select().from(trialGuestCheckouts).where(eq(trialGuestCheckouts.id, compraId)).limit(1);
  if (!compra || compra.asaasPaymentId !== paymentId) {
    console.warn(`[TrialGuest] compra ${compraId} não confere com a cobrança ${paymentId}`);
    return null;
  }

  let userId = compra.userId;
  let contaNova = compra.userCreated === 1;
  if (!userId) {
    const [jaExiste] = await d.select({ id: users.id }).from(users).where(eq(users.email, compra.email)).limit(1);
    if (jaExiste) {
      userId = jaExiste.id;
      contaNova = false;
    } else {
      const [criado] = await d
        .insert(users)
        .values({
          email: compra.email,
          name: compra.name,
          emailVerified: 0,
          loginMethod: "email",
          role: "user",
          plan: "free",
          referralCode: codigoDeIndicacao(),
        })
        .onConflictDoNothing()
        .returning({ id: users.id });
      if (criado) {
        userId = criado.id;
        contaNova = true;
        console.log(`[TrialGuest] conta ${criado.id} criada pela compra ${compra.id}`);
      } else {
        // Corrida: outra confirmação criou a mesma conta um instante antes
        const [outra] = await d.select({ id: users.id }).from(users).where(eq(users.email, compra.email)).limit(1);
        if (!outra) throw new Error("conta não criada");
        userId = outra.id;
        const [releitura] = await d.select().from(trialGuestCheckouts).where(eq(trialGuestCheckouts.id, compraId)).limit(1);
        contaNova = releitura?.userCreated === 1;
      }
    }
    await d
      .update(trialGuestCheckouts)
      .set({ userId, userCreated: contaNova ? 1 : 0, updatedAt: new Date() })
      .where(and(eq(trialGuestCheckouts.id, compra.id), sql`${trialGuestCheckouts.userId} IS NULL`));
  }

  // Passe pendente com a origem do visitante: o resto é o caminho de sempre
  await d
    .insert(trialPasses)
    .values({
      userId: userId!,
      lessonId: compra.lessonId,
      courseId: compra.courseId,
      asaasCustomerId: compra.asaasCustomerId || "",
      asaasPaymentId: paymentId,
      invoiceUrl: compra.invoiceUrl,
      dueDate: compra.dueDate,
      amountCents: compra.amountCents,
      status: "pending",
    })
    .onConflictDoNothing();
  try {
    await d.execute(sql`
      UPDATE "trialPasses" SET
        "fbp" = COALESCE("fbp", ${compra.fbp}),
        "fbc" = COALESCE("fbc", ${compra.fbc}),
        "utmSource" = COALESCE("utmSource", ${compra.utmSource}),
        "utmMedium" = COALESCE("utmMedium", ${compra.utmMedium}),
        "utmCampaign" = COALESCE("utmCampaign", ${compra.utmCampaign}),
        "utmContent" = COALESCE("utmContent", ${compra.utmContent}),
        "landingUrl" = COALESCE("landingUrl", ${compra.landingUrl}),
        "clientIp" = COALESCE("clientIp", ${compra.clientIp}),
        "clientUserAgent" = COALESCE("clientUserAgent", ${compra.clientUserAgent}),
        "ga4ClientId" = COALESCE("ga4ClientId", ${compra.ga4ClientId}),
        "ga4SessionId" = COALESCE("ga4SessionId", ${compra.ga4SessionId})
      WHERE "asaasPaymentId" = ${paymentId}
    `);
  } catch (e) {
    console.warn("[TrialGuest] atribuição não copiada:", e instanceof Error ? e.message : e);
  }
  return { userId: userId!, lessonId: compra.lessonId, contaNova };
}

/** Marca a compra como paga (depois que o passe foi ativado) e dispara o e-mail de acesso. */
export async function concluirCompra(paymentId: string): Promise<void> {
  const d = await db.getDb();
  if (!d) return;
  const [compra] = await d.select().from(trialGuestCheckouts).where(eq(trialGuestCheckouts.asaasPaymentId, paymentId)).limit(1);
  if (!compra || compra.status === "paid") return;
  await d
    .update(trialGuestCheckouts)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(trialGuestCheckouts.id, compra.id), sql`${trialGuestCheckouts.status} <> 'paid'`));
  // E-mail nunca atrapalha a venda: a aula já está liberada
  try {
    const { enviarEmailDeAcesso } = await import("./trialGuestEmail");
    await enviarEmailDeAcesso({ userId: compra.userId!, lessonId: compra.lessonId, contaNova: compra.userCreated === 1 });
  } catch (e) {
    console.warn("[TrialGuest] e-mail de acesso não enviado:", e instanceof Error ? e.message : e);
  }
}

export async function cancelarCompra(paymentId: string): Promise<void> {
  const d = await db.getDb();
  if (!d) return;
  await d
    .update(trialGuestCheckouts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(trialGuestCheckouts.asaasPaymentId, paymentId), eq(trialGuestCheckouts.status, "pending")));
}

// ─── 3. Tela de "aguardando": status + conferência imediata ──────────────────

const STATUS_PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);
const pixEmCache = new Map<string, PixDaCompra>();

export async function statusDaCompra(token: string, deps?: {
  consultar?: (paymentId: string) => Promise<{ status?: string; externalReference?: string; value?: number } & Record<string, any>>;
  liberar?: (body: any) => Promise<void>;
}): Promise<{
  situacao: SituacaoDaCompra;
  lessonId: number;
  invoiceUrl: string | null;
  pix: PixDaCompra;
  emailMascarado: string;
  entrarSozinho: { userId: number; email: string } | null;
  precisaEntrar: boolean;
  compra: { id: string; valorCentavos: number } | null;
} | null> {
  if (!token || token.length < 20 || !(await ensureGuestSchema())) return null;
  const d = await db.getDb();
  if (!d) return null;

  let [compra] = await d.select().from(trialGuestCheckouts).where(eq(trialGuestCheckouts.tokenHash, hashDe(token))).limit(1);
  if (!compra) return null;

  // Ainda pendente: pergunta ao Asaas agora (no máximo a cada 5 s por compra)
  const podeConferir = !compra.lastCheckAt || Date.now() - compra.lastCheckAt.getTime() > 5000;
  if (compra.status === "pending" && compra.asaasPaymentId && podeConferir) {
    await d.update(trialGuestCheckouts).set({ lastCheckAt: new Date() }).where(eq(trialGuestCheckouts.id, compra.id));
    try {
      const consultar = deps?.consultar ?? ((id: string) => asaasRequest("GET", `/payments/${encodeURIComponent(id)}`));
      const payment = await consultar(compra.asaasPaymentId);
      const st = String(payment?.status || "").toUpperCase();
      if (payment && STATUS_PAGO.has(st) && GUEST_REF.test(payment.externalReference || "")) {
        const liberar = deps?.liberar ?? (await import("./trial")).processTrialEvent;
        await liberar({
          id: `conferencia-imediata:${compra.asaasPaymentId}`,
          event: st === "CONFIRMED" ? "PAYMENT_CONFIRMED" : "PAYMENT_RECEIVED",
          payment: { ...payment, id: compra.asaasPaymentId },
        });
        [compra] = await d.select().from(trialGuestCheckouts).where(eq(trialGuestCheckouts.id, compra.id)).limit(1);
      }
    } catch (e) {
      console.warn(`[TrialGuest] conferência imediata falhou (compra ${compra.id}):`, e instanceof Error ? e.message : e);
    }
  }

  const r = decidirRetorno(compra);
  let pix: PixDaCompra = null;
  if (r.situacao === "pendente" && compra.asaasPaymentId) {
    if (!pixEmCache.has(compra.asaasPaymentId)) pixEmCache.set(compra.asaasPaymentId, await buscarPix(compra.asaasPaymentId));
    pix = pixEmCache.get(compra.asaasPaymentId) ?? null;
    if (pixEmCache.size > 500) pixEmCache.clear();
  }
  return {
    situacao: r.situacao,
    lessonId: compra.lessonId,
    invoiceUrl: compra.invoiceUrl,
    pix,
    emailMascarado: mascararEmail(compra.email),
    entrarSozinho: r.entrarSozinho && compra.userId ? { userId: compra.userId, email: compra.email } : null,
    precisaEntrar: r.precisaEntrar,
    /** Só depois de pago: a tela manda a compra ao GA4 (id da cobrança evita contar duas vezes). */
    compra: r.situacao === "paga" && compra.asaasPaymentId ? { id: compra.asaasPaymentId, valorCentavos: compra.amountCents } : null,
  };
}

/** Para a manutenção periódica: compras pendentes dos últimos 10 dias. */
export async function cobrancasPendentesDeConvidados(): Promise<Array<{ asaasPaymentId: string }>> {
  if (!(await ensureGuestSchema())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const rows = await d
    .select({ asaasPaymentId: trialGuestCheckouts.asaasPaymentId })
    .from(trialGuestCheckouts)
    .where(and(eq(trialGuestCheckouts.status, "pending"), isNotNull(trialGuestCheckouts.asaasPaymentId), sql`${trialGuestCheckouts.createdAt} > now() - interval '10 days'`))
    .orderBy(desc(trialGuestCheckouts.createdAt));
  return rows.filter((r): r is { asaasPaymentId: string } => !!r.asaasPaymentId);
}

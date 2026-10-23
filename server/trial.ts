/**
 * trial.ts — Teste pago de 1 aula (Asaas)
 * Localização: server/trial.ts
 *
 * O aluno paga um valor único (padrão R$ 19,90) e assiste 1 aula completa por alguns dias
 * (padrão 7). Se gostar, assina um plano. Não é assinatura e não libera mais nada além
 * daquela aula.
 *
 * Fluxo:
 *   1. createTrialCheckout → cria cobrança avulsa no Asaas (PIX, boleto ou cartão na fatura)
 *      com externalReference "trial:<userId>:<lessonId>" e devolve o link da fatura.
 *   2. webhook (asaas.ts → processTrialEvent) → PAYMENT_CONFIRMED/RECEIVED ativa o passe;
 *      REFUNDED/CHARGEBACK revogam; OVERDUE/DELETED cancelam um passe ainda pendente.
 *   3. hasActiveTrialPass → consultado por checkUserHasAccess (videos.ts).
 *
 * O acesso só é liberado pelo webhook — nunca pelo retorno do checkout.
 *
 * Variáveis opcionais (Render):
 *   TRIAL_PRICE_CENTS  preço do teste em centavos (padrão 1990; aceita 500 a 20000)
 *   TRIAL_VALID_DAYS   dias de acesso depois do pagamento (padrão 7; aceita 1 a 60)
 */

import { and, desc, eq, sql } from "drizzle-orm";
import * as db from "./db";
import { courses, lessons, paymentHistory, trialPasses, trialEntryLessons, asaasAccounts } from "../drizzle/schema";
import {
  AsaasError,
  asaasRequest,
  ensureAsaasSchema,
  isAsaasConfigured,
  todayInSaoPaulo,
  type AsaasWebhookBody,
} from "./asaas";
import { isValidCpfCnpj, onlyDigits } from "../shared/br-document";

// ─── Configuração ────────────────────────────────────────────────────────────

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function getTrialPriceCents(): number {
  return intFromEnv("TRIAL_PRICE_CENTS", 1990, 500, 20_000);
}

export function getTrialValidDays(): number {
  return intFromEnv("TRIAL_VALID_DAYS", 7, 1, 60);
}

// ─── Schema sob demanda ──────────────────────────────────────────────────────

let schemaReady: Promise<boolean> | null = null;

export function ensureTrialSchema(): Promise<boolean> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "trialPasses" (
            "id" serial PRIMARY KEY,
            "userId" integer NOT NULL,
            "lessonId" integer NOT NULL,
            "courseId" integer NOT NULL,
            "asaasCustomerId" varchar(64) NOT NULL,
            "asaasPaymentId" varchar(64) NOT NULL UNIQUE,
            "invoiceUrl" text,
            "dueDate" varchar(10),
            "amountCents" integer NOT NULL,
            "status" varchar(16) NOT NULL DEFAULT 'pending',
            "remindersSent" integer NOT NULL DEFAULT 0,
            "paidAt" timestamp,
            "expiresAt" timestamp,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "trialPasses_user_idx" ON "trialPasses" ("userId")`);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "trialEntryLessons" (
            "courseId" integer PRIMARY KEY,
            "lessonId" integer NOT NULL,
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        return true;
      } catch (e) {
        console.error("[Trial] schema init failed:", e instanceof Error ? e.message : e);
        schemaReady = null;
        return false;
      }
    })();
  }
  return schemaReady;
}

// ─── Aula de entrada por curso ───────────────────────────────────────────────

export type EntryLesson = {
  courseId: number;
  courseTitle: string;
  courseSlug: string;
  courseThumbnail: string | null;
  lessonId: number;
  lessonTitle: string;
  duration: number | null;
  source: "admin" | "auto";
};

/**
 * Uma aula de entrada por curso publicado. Vale a escolhida no painel; sem escolha (ou se a
 * escolhida deixou de servir), a primeira aula paga publicada e com vídeo do curso.
 */
export async function getEntryLessons(): Promise<EntryLesson[]> {
  const d = await db.getDb();
  if (!d) return [];
  await ensureTrialSchema();

  const sellable = await d
    .select({
      lessonId: lessons.id,
      courseId: lessons.courseId,
      lessonTitle: lessons.title,
      duration: lessons.duration,
      order: lessons.order,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      courseThumbnail: courses.thumbnail,
      courseOrder: courses.order,
    })
    .from(lessons)
    .innerJoin(courses, eq(courses.id, lessons.courseId))
    .where(and(
      eq(courses.isPublished, 1),
      eq(lessons.isPublished, 1),
      eq(lessons.isAccessRestricted, 1),
      sql`(${lessons.videoAssetId} IS NOT NULL OR ${lessons.videoPlaybackUrl} IS NOT NULL)`,
    ))
    .orderBy(courses.order, courses.id, lessons.order, lessons.id);

  let chosen = new Map<number, number>();
  try {
    const rows = await d.select().from(trialEntryLessons);
    chosen = new Map(rows.map((r) => [r.courseId, r.lessonId]));
  } catch { /* tabela ainda não existe: só o automático */ }

  const byCourse = new Map<number, typeof sellable>();
  for (const row of sellable) {
    const list = byCourse.get(row.courseId) ?? [];
    list.push(row);
    byCourse.set(row.courseId, list);
  }

  const result: EntryLesson[] = [];
  byCourse.forEach((list, courseId) => {
    const picked = list.find((l) => l.lessonId === chosen.get(courseId));
    const row = picked ?? list[0];
    result.push({
      courseId,
      courseTitle: row.courseTitle,
      courseSlug: row.courseSlug,
      courseThumbnail: row.courseThumbnail,
      lessonId: row.lessonId,
      lessonTitle: row.lessonTitle,
      duration: row.duration,
      source: picked ? "admin" : "auto",
    });
  });
  return result;
}

export type EntryDiagnosticsRow = {
  courseId: number;
  courseTitle: string;
  coursePublished: boolean;
  lessonsTotal: number;
  lessonsPublished: number;
  /** publicadas e restritas (exigem plano ou compra) */
  lessonsRestricted: number;
  /** publicadas, restritas e com vídeo: as que podem ser aula de entrada */
  lessonsEligible: number;
};

/** Admin: por que cada curso tem (ou não) aula de entrada. Só leitura. */
export async function getEntryDiagnostics(): Promise<EntryDiagnosticsRow[]> {
  const d = await db.getDb();
  if (!d) return [];
  const courseRows = await d
    .select({ id: courses.id, title: courses.title, isPublished: courses.isPublished, order: courses.order })
    .from(courses)
    .orderBy(courses.order, courses.id);
  const lessonRows = await d
    .select({
      courseId: lessons.courseId,
      isPublished: lessons.isPublished,
      isAccessRestricted: lessons.isAccessRestricted,
      hasVideo: sql<boolean>`(${lessons.videoAssetId} IS NOT NULL OR ${lessons.videoPlaybackUrl} IS NOT NULL)`,
    })
    .from(lessons);
  return courseRows.map((c) => {
    const own = lessonRows.filter((l) => l.courseId === c.id);
    const published = own.filter((l) => l.isPublished === 1);
    const restricted = published.filter((l) => l.isAccessRestricted === 1);
    return {
      courseId: c.id,
      courseTitle: c.title,
      coursePublished: c.isPublished === 1,
      lessonsTotal: own.length,
      lessonsPublished: published.length,
      lessonsRestricted: restricted.length,
      lessonsEligible: c.isPublished === 1 ? restricted.filter((l) => !!l.hasVideo).length : 0,
    };
  });
}

export async function isEntryLesson(lessonId: number): Promise<boolean> {
  return (await getEntryLessons()).some((e) => e.lessonId === lessonId);
}

/** Admin: define (ou limpa, com null) a aula de entrada de um curso. */
export async function setEntryLesson(courseId: number, lessonId: number | null): Promise<void> {
  if (!(await ensureTrialSchema())) throw new TrialError("Banco indisponível.", "UNAVAILABLE");
  const d = await db.getDb();
  if (!d) throw new TrialError("Banco indisponível.", "UNAVAILABLE");

  if (lessonId === null) {
    await d.delete(trialEntryLessons).where(eq(trialEntryLessons.courseId, courseId));
    return;
  }
  const [lesson] = await d.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.courseId !== courseId) throw new TrialError("A aula não pertence a este curso.", "BAD_REQUEST");
  if (lesson.isAccessRestricted !== 1) throw new TrialError("A aula de entrada precisa ser uma aula paga (as gratuitas já abrem para todos).", "BAD_REQUEST");
  if (lesson.isPublished !== 1) throw new TrialError("Publique a aula antes de usá-la como entrada.", "BAD_REQUEST");
  if (!lesson.videoAssetId && !lesson.videoPlaybackUrl) throw new TrialError("A aula ainda não tem vídeo.", "BAD_REQUEST");

  await d
    .insert(trialEntryLessons)
    .values({ courseId, lessonId })
    .onConflictDoUpdate({ target: trialEntryLessons.courseId, set: { lessonId, updatedAt: new Date() } });
}

/** Admin: qual é a aula de entrada de cada curso (e se foi escolhida ou automática). */
export async function getEntryLessonForCourse(courseId: number): Promise<{ lessonId: number | null; source: "admin" | "auto" | null }> {
  const entry = (await getEntryLessons()).find((e) => e.courseId === courseId);
  return entry ? { lessonId: entry.lessonId, source: entry.source } : { lessonId: null, source: null };
}

// ─── Acesso ──────────────────────────────────────────────────────────────────

/** O aluno tem um teste pago, dentro da validade, para esta aula? */
export async function hasActiveTrialPass(userId: number, lessonId: number): Promise<boolean> {
  try {
    if (!(await ensureTrialSchema())) return false;
    const d = await db.getDb();
    if (!d) return false;
    const [row] = await d
      .select({ id: trialPasses.id })
      .from(trialPasses)
      .where(and(
        eq(trialPasses.userId, userId),
        eq(trialPasses.lessonId, lessonId),
        eq(trialPasses.status, "active"),
        sql`${trialPasses.expiresAt} > now()`,
      ))
      .limit(1);
    return !!row;
  } catch (e) {
    console.warn("[Trial] falha ao checar passe:", e instanceof Error ? e.message : e);
    return false;
  }
}

export type TrialStatus = {
  enabled: boolean; // Asaas configurado
  priceCents: number;
  validDays: number;
  lessonEligible: boolean; // aula paga, publicada e com vídeo
  activePass: { expiresAt: string } | null; // passe vigente para ESTA aula
  alreadyUsed: boolean; // o aluno já fez (e pagou) um teste antes
};

export async function getTrialStatus(userId: number | null, lessonId: number): Promise<TrialStatus> {
  const status: TrialStatus = {
    enabled: isAsaasConfigured(),
    priceCents: getTrialPriceCents(),
    validDays: getTrialValidDays(),
    lessonEligible: false,
    activePass: null,
    alreadyUsed: false,
  };
  const d = await db.getDb();
  if (!d) return status;

  const [lesson] = await d.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  status.lessonEligible = !!lesson
    && lesson.isPublished === 1
    && lesson.isAccessRestricted === 1
    && !!(lesson.videoAssetId || lesson.videoPlaybackUrl)
    && (await isEntryLesson(lessonId)); // só a aula de entrada do curso vende no teste

  if (userId && (await ensureTrialSchema())) {
    const rows = await d
      .select({
        lessonId: trialPasses.lessonId,
        status: trialPasses.status,
        paidAt: trialPasses.paidAt,
        active: sql<boolean>`(${trialPasses.status} = 'active' AND ${trialPasses.expiresAt} > now())`,
        expiresAt: trialPasses.expiresAt,
      })
      .from(trialPasses)
      .where(eq(trialPasses.userId, userId));

    status.alreadyUsed = rows.some((r) => r.paidAt !== null && r.status !== "refunded" && r.status !== "cancelled");
    const current = rows.find((r) => r.lessonId === lessonId && r.active);
    if (current?.expiresAt) status.activePass = { expiresAt: new Date(current.expiresAt).toISOString() };
  }
  return status;
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export class TrialError extends Error {
  constructor(message: string, public code: "BAD_REQUEST" | "CONFLICT" | "PRECONDITION_FAILED" | "UNAVAILABLE") {
    super(message);
    this.name = "TrialError";
  }
}

export async function createTrialCheckout(params: {
  userId: number;
  userEmail: string;
  userName?: string | null;
  lessonId: number;
  cpfCnpj: string;
  origin: string;
  /** Já tem acesso por plano/compra? Injetado pelo router para evitar import circular. */
  alreadyHasAccess: boolean;
}): Promise<{ url: string; paymentId: string }> {
  if (!isAsaasConfigured()) throw new TrialError("Pagamento via Asaas não está disponível no momento.", "PRECONDITION_FAILED");
  if (!(await ensureAsaasSchema()) || !(await ensureTrialSchema())) throw new TrialError("Banco indisponível. Tente novamente em instantes.", "UNAVAILABLE");
  if (!isValidCpfCnpj(params.cpfCnpj)) throw new TrialError("CPF/CNPJ inválido. Confira os números e tente de novo.", "BAD_REQUEST");

  const d = await db.getDb();
  if (!d) throw new TrialError("Banco indisponível.", "UNAVAILABLE");

  const [lesson] = await d.select().from(lessons).where(eq(lessons.id, params.lessonId)).limit(1);
  if (!lesson || lesson.isPublished !== 1) throw new TrialError("Aula não encontrada.", "BAD_REQUEST");
  if (lesson.isAccessRestricted !== 1) throw new TrialError("Esta aula já é gratuita, não precisa pagar para assistir.", "BAD_REQUEST");
  if (!lesson.videoAssetId && !lesson.videoPlaybackUrl) throw new TrialError("Esta aula ainda não tem vídeo disponível.", "BAD_REQUEST");
  if (params.alreadyHasAccess) throw new TrialError("Você já tem acesso a esta aula pelo seu plano ou compra.", "CONFLICT");
  if (!(await isEntryLesson(lesson.id))) throw new TrialError("Esta aula não faz parte do teste de 1 aula. Escolha a aula de entrada do curso.", "BAD_REQUEST");

  const mine = await d.select().from(trialPasses).where(eq(trialPasses.userId, params.userId)).orderBy(desc(trialPasses.createdAt));

  // O teste vale uma vez por aluno; depois o caminho é assinar
  if (mine.some((p) => p.paidAt !== null && p.status !== "refunded" && p.status !== "cancelled")) {
    throw new TrialError("Você já usou o teste de 1 aula. Para continuar, assine um plano.", "CONFLICT");
  }

  // Cobrança pendente desta aula, criada hoje: reaproveita o link
  const today = todayInSaoPaulo();
  const reusable = mine.find((p) => p.status === "pending" && p.lessonId === lesson.id && p.dueDate === today && p.invoiceUrl);
  if (reusable?.invoiceUrl) return { url: reusable.invoiceUrl, paymentId: reusable.asaasPaymentId };

  // Cliente do Asaas: reaproveita o do aluno (teste anterior ou assinatura)
  let customerId = mine[0]?.asaasCustomerId;
  if (!customerId) {
    const [acc] = await d.select().from(asaasAccounts).where(eq(asaasAccounts.userId, params.userId)).orderBy(desc(asaasAccounts.createdAt)).limit(1);
    customerId = acc?.asaasCustomerId;
  }
  if (!customerId) {
    const customer = await asaasRequest<{ id: string }>("POST", "/customers", {
      name: params.userName?.trim() || params.userEmail.split("@")[0],
      email: params.userEmail,
      cpfCnpj: onlyDigits(params.cpfCnpj),
      externalReference: `user:${params.userId}`,
    });
    customerId = customer.id;
  }

  const amountCents = getTrialPriceCents();
  const paymentBody: Record<string, unknown> = {
    customer: customerId,
    billingType: "UNDEFINED", // o aluno escolhe PIX, boleto ou cartão na fatura
    value: Number((amountCents / 100).toFixed(2)),
    dueDate: today,
    description: `Teste de 1 aula — Shadia Hasan: ${lesson.title}`.slice(0, 500),
    externalReference: `trial:${params.userId}:${lesson.id}`,
  };

  const successUrl = `${params.origin}/checkout/success?provider=asaas&trial=1&lesson=${lesson.id}`;
  let payment: { id: string; invoiceUrl?: string };
  try {
    payment = await asaasRequest("POST", "/payments", { ...paymentBody, callback: { successUrl, autoRedirect: false } });
  } catch (e) {
    // successUrl precisa ser de um domínio cadastrado no Asaas; sem isso, cria sem redirecionamento
    if (e instanceof AsaasError && e.status === 400 && /callback|successUrl|dom[ií]nio/i.test(e.message)) {
      console.warn("[Trial] successUrl recusada; criando cobrança sem callback:", e.message);
      payment = await asaasRequest("POST", "/payments", paymentBody);
    } else {
      throw e;
    }
  }
  if (!payment.invoiceUrl) throw new TrialError("Cobrança criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.", "UNAVAILABLE");

  // Cobranças pendentes de outras aulas deixam de valer (evita pagar duas vezes por engano)
  for (const old of mine.filter((p) => p.status === "pending")) {
    try { await asaasRequest("DELETE", `/payments/${encodeURIComponent(old.asaasPaymentId)}`); } catch { /* já paga/removida */ }
    await d.update(trialPasses).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(trialPasses.id, old.id), eq(trialPasses.status, "pending")));
  }

  await d.insert(trialPasses).values({
    userId: params.userId,
    lessonId: lesson.id,
    courseId: lesson.courseId,
    asaasCustomerId: customerId,
    asaasPaymentId: payment.id,
    invoiceUrl: payment.invoiceUrl,
    dueDate: today,
    amountCents,
    status: "pending",
  });

  console.log(`[Trial] cobrança criada: ${payment.id} user ${params.userId} aula ${lesson.id}`);
  return { url: payment.invoiceUrl, paymentId: payment.id };
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

const TRIAL_REF = /^trial:(\d+):(\d+)$/;

export function isTrialEvent(body: AsaasWebhookBody): boolean {
  return TRIAL_REF.test(body.payment?.externalReference || "");
}

export async function processTrialEvent(body: AsaasWebhookBody): Promise<void> {
  if (!(await ensureTrialSchema())) throw new Error("schema do teste indisponível");
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");

  const payment = body.payment!;
  const match = TRIAL_REF.exec(payment.externalReference || "")!;
  const refUserId = Number(match[1]);
  const refLessonId = Number(match[2]);
  const paymentId = String(payment.id || "");
  if (!paymentId) throw new Error("evento sem id de cobrança");

  // Localiza o passe pela cobrança; se o registro local se perdeu, recria pelo externalReference
  let [pass] = await d.select().from(trialPasses).where(eq(trialPasses.asaasPaymentId, paymentId)).limit(1);
  if (!pass) {
    const [lesson] = await d.select().from(lessons).where(eq(lessons.id, refLessonId)).limit(1);
    if (!lesson || !payment.customer) { console.warn(`[Trial] ${body.event}: passe ${paymentId} não encontrado`); return; }
    const [created] = await d
      .insert(trialPasses)
      .values({
        userId: refUserId,
        lessonId: refLessonId,
        courseId: lesson.courseId,
        asaasCustomerId: payment.customer,
        asaasPaymentId: paymentId,
        amountCents: Math.round(Number(payment.value || 0) * 100),
        status: "pending",
      })
      .onConflictDoNothing()
      .returning();
    pass = created ?? (await d.select().from(trialPasses).where(eq(trialPasses.asaasPaymentId, paymentId)).limit(1))[0];
    if (!pass) return;
  }

  switch (body.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (pass.status === "refunded") return; // não reativa o que já foi estornado
      // Só libera se o valor pago cobre o preço do teste
      if (Math.round(Number(payment.value || 0) * 100) < pass.amountCents) {
        console.warn(`[Trial] valor pago (${payment.value}) menor que o do teste; ignorado: ${paymentId}`);
        return;
      }
      const firstActivation = pass.status !== "active";
      if (firstActivation) {
        const days = getTrialValidDays();
        await d
          .update(trialPasses)
          .set({
            status: "active",
            paidAt: sql`now()`,
            expiresAt: sql`now() + (${days} * interval '1 day')`,
            updatedAt: new Date(),
          })
          .where(eq(trialPasses.id, pass.id));
      }

      const key = `asaas:${paymentId}`;
      const [exists] = await d.select({ id: paymentHistory.id }).from(paymentHistory).where(eq(paymentHistory.stripeInvoiceId, key)).limit(1);
      if (!exists) {
        await db.createPaymentRecord({
          userId: pass.userId,
          amount: pass.amountCents, // centavos, como no restante do financeiro
          currency: "BRL",
          status: "completed",
          paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
          stripeInvoiceId: key, // coluna reaproveitada como chave de idempotência
          description: `Teste de 1 aula (Asaas) — aula ${pass.lessonId}`,
        });
      }
      console.log(`[Trial] passe ativo: user ${pass.userId} aula ${pass.lessonId}`);
      return;
    }

    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED": {
      await d.update(trialPasses).set({ status: "refunded", updatedAt: new Date() }).where(eq(trialPasses.id, pass.id));
      await d.update(paymentHistory).set({ status: "refunded" }).where(eq(paymentHistory.stripeInvoiceId, `asaas:${paymentId}`));
      return;
    }

    case "PAYMENT_OVERDUE":
    case "PAYMENT_DELETED": {
      // Só cancela o que ainda não foi pago
      await d
        .update(trialPasses)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(trialPasses.id, pass.id), eq(trialPasses.status, "pending")));
      return;
    }

    default:
      console.log(`[Trial] evento sem ação: ${body.event}`);
  }
}

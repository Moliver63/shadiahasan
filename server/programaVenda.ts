/**
 * programaVenda.ts — Venda avulsa de Programas (Asaas) e modelo comercial do site.
 * Localização: server/programaVenda.ts
 *
 * O que se vende é o Programa (`contentCollections`): é ele que o aluno vê na
 * vitrine. Comprar um Programa libera todas as aulas que estão nele, sem prazo,
 * pela tabela `programaCompras`. Assinatura e compra avulsa são direitos
 * independentes: `checkUserHasAccess` consulta os dois, e um não mexe no outro.
 *
 * Modelo comercial (`siteSettings.modeloComercial`):
 *   assinatura → como sempre: planos em /pricing. Não abre cobrança avulsa.
 *   avulso     → cada Programa com preço mostra "Quero começar" e tem checkout próprio.
 * Trocar o modelo NÃO cancela assinatura, não revoga compra e não altera cobrança.
 *
 * Fluxo da compra:
 *   1. criarCheckoutPrograma → cobrança única no Asaas, externalReference
 *      "programa:<userId>:<collectionId>", valor lido do banco (nunca do navegador).
 *   2. webhook (asaas.ts → processarEventoPrograma) → CONFIRMED/RECEIVED libera;
 *      REFUNDED/CHARGEBACK revogam SÓ esta compra; DELETED cancela a pendente.
 *   3. conferirComprasPendentes (rotina de 10 min) → rede de segurança do webhook.
 * O acesso nunca é liberado pela URL de retorno do checkout.
 */

import { eq, sql } from "drizzle-orm";
import * as db from "./db";
import { paymentHistory } from "../drizzle/schema";
import { AsaasError, asaasRequest, ensureAsaasSchema, isAsaasConfigured, todayInSaoPaulo, type AsaasWebhookBody } from "./asaas";
import { isValidCpfCnpj, onlyDigits } from "../shared/br-document";
import {
  BILLING_TYPE, MODELO_PADRAO, METODOS_PADRAO, MODELOS_COMERCIAIS, REF_PROGRAMA,
  formatarReais, lerRefPrograma, metodosAtivos, precoVendavel, refPrograma, validarPrecos,
  type MetodoPagamento, type MetodosAtivos, type ModeloComercial,
} from "../shared/comercial";

// ─── Schema sob demanda (idempotente, como o resto do projeto) ───────────────

let schemaPronto: Promise<boolean> | null = null;

/** Colunas comerciais do Programa. Também chamada pelo router de coleções. */
export async function garantirColunasComerciais(d: any): Promise<void> {
  await d.execute(sql`
    ALTER TABLE "contentCollections"
      ADD COLUMN IF NOT EXISTS "priceCents" integer,
      ADD COLUMN IF NOT EXISTS "originalPriceCents" integer,
      ADD COLUMN IF NOT EXISTS "headline" varchar(255),
      ADD COLUMN IF NOT EXISTS "salesDescription" text,
      ADD COLUMN IF NOT EXISTS "forWhom" text,
      ADD COLUMN IF NOT EXISTS "learnings" text,
      ADD COLUMN IF NOT EXISTS "ctaText" varchar(120)
  `);
}

export function garantirSchemaComercial(): Promise<boolean> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "siteSettings" (
            "key" varchar(64) PRIMARY KEY,
            "value" text NOT NULL,
            "updatedBy" integer,
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "siteSettingsHistory" (
            "id" serial PRIMARY KEY,
            "key" varchar(64) NOT NULL,
            "oldValue" text,
            "newValue" text NOT NULL,
            "changedBy" integer,
            "changedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "programaCompras" (
            "id" serial PRIMARY KEY,
            "userId" integer NOT NULL,
            "collectionId" integer NOT NULL,
            "origem" varchar(16) NOT NULL DEFAULT 'asaas',
            "asaasCustomerId" varchar(64),
            "asaasPaymentId" varchar(64) NOT NULL UNIQUE,
            "billingType" varchar(16),
            "invoiceUrl" text,
            "dueDate" varchar(10),
            "amountCents" integer NOT NULL,
            "status" varchar(16) NOT NULL DEFAULT 'pending',
            "paidAt" timestamp,
            "revokedAt" timestamp,
            "revokedReason" text,
            "grantedBy" integer,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "programaCompras_user_idx" ON "programaCompras" ("userId", "status")`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "programaCompras_col_idx" ON "programaCompras" ("collectionId")`);
        await garantirColunasComerciais(d);
        return true;
      } catch (e) {
        console.error("[Programa] schema init failed:", e instanceof Error ? e.message : e);
        schemaPronto = null;
        return false;
      }
    })();
  }
  return schemaPronto;
}

type Linhas<T> = { rows: T[] };
async function consulta<T = Record<string, any>>(query: ReturnType<typeof sql>): Promise<T[]> {
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");
  const r = (await d.execute(query)) as unknown as Linhas<T>;
  return r.rows ?? [];
}

// ─── Configurações (modelo comercial e formas de pagamento) ──────────────────

const CACHE_MS = 15_000;
let cache: { em: number; modelo: ModeloComercial; metodos: MetodosAtivos } | null = null;

export async function lerConfigComercial(): Promise<{ modelo: ModeloComercial; metodos: MetodosAtivos }> {
  if (cache && Date.now() - cache.em < CACHE_MS) return { modelo: cache.modelo, metodos: cache.metodos };
  let modelo: ModeloComercial = MODELO_PADRAO;
  let metodos: MetodosAtivos = { ...METODOS_PADRAO };
  try {
    if (await garantirSchemaComercial()) {
      const rows = await consulta<{ key: string; value: string }>(sql`SELECT "key", "value" FROM "siteSettings" WHERE "key" IN ('modeloComercial', 'metodosPagamentoAvulso')`);
      for (const r of rows) {
        if (r.key === "modeloComercial" && (MODELOS_COMERCIAIS as string[]).includes(r.value)) modelo = r.value as ModeloComercial;
        if (r.key === "metodosPagamentoAvulso") {
          try { metodos = metodosAtivos(JSON.parse(r.value)); } catch { /* valor antigo inválido: fica o padrão */ }
        }
      }
    }
  } catch (e) {
    // Falha de leitura nunca muda o modelo: cai no padrão (assinatura), que é o comportamento de sempre.
    console.warn("[Programa] não foi possível ler a configuração comercial:", e instanceof Error ? e.message : e);
  }
  cache = { em: Date.now(), modelo, metodos };
  return { modelo, metodos };
}

async function gravarConfig(chave: string, valor: string, adminId: number): Promise<void> {
  if (!(await garantirSchemaComercial())) throw new Error("Banco indisponível.");
  const d = await db.getDb();
  if (!d) throw new Error("Banco indisponível.");
  await d.transaction(async (tx) => {
    const atual = (await tx.execute(sql`SELECT "value" FROM "siteSettings" WHERE "key" = ${chave} FOR UPDATE`)) as unknown as Linhas<{ value: string }>;
    const antigo = atual.rows?.[0]?.value ?? null;
    if (antigo === valor) return;
    await tx.execute(sql`
      INSERT INTO "siteSettings" ("key", "value", "updatedBy", "updatedAt") VALUES (${chave}, ${valor}, ${adminId}, now())
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = now()
    `);
    await tx.execute(sql`INSERT INTO "siteSettingsHistory" ("key", "oldValue", "newValue", "changedBy") VALUES (${chave}, ${antigo}, ${valor}, ${adminId})`);
  });
  cache = null;
}

/** Só muda a vitrine e o checkout. Não toca em assinatura, compra ou cobrança existente. */
export async function definirModeloComercial(modelo: ModeloComercial, adminId: number): Promise<void> {
  if (!(MODELOS_COMERCIAIS as string[]).includes(modelo)) throw new Error("Modelo comercial inválido.");
  await gravarConfig("modeloComercial", modelo, adminId);
  console.log(`[Programa] modelo comercial → ${modelo} (admin ${adminId})`);
}

export async function definirMetodosPagamento(metodos: MetodosAtivos, adminId: number): Promise<void> {
  const m = metodosAtivos(metodos);
  if (!m.pix && !m.cartao && !m.boleto) throw new Error("Deixe ao menos uma forma de pagamento ligada.");
  await gravarConfig("metodosPagamentoAvulso", JSON.stringify(m), adminId);
}

export async function historicoConfig(): Promise<Array<{ key: string; oldValue: string | null; newValue: string; changedAt: string; adminNome: string | null }>> {
  if (!(await garantirSchemaComercial())) return [];
  return consulta(sql`
    SELECT h."key", h."oldValue", h."newValue", h."changedAt", u."name" AS "adminNome"
      FROM "siteSettingsHistory" h LEFT JOIN "users" u ON u."id" = h."changedBy"
     ORDER BY h."changedAt" DESC LIMIT 20
  `);
}

// ─── Programa à venda ─────────────────────────────────────────────────────────

export type ProgramaVenda = {
  id: number;
  title: string;
  isActive: number;
  priceCents: number | null;
  originalPriceCents: number | null;
};

async function lerPrograma(collectionId: number): Promise<ProgramaVenda | null> {
  const [p] = await consulta<ProgramaVenda>(sql`
    SELECT "id", "title", "isActive", "priceCents", "originalPriceCents"
      FROM "contentCollections" WHERE "id" = ${collectionId} LIMIT 1
  `);
  return p ?? null;
}

/** Admin: salva os preços (centavos) depois de validar no servidor. */
export async function salvarPrecosPrograma(collectionId: number, precoCentavos: number | null, originalCentavos: number | null): Promise<void> {
  const erro = validarPrecos(precoCentavos, originalCentavos);
  if (erro) throw new Error(erro);
  if (!(await garantirSchemaComercial())) throw new Error("Banco indisponível.");
  await consulta(sql`
    UPDATE "contentCollections" SET "priceCents" = ${precoCentavos}, "originalPriceCents" = ${originalCentavos}, "updatedAt" = now()
     WHERE "id" = ${collectionId}
  `);
}

// ─── Acesso ──────────────────────────────────────────────────────────────────

/**
 * O aluno comprou um Programa que contém esta aula? Vale mesmo que o Programa
 * tenha sido desativado depois (quem comprou não perde o que pagou).
 */
export async function temCompraDaAula(userId: number, lessonId: number): Promise<boolean> {
  try {
    if (!(await garantirSchemaComercial())) return false;
    const rows = await consulta(sql`
      SELECT 1 FROM "programaCompras" pc
        JOIN "contentCollectionItems" i ON i."collectionId" = pc."collectionId"
       WHERE pc."userId" = ${userId} AND pc."status" = 'active' AND i."lessonId" = ${lessonId}
       LIMIT 1
    `);
    return rows.length > 0;
  } catch (e) {
    console.warn("[Programa] falha ao checar compra:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Cursos cobertos por Programas comprados (não contam na cota do plano Básico). */
export async function cursosDosProgramasComprados(userId: number): Promise<Set<number>> {
  try {
    if (!(await garantirSchemaComercial())) return new Set();
    const rows = await consulta<{ courseId: number }>(sql`
      SELECT DISTINCT l."courseId" FROM "programaCompras" pc
        JOIN "contentCollectionItems" i ON i."collectionId" = pc."collectionId"
        JOIN "lessons" l ON l."id" = i."lessonId"
       WHERE pc."userId" = ${userId} AND pc."status" = 'active'
    `);
    return new Set(rows.map((r) => Number(r.courseId)));
  } catch {
    return new Set();
  }
}

export async function programasComprados(userId: number): Promise<number[]> {
  if (!(await garantirSchemaComercial())) return [];
  const rows = await consulta<{ collectionId: number }>(sql`
    SELECT DISTINCT "collectionId" FROM "programaCompras" WHERE "userId" = ${userId} AND "status" = 'active'
  `);
  return rows.map((r) => Number(r.collectionId));
}

export type CompraDoAluno = {
  id: number; collectionId: number; titulo: string; status: string; amountCents: number;
  invoiceUrl: string | null; dueDate: string | null; paidAt: string | null; createdAt: string;
};

export async function comprasDoAluno(userId: number): Promise<CompraDoAluno[]> {
  if (!(await garantirSchemaComercial())) return [];
  return consulta<CompraDoAluno>(sql`
    SELECT pc."id", pc."collectionId", c."title" AS "titulo", pc."status", pc."amountCents",
           pc."invoiceUrl", pc."dueDate", pc."paidAt", pc."createdAt"
      FROM "programaCompras" pc LEFT JOIN "contentCollections" c ON c."id" = pc."collectionId"
     WHERE pc."userId" = ${userId} AND pc."status" IN ('active', 'pending', 'refunded', 'revoked')
     ORDER BY pc."createdAt" DESC
  `);
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export class ProgramaError extends Error {
  constructor(message: string, public code: "BAD_REQUEST" | "CONFLICT" | "PRECONDITION_FAILED" | "UNAVAILABLE" | "NOT_FOUND") {
    super(message);
    this.name = "ProgramaError";
  }
}

async function clienteAsaasDoAluno(userId: number): Promise<string | null> {
  const de = async (q: ReturnType<typeof sql>) => (await consulta<{ c: string }>(q).catch(() => []))[0]?.c ?? null;
  return (
    (await de(sql`SELECT "asaasCustomerId" AS c FROM "programaCompras" WHERE "userId" = ${userId} AND "asaasCustomerId" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1`)) ??
    (await de(sql`SELECT "asaasCustomerId" AS c FROM "trialPasses" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 1`)) ??
    (await de(sql`SELECT "asaasCustomerId" AS c FROM "asaasAccounts" WHERE "userId" = ${userId} ORDER BY "createdAt" DESC LIMIT 1`))
  );
}

export async function criarCheckoutPrograma(params: {
  userId: number;
  userEmail: string;
  userName?: string | null;
  collectionId: number;
  cpfCnpj: string;
  metodo: MetodoPagamento;
  origin: string;
}): Promise<{ url: string; paymentId: string }> {
  if (!isAsaasConfigured()) throw new ProgramaError("Pagamento indisponível no momento.", "PRECONDITION_FAILED");
  if (!(await ensureAsaasSchema()) || !(await garantirSchemaComercial())) throw new ProgramaError("Banco indisponível. Tente de novo em instantes.", "UNAVAILABLE");

  const { modelo, metodos } = await lerConfigComercial();
  if (modelo !== "avulso") throw new ProgramaError("A compra individual não está disponível agora. Veja os planos de assinatura.", "PRECONDITION_FAILED");
  if (!metodos[params.metodo]) throw new ProgramaError("Esta forma de pagamento não está disponível.", "BAD_REQUEST");
  if (!isValidCpfCnpj(params.cpfCnpj)) throw new ProgramaError("CPF/CNPJ inválido. Confira os números e tente de novo.", "BAD_REQUEST");

  const programa = await lerPrograma(params.collectionId);
  if (!programa || programa.isActive !== 1) throw new ProgramaError("Programa não encontrado.", "NOT_FOUND");
  // Preço SEMPRE do banco; o navegador não manda valor.
  if (!precoVendavel(programa.priceCents)) throw new ProgramaError("Este programa ainda não está à venda.", "PRECONDITION_FAILED");
  const amountCents = programa.priceCents;

  const minhas = await consulta<{ id: number; status: string; asaasPaymentId: string; invoiceUrl: string | null; dueDate: string | null; amountCents: number; billingType: string | null }>(sql`
    SELECT "id", "status", "asaasPaymentId", "invoiceUrl", "dueDate", "amountCents", "billingType"
      FROM "programaCompras" WHERE "userId" = ${params.userId} AND "collectionId" = ${programa.id}
     ORDER BY "createdAt" DESC
  `);
  if (minhas.some((c) => c.status === "active")) throw new ProgramaError("Você já tem este programa. É só abrir a Minha Área.", "CONFLICT");

  // Cobrança pendente de hoje, mesmo valor e mesma forma: reaproveita o link (evita duas faturas)
  const hoje = todayInSaoPaulo();
  const billingType = BILLING_TYPE[params.metodo];
  const reaproveitavel = minhas.find((c) => c.status === "pending" && c.dueDate && c.dueDate >= hoje && c.invoiceUrl && c.amountCents === amountCents && c.billingType === billingType);
  if (reaproveitavel?.invoiceUrl) return { url: reaproveitavel.invoiceUrl, paymentId: reaproveitavel.asaasPaymentId };

  let customerId = await clienteAsaasDoAluno(params.userId);
  if (!customerId) {
    const customer = await asaasRequest<{ id: string }>("POST", "/customers", {
      name: params.userName?.trim() || params.userEmail.split("@")[0],
      email: params.userEmail,
      cpfCnpj: onlyDigits(params.cpfCnpj),
      externalReference: `user:${params.userId}`,
    });
    customerId = customer.id;
  }

  // Boleto precisa de prazo para compensar; Pix e cartão vencem hoje.
  const dueDate = params.metodo === "boleto" ? diasDepois(hoje, 3) : hoje;
  const corpo: Record<string, unknown> = {
    customer: customerId,
    billingType,
    value: Number((amountCents / 100).toFixed(2)),
    dueDate,
    description: `Programa ${programa.title} - Shadia Hasan`.slice(0, 500),
    externalReference: refPrograma(params.userId, programa.id),
  };
  const successUrl = `${params.origin}/checkout/success?provider=asaas&programa=${programa.id}`;
  let payment: { id: string; invoiceUrl?: string };
  try {
    payment = await asaasRequest("POST", "/payments", { ...corpo, callback: { successUrl, autoRedirect: false } });
  } catch (e) {
    if (e instanceof AsaasError && e.status === 400 && /callback|successUrl|dom[ií]nio/i.test(e.message)) {
      console.warn("[Programa] successUrl recusada; criando cobrança sem callback:", e.message);
      payment = await asaasRequest("POST", "/payments", corpo);
    } else {
      throw e;
    }
  }
  if (!payment.invoiceUrl) throw new ProgramaError("Cobrança criada, mas o link ainda não está disponível. Tente de novo em instantes.", "UNAVAILABLE");

  // Outras cobranças pendentes deste programa deixam de valer (não pagar duas vezes)
  for (const antiga of minhas.filter((c) => c.status === "pending")) {
    try { await asaasRequest("DELETE", `/payments/${encodeURIComponent(antiga.asaasPaymentId)}`); } catch { /* já paga ou removida */ }
    await consulta(sql`UPDATE "programaCompras" SET "status" = 'cancelled', "updatedAt" = now() WHERE "id" = ${antiga.id} AND "status" = 'pending'`);
  }

  await consulta(sql`
    INSERT INTO "programaCompras" ("userId", "collectionId", "origem", "asaasCustomerId", "asaasPaymentId", "billingType", "invoiceUrl", "dueDate", "amountCents", "status")
    VALUES (${params.userId}, ${programa.id}, 'asaas', ${customerId}, ${payment.id}, ${billingType}, ${payment.invoiceUrl}, ${dueDate}, ${amountCents}, 'pending')
    ON CONFLICT ("asaasPaymentId") DO NOTHING
  `);

  await db.upsertProviderPayment({
    userId: params.userId,
    amount: amountCents,
    currency: "BRL",
    status: "pending",
    paymentMethod: `asaas:${billingType.toLowerCase()}`,
    stripeInvoiceId: `asaas:${payment.id}`,
    providerStatus: "PAYMENT_CREATED",
    paymentUrl: payment.invoiceUrl,
    dueDate,
    planSlug: "programa",
    description: descricaoFinanceiro(programa.title),
  }).catch((e) => console.error("[Programa] cobrança pendente não registrada no financeiro:", e));

  console.log(`[Programa] cobrança criada: ${payment.id} user ${params.userId} programa ${programa.id} ${formatarReais(amountCents)}`);
  return { url: payment.invoiceUrl, paymentId: payment.id };
}

function diasDepois(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function descricaoFinanceiro(titulo: string | null | undefined): string {
  return `Programa ${titulo || ""} (Asaas)`.replace(/\s+/g, " ").trim();
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

export function ehEventoPrograma(body: AsaasWebhookBody): boolean {
  return REF_PROGRAMA.test(body.payment?.externalReference || "");
}

type Compra = { id: number; userId: number; collectionId: number; status: string; amountCents: number; invoiceUrl: string | null; dueDate: string | null; asaasCustomerId: string | null };

/**
 * Idempotente: CONFIRMED e RECEIVED da mesma cobrança liberam uma vez só, e
 * o financeiro usa a mesma chave `asaas:<id>` (upsert). Um evento repetido
 * já é barrado antes, em `recordAsaasEvent`.
 */
export async function processarEventoPrograma(body: AsaasWebhookBody): Promise<void> {
  if (!(await garantirSchemaComercial())) throw new Error("schema comercial indisponível");
  const payment = body.payment!;
  const paymentId = String(payment.id || "");
  if (!paymentId) throw new Error("evento sem id de cobrança");
  const ref = lerRefPrograma(payment.externalReference);
  if (!ref) return;

  let [compra] = await consulta<Compra>(sql`SELECT * FROM "programaCompras" WHERE "asaasPaymentId" = ${paymentId} LIMIT 1`);
  if (!compra) {
    // Registro local perdido: recria pelo externalReference (valor = o cobrado)
    await consulta(sql`
      INSERT INTO "programaCompras" ("userId", "collectionId", "origem", "asaasCustomerId", "asaasPaymentId", "billingType", "invoiceUrl", "dueDate", "amountCents", "status")
      VALUES (${ref.userId}, ${ref.collectionId}, 'asaas', ${payment.customer ?? null}, ${paymentId}, ${payment.billingType ?? null}, ${payment.invoiceUrl ?? null}, ${payment.dueDate ?? null}, ${Math.round(Number(payment.value || 0) * 100)}, 'pending')
      ON CONFLICT ("asaasPaymentId") DO NOTHING
    `);
    [compra] = await consulta<Compra>(sql`SELECT * FROM "programaCompras" WHERE "asaasPaymentId" = ${paymentId} LIMIT 1`);
    if (!compra) return;
  }
  const [prog] = await consulta<{ title: string }>(sql`SELECT "title" FROM "contentCollections" WHERE "id" = ${compra.collectionId}`).catch(() => []);
  const descricao = descricaoFinanceiro(prog?.title);
  const pago = Math.round(Number(payment.value || 0) * 100);

  switch (body.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (compra.status === "refunded" || compra.status === "revoked") return; // não reativa estorno nem revogação
      if (pago < compra.amountCents) {
        console.warn(`[Programa] valor pago (${payment.value}) menor que o cobrado; ignorado: ${paymentId}`);
        return;
      }
      // UPDATE condicional: só a primeira das chamadas concorrentes "ganha" a ativação
      const ativadas = await consulta(sql`
        UPDATE "programaCompras" SET "status" = 'active', "paidAt" = COALESCE("paidAt", now()), "updatedAt" = now()
         WHERE "id" = ${compra.id} AND "status" <> 'active' RETURNING "id"
      `);
      await db.upsertProviderPayment({
        userId: compra.userId,
        amount: pago,
        currency: "BRL",
        status: "completed",
        paymentMethod: `asaas${payment.billingType ? `:${payment.billingType.toLowerCase()}` : ""}`,
        stripeInvoiceId: `asaas:${paymentId}`,
        providerStatus: body.event,
        paymentUrl: payment.invoiceUrl || compra.invoiceUrl,
        dueDate: payment.dueDate || compra.dueDate,
        paidAt: payment.paymentDate ? new Date(`${payment.paymentDate.slice(0, 10)}T12:00:00-03:00`) : new Date(),
        refundedAmount: 0,
        planSlug: "programa",
        description: descricao,
      });
      if (ativadas.length > 0) {
        console.log(`[Programa] liberado: user ${compra.userId} programa ${compra.collectionId}`);
        await avisarCompraLiberada(compra, prog?.title ?? "seu programa", pago, payment.billingType);
      }
      return;
    }

    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED": {
      // Revoga SÓ esta compra. Assinatura e outras compras do aluno seguem como estão.
      await consulta(sql`
        UPDATE "programaCompras" SET "status" = 'refunded', "revokedAt" = now(), "revokedReason" = ${body.event}, "updatedAt" = now()
         WHERE "id" = ${compra.id}
      `);
      const d = await db.getDb();
      if (d) await d.update(paymentHistory).set({ status: "refunded", refundedAmount: compra.amountCents, providerStatus: body.event }).where(eq(paymentHistory.stripeInvoiceId, `asaas:${paymentId}`));
      return;
    }

    case "PAYMENT_OVERDUE":
    case "PAYMENT_DELETED": {
      // Só cancela o que não foi pago. Vencida fica pendente (boleto ainda pode compensar);
      // removida no Asaas vira cancelada.
      if (body.event === "PAYMENT_DELETED") {
        await consulta(sql`UPDATE "programaCompras" SET "status" = 'cancelled', "updatedAt" = now() WHERE "id" = ${compra.id} AND "status" = 'pending'`);
      }
      if (compra.status === "pending") {
        await db.upsertProviderPayment({
          userId: compra.userId,
          amount: compra.amountCents,
          currency: "BRL",
          status: body.event === "PAYMENT_DELETED" ? "failed" : "pending",
          paymentMethod: "asaas",
          stripeInvoiceId: `asaas:${paymentId}`,
          providerStatus: body.event,
          paymentUrl: payment.invoiceUrl || compra.invoiceUrl,
          dueDate: payment.dueDate || compra.dueDate,
          planSlug: "programa",
          description: descricao,
        });
      }
      return;
    }

    default:
      console.log(`[Programa] evento sem ação: ${body.event}`);
  }
}

/** E-mail ao aluno e aviso à equipe. Nunca lança: aviso não pode atrapalhar a liberação. */
async function avisarCompraLiberada(compra: Compra, titulo: string, centavos: number, billingType?: string): Promise<void> {
  try {
    const [u] = await consulta<{ name: string | null; email: string | null }>(sql`SELECT "name", "email" FROM "users" WHERE "id" = ${compra.userId}`);
    const { enviarEmail, enviarAvisoInterno } = await import("./_core/email");
    const L = await import("./_core/emailLayout");
    const url = `${L.siteUrl()}/collections/${compra.collectionId}`;
    if (u?.email) {
      const html = L.layoutEmail({
        departamento: "atendimento",
        preheader: `Pagamento confirmado. ${titulo} já está liberado.`,
        titulo: "Seu programa está liberado",
        corpo:
          L.p(L.saudacao(u.name)) +
          L.p(`Recebemos seu pagamento de ${L.formatarReais(centavos)}. O programa <strong>${L.escapar(titulo)}</strong> já está liberado na sua conta.`) +
          L.botao("Começar agora", url) +
          L.pequeno("Para assistir, entre com o mesmo e-mail desta compra. Todas as suas compras ficam na Minha Área."),
        motivo: "Você recebeu este e-mail porque comprou um programa em shadiahasan.com.",
      });
      await enviarEmail({ departamento: "atendimento", para: u.email, assunto: `Seu programa está liberado: ${titulo}`, html });
    }
    const forma = ({ PIX: "Pix", CREDIT_CARD: "Cartão", BOLETO: "Boleto" } as Record<string, string>)[String(billingType || "").toUpperCase()] || "Asaas";
    await enviarAvisoInterno(`[Painel] Venda confirmada: ${formatarReais(centavos)}`, [
      `Programa: ${titulo}`,
      `Aluno: ${u?.name || "(sem nome)"} <${u?.email || "sem e-mail"}>`,
      `Forma: ${forma}`,
    ], { texto: "Ver compras", url: `${L.siteUrl()}/admin/comercial` });
  } catch (e) {
    console.warn("[Programa] aviso da compra não enviado:", e instanceof Error ? e.message : e);
  }
}

// ─── Conferência ativa (rede de segurança do webhook) ────────────────────────

const STATUS_PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

/** Consulta no Asaas uma cobrança e, se paga, libera pelo mesmo caminho do webhook. */
export async function conferirCobranca(paymentId: string): Promise<"liberada" | "pendente" | "ignorada"> {
  const payment = await asaasRequest<NonNullable<AsaasWebhookBody["payment"]>>("GET", `/payments/${encodeURIComponent(paymentId)}`);
  if (!payment || !REF_PROGRAMA.test(payment.externalReference || "")) return "ignorada";
  const status = String(payment.status || "").toUpperCase();
  if (!STATUS_PAGO.has(status)) return "pendente";
  await processarEventoPrograma({
    id: `conferencia:${paymentId}`,
    event: status === "CONFIRMED" ? "PAYMENT_CONFIRMED" : "PAYMENT_RECEIVED",
    payment: { ...payment, id: paymentId },
  });
  return "liberada";
}

export async function conferirComprasPendentes(): Promise<number> {
  if (!isAsaasConfigured() || !(await garantirSchemaComercial())) return 0;
  const pendentes = await consulta<{ asaasPaymentId: string }>(sql`
    SELECT "asaasPaymentId" FROM "programaCompras"
     WHERE "status" = 'pending' AND "origem" = 'asaas' AND "createdAt" > now() - interval '10 days'
  `);
  let liberadas = 0;
  for (const { asaasPaymentId } of pendentes) {
    try {
      if ((await conferirCobranca(asaasPaymentId)) === "liberada") {
        liberadas++;
        console.log(`[Programa] conferência: ${asaasPaymentId} pago sem webhook; programa liberado`);
      }
    } catch (e) {
      console.warn(`[Programa] conferência falhou para ${asaasPaymentId}:`, e instanceof Error ? e.message : e);
    }
  }
  return liberadas;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export type CompraAdmin = {
  id: number; userId: number; nome: string | null; email: string | null; collectionId: number; programa: string | null;
  origem: string; status: string; amountCents: number; billingType: string | null; asaasPaymentId: string;
  invoiceUrl: string | null; dueDate: string | null; paidAt: string | null; createdAt: string; revokedReason: string | null;
};

export async function listarComprasAdmin(filtro: { collectionId?: number; status?: string; busca?: string }): Promise<CompraAdmin[]> {
  if (!(await garantirSchemaComercial())) return [];
  const busca = filtro.busca?.trim() ? `%${filtro.busca.trim()}%` : null;
  return consulta<CompraAdmin>(sql`
    SELECT pc."id", pc."userId", u."name" AS "nome", u."email", pc."collectionId", c."title" AS "programa",
           pc."origem", pc."status", pc."amountCents", pc."billingType", pc."asaasPaymentId", pc."invoiceUrl",
           pc."dueDate", pc."paidAt", pc."createdAt", pc."revokedReason"
      FROM "programaCompras" pc
      LEFT JOIN "users" u ON u."id" = pc."userId"
      LEFT JOIN "contentCollections" c ON c."id" = pc."collectionId"
     WHERE (${filtro.collectionId ?? null}::int IS NULL OR pc."collectionId" = ${filtro.collectionId ?? null}::int)
       AND (${filtro.status ?? null}::text IS NULL OR pc."status" = ${filtro.status ?? null}::text)
       AND (${busca}::text IS NULL OR u."email" ILIKE ${busca}::text OR u."name" ILIKE ${busca}::text)
     ORDER BY pc."createdAt" DESC
     LIMIT 300
  `);
}

export async function resumoPorPrograma(): Promise<Array<{ collectionId: number; programa: string; vendas: number; receitaCents: number; pendentes: number; estornos: number }>> {
  if (!(await garantirSchemaComercial())) return [];
  const rows = await consulta<any>(sql`
    SELECT c."id" AS "collectionId", c."title" AS "programa",
           COUNT(*) FILTER (WHERE pc."status" = 'active' AND pc."origem" = 'asaas') AS "vendas",
           COALESCE(SUM(pc."amountCents") FILTER (WHERE pc."status" = 'active' AND pc."origem" = 'asaas'), 0) AS "receitaCents",
           COUNT(*) FILTER (WHERE pc."status" = 'pending') AS "pendentes",
           COUNT(*) FILTER (WHERE pc."status" = 'refunded') AS "estornos"
      FROM "contentCollections" c LEFT JOIN "programaCompras" pc ON pc."collectionId" = c."id"
     GROUP BY c."id", c."title", c."order" ORDER BY c."order"
  `);
  return rows.map((r) => ({ ...r, vendas: Number(r.vendas), receitaCents: Number(r.receitaCents), pendentes: Number(r.pendentes), estornos: Number(r.estornos) }));
}

/** Liberação manual (cortesia, compra fora do site). Fica marcada como "manual", sem valor. */
export async function liberarManual(email: string, collectionId: number, adminId: number): Promise<void> {
  if (!(await garantirSchemaComercial())) throw new ProgramaError("Banco indisponível.", "UNAVAILABLE");
  const programa = await lerPrograma(collectionId);
  if (!programa) throw new ProgramaError("Programa não encontrado.", "NOT_FOUND");
  const [u] = await consulta<{ id: number }>(sql`SELECT "id" FROM "users" WHERE lower("email") = lower(${email.trim()}) LIMIT 1`);
  if (!u) throw new ProgramaError("Nenhuma conta com este e-mail. A pessoa precisa se cadastrar primeiro.", "NOT_FOUND");
  const userId = Number(u.id);
  if ((await programasComprados(userId)).includes(collectionId)) throw new ProgramaError("O aluno já tem este programa.", "CONFLICT");
  await consulta(sql`
    INSERT INTO "programaCompras" ("userId", "collectionId", "origem", "asaasPaymentId", "amountCents", "status", "paidAt", "grantedBy")
    VALUES (${userId}, ${collectionId}, 'manual', ${`manual:${userId}:${collectionId}:${Date.now()}`}, 0, 'active', now(), ${adminId})
  `);
}

/** Revogação manual. Não estorna nada no Asaas: estorno é feito no painel do Asaas. */
export async function revogarCompra(compraId: number, motivo: string, adminId: number): Promise<void> {
  if (!(await garantirSchemaComercial())) throw new ProgramaError("Banco indisponível.", "UNAVAILABLE");
  const r = await consulta(sql`
    UPDATE "programaCompras" SET "status" = 'revoked', "revokedAt" = now(),
           "revokedReason" = ${`${motivo.trim().slice(0, 300)} (admin ${adminId})`}, "updatedAt" = now()
     WHERE "id" = ${compraId} AND "status" = 'active' RETURNING "id"
  `);
  if (r.length === 0) throw new ProgramaError("Só dá para revogar uma compra ativa.", "CONFLICT");
}

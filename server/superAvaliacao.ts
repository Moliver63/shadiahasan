/**
 * Super Avaliação (R$ 15): devolutiva escrita por IA, no tom da Shadia, sobre as
 * respostas do Diário da Transformação. Vendida no fim do exercício grátis
 * (/diario) e dentro do diário do aluno (/presentes/diario).
 *
 * Fluxo: o navegador manda as respostas + nome, e-mail e CPF → cobrança no
 * Asaas (externalReference "avaliacao:<id>", Pix ou cartão) → webhook ou a
 * conferência de 10 min marcam como paga → a IA escreve → e-mail com o link.
 * O link é /avaliacao/<token>; o token fica guardado em texto porque precisa ir
 * no e-mail de "pronta" (as respostas, na mesma linha, também ficam em texto).
 *
 * Se a IA falhar 6 vezes seguidas, a cobrança é estornada no Asaas e a pessoa
 * recebe um e-mail avisando. Nunca fica pago sem entrega.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";
import { AsaasError, asaasRequest, ensureAsaasSchema, isAsaasConfigured, todayInSaoPaulo, type AsaasWebhookBody } from "./asaas";
import { isValidCpfCnpj, onlyDigits } from "../shared/br-document";
import { BILLING_TYPE, type MetodoPagamento } from "../shared/comercial";
import {
  PRECO_SUPER_AVALIACAO_CENTAVOS, REF_AVALIACAO, refAvaliacao, temMaterialSuficiente, temSinalDeRisco, lerDevolutiva,
  normalizarRespostas, type DevolutivaAvaliacao, type OrigemAvaliacao, type RespostaAvaliada,
} from "../shared/superAvaliacao";
import { ENV } from "./_core/env";

export class AvaliacaoError extends Error {
  constructor(message: string, public code: "BAD_REQUEST" | "UNAVAILABLE" | "PRECONDITION_FAILED" | "NOT_FOUND") {
    super(message);
  }
}

const MAX_TENTATIVAS = 6;
const STATUS_PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

let schemaPronto: Promise<boolean> | null = null;
export function garantirSchemaAvaliacao(): Promise<boolean> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "superAvaliacoes" (
            "id" serial PRIMARY KEY,
            "token" text NOT NULL UNIQUE,
            "userId" integer,
            "nome" text NOT NULL,
            "email" text NOT NULL,
            "cpfHash" text NOT NULL,
            "origem" text NOT NULL,
            "respostas" text NOT NULL,
            "status" text NOT NULL DEFAULT 'creating',
            "amountCents" integer NOT NULL,
            "billingType" text,
            "asaasCustomerId" text,
            "asaasPaymentId" text UNIQUE,
            "invoiceUrl" text,
            "devolutiva" text,
            "tentativas" integer NOT NULL DEFAULT 0,
            "ultimoErro" text,
            "paidAt" timestamp,
            "readyAt" timestamp,
            "createdAt" timestamp NOT NULL DEFAULT now(),
            "updatedAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "superAvaliacoes_user_idx" ON "superAvaliacoes" ("userId")`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "superAvaliacoes_status_idx" ON "superAvaliacoes" ("status")`);
        return true;
      } catch (e) {
        console.error("[SuperAvaliação] schema init failed:", e instanceof Error ? e.message : e);
        schemaPronto = null;
        return false;
      }
    })();
  }
  return schemaPronto;
}

async function consulta<T = Record<string, any>>(query: ReturnType<typeof sql>): Promise<T[]> {
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");
  const r = (await d.execute(query)) as unknown as { rows: T[] };
  return r.rows ?? [];
}

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Disponibilidade ────────────────────────────────────────────────────────

export async function configAvaliacao(): Promise<{ disponivel: boolean; precoCentavos: number; metodos: MetodoPagamento[] }> {
  const { lerConfigComercial } = await import("./programaVenda");
  const { metodos } = await lerConfigComercial().catch(() => ({ metodos: { pix: true, cartao: true, boleto: false } as Record<MetodoPagamento, boolean> }));
  // Boleto não entra: leva dias para compensar e a avaliação é entregue na hora
  const ativos = (["pix", "cartao"] as const).filter((m) => metodos[m]);
  return {
    disponivel: isAsaasConfigured() && Boolean(ENV.forgeApiKey) && ativos.length > 0,
    precoCentavos: PRECO_SUPER_AVALIACAO_CENTAVOS,
    metodos: ativos,
  };
}

/** Linha no log da subida: diz se a oferta aparece e, se não, o que falta. */
export async function registrarDisponibilidadeNoLog(): Promise<string> {
  const cfg = await configAvaliacao();
  const faltas: string[] = [];
  if (!isAsaasConfigured()) faltas.push("Asaas não configurado");
  if (!ENV.forgeApiKey) faltas.push("falta BUILT_IN_FORGE_API_KEY (chave da IA)");
  if (cfg.metodos.length === 0) faltas.push("Pix e cartão desligados em Configurações > Modelo de Comercialização");
  const linha = cfg.disponivel
    ? `[SuperAvaliação] disponível: ${(cfg.precoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, ${cfg.metodos.join(" e ")}, IA em ${ENV.forgeApiUrl ? "URL própria" : "endereço padrão"}`
    : `[SuperAvaliação] INDISPONÍVEL, o cartão não aparece no diário: ${faltas.join("; ")}`;
  (cfg.disponivel ? console.log : console.warn)(linha);
  return linha;
}

// ─── Compra ─────────────────────────────────────────────────────────────────

export async function criarSuperAvaliacao(params: {
  nome: string; email: string; cpfCnpj: string; metodo: MetodoPagamento; origem: OrigemAvaliacao;
  respostas: unknown; userId?: number | null; origin: string; ip?: string | null;
}): Promise<{ token: string; invoiceUrl: string; pix: { imagemBase64: string; copiaECola: string } | null }> {
  const g = await import("./trialGuest");
  const cfg = await configAvaliacao();
  if (!cfg.disponivel) throw new AvaliacaoError("A Super Avaliação está indisponível no momento.", "PRECONDITION_FAILED");
  if (!cfg.metodos.includes(params.metodo)) throw new AvaliacaoError("Forma de pagamento indisponível.", "BAD_REQUEST");
  if (params.origem !== "amostra" && params.origem !== "diario") throw new AvaliacaoError("Origem inválida.", "BAD_REQUEST");
  if (!(await ensureAsaasSchema()) || !(await garantirSchemaAvaliacao())) throw new AvaliacaoError("Banco indisponível. Tente de novo em instantes.", "UNAVAILABLE");

  const nome = String(params.nome || "").trim().replace(/\s+/g, " ").slice(0, 120);
  const email = g.normalizarEmail(params.email);
  const documento = onlyDigits(params.cpfCnpj);
  if (nome.length < 3 || nome.split(" ").length < 2) throw new AvaliacaoError("Digite nome e sobrenome.", "BAD_REQUEST");
  if (!g.emailValido(email)) throw new AvaliacaoError("E-mail inválido. Confira e tente de novo.", "BAD_REQUEST");
  if (!isValidCpfCnpj(documento)) throw new AvaliacaoError("CPF inválido. Confira os números.", "BAD_REQUEST");

  const respostas = normalizarRespostas(params.respostas);
  if (!temMaterialSuficiente(params.origem, respostas)) {
    throw new AvaliacaoError("Escreva um pouco mais antes de pedir a avaliação: ela precisa das suas respostas para ter o que ler.", "BAD_REQUEST");
  }

  const cpfHash = g.hashDe(documento);
  if (!g.dentroDoLimite(params.ip ?? null, cpfHash, email)) throw new AvaliacaoError("Muitas tentativas seguidas. Aguarde um pouco e tente de novo.", "BAD_REQUEST");
  const [{ n }] = await consulta<{ n: number }>(sql`SELECT count(*)::int AS n FROM "superAvaliacoes" WHERE "cpfHash" = ${cpfHash} AND "createdAt" > now() - interval '24 hours'`);
  if (Number(n) >= 5) throw new AvaliacaoError("Muitos pedidos com este CPF hoje. Tente amanhã ou fale com a gente pelo WhatsApp.", "BAD_REQUEST");

  const token = g.gerarToken();
  const billingType = BILLING_TYPE[params.metodo];
  const valor = PRECO_SUPER_AVALIACAO_CENTAVOS;
  const [av] = await consulta<{ id: number }>(sql`
    INSERT INTO "superAvaliacoes" ("token", "userId", "nome", "email", "cpfHash", "origem", "respostas", "status", "amountCents", "billingType")
    VALUES (${token}, ${params.userId ?? null}, ${nome}, ${email}, ${cpfHash}, ${params.origem}, ${JSON.stringify(respostas)}, 'creating', ${valor}, ${billingType})
    RETURNING "id"
  `);

  try {
    const customer = await asaasRequest<{ id: string }>("POST", "/customers", { name: nome, email, cpfCnpj: documento, externalReference: `avaliacao-cliente:${av.id}` });
    const corpo: Record<string, unknown> = {
      customer: customer.id,
      billingType,
      value: Number((valor / 100).toFixed(2)),
      dueDate: todayInSaoPaulo(),
      description: "Super Avaliação do Diário da Transformação - Shadia Hasan",
      externalReference: refAvaliacao(av.id),
    };
    const successUrl = `${params.origin}/avaliacao/${token}`;
    let payment: { id: string; invoiceUrl?: string };
    try {
      payment = await asaasRequest("POST", "/payments", { ...corpo, callback: { successUrl, autoRedirect: true } });
    } catch (e) {
      if (e instanceof AsaasError && e.status === 400 && /callback|successUrl|dom[ií]nio/i.test(e.message)) payment = await asaasRequest("POST", "/payments", corpo);
      else throw e;
    }
    if (!payment.invoiceUrl) throw new Error("cobrança sem link de pagamento");
    await consulta(sql`
      UPDATE "superAvaliacoes" SET "asaasCustomerId" = ${customer.id}, "asaasPaymentId" = ${payment.id}, "invoiceUrl" = ${payment.invoiceUrl},
             "status" = 'pending', "updatedAt" = now() WHERE "id" = ${av.id}
    `);
    if (params.userId) {
      await db.upsertProviderPayment({
        userId: params.userId, amount: valor, currency: "BRL", status: "pending",
        paymentMethod: `asaas:${billingType.toLowerCase()}`, stripeInvoiceId: `asaas:${payment.id}`,
        providerStatus: "PAYMENT_CREATED", paymentUrl: payment.invoiceUrl, dueDate: todayInSaoPaulo(),
        planSlug: "super-avaliacao", description: "Super Avaliação do Diário",
      }).catch((e) => console.error("[SuperAvaliação] cobrança não registrada no financeiro:", e));
    }
    console.log(`[SuperAvaliação] ${av.id} criada (${params.origem}), cobrança ${payment.id}${params.userId ? ` user ${params.userId}` : ""}`);
    return { token, invoiceUrl: payment.invoiceUrl, pix: params.metodo === "pix" ? await g.buscarPix(payment.id) : null };
  } catch (e) {
    await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'failed', "updatedAt" = now() WHERE "id" = ${av.id}`);
    console.error(`[SuperAvaliação] falha ao criar cobrança ${av.id}:`, e instanceof Error ? e.message : e);
    if (e instanceof AsaasError && e.status === 400) throw new AvaliacaoError(`O Asaas recusou os dados: ${e.message}`, "BAD_REQUEST");
    throw new AvaliacaoError("Não foi possível gerar o pagamento agora. Tente de novo em instantes.", "UNAVAILABLE");
  }
}

// ─── Status (página /avaliacao/<token> e o diário consultando) ─────────────

type Linha = {
  id: number; token: string; userId: number | null; nome: string; email: string; origem: OrigemAvaliacao; respostas: string;
  status: string; amountCents: number; billingType: string | null; asaasPaymentId: string | null; invoiceUrl: string | null;
  devolutiva: string | null; tentativas: number; createdAt: string; readyAt: string | null;
};

export type StatusAvaliacao = {
  status: "aguardando_pagamento" | "preparando" | "pronta" | "estornada" | "cancelada";
  origem: OrigemAvaliacao;
  primeiroNome: string;
  valorCentavos: number;
  invoiceUrl: string | null;
  pix: { imagemBase64: string; copiaECola: string } | null;
  devolutiva: DevolutivaAvaliacao | null;
  criadaEm: string;
};

function statusPublico(s: string): StatusAvaliacao["status"] {
  if (s === "ready") return "pronta";
  if (s === "paid" || s === "generating") return "preparando";
  if (s === "refunded") return "estornada";
  if (s === "cancelled" || s === "failed") return "cancelada";
  return "aguardando_pagamento";
}

const pixEmCache = new Map<string, { imagemBase64: string; copiaECola: string } | null>();

export async function statusAvaliacao(token: string, opcoes: { conferirAgora?: boolean } = {}): Promise<StatusAvaliacao | null> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(String(token || ""))) return null;
  if (!(await garantirSchemaAvaliacao())) return null;
  let [a] = await consulta<Linha>(sql`SELECT * FROM "superAvaliacoes" WHERE "token" = ${token} LIMIT 1`);
  if (!a) return null;
  // Pix pago e a pessoa olhando a tela: não espera o webhook nem a rotina de 10 min
  if (opcoes.conferirAgora && a.status === "pending" && a.asaasPaymentId) {
    await conferirCobrancaAvaliacao(a.asaasPaymentId).catch(() => undefined);
    [a] = await consulta<Linha>(sql`SELECT * FROM "superAvaliacoes" WHERE "id" = ${a.id} LIMIT 1`);
  }
  let pix: StatusAvaliacao["pix"] = null;
  if (a.status === "pending" && a.billingType === "PIX" && a.asaasPaymentId) {
    if (!pixEmCache.has(a.asaasPaymentId)) {
      const g = await import("./trialGuest");
      pixEmCache.set(a.asaasPaymentId, await g.buscarPix(a.asaasPaymentId));
      if (pixEmCache.size > 500) pixEmCache.clear();
    }
    pix = pixEmCache.get(a.asaasPaymentId) ?? null;
  }
  let devolutiva: DevolutivaAvaliacao | null = null;
  if (a.status === "ready" && a.devolutiva) {
    try { devolutiva = JSON.parse(a.devolutiva); } catch { devolutiva = null; }
  }
  return {
    status: statusPublico(a.status),
    origem: a.origem,
    primeiroNome: a.nome.split(" ")[0],
    valorCentavos: a.amountCents,
    invoiceUrl: a.status === "pending" ? a.invoiceUrl : null,
    pix,
    devolutiva,
    criadaEm: new Date(a.createdAt).toISOString(),
  };
}

export async function minhasAvaliacoes(userId: number): Promise<Array<{ token: string; status: StatusAvaliacao["status"]; origem: OrigemAvaliacao; criadaEm: string }>> {
  if (!(await garantirSchemaAvaliacao())) return [];
  const linhas = await consulta<{ token: string; status: string; origem: OrigemAvaliacao; createdAt: string }>(sql`
    SELECT "token", "status", "origem", "createdAt" FROM "superAvaliacoes"
     WHERE "userId" = ${userId} AND "status" IN ('pending', 'paid', 'generating', 'ready')
     ORDER BY "createdAt" DESC LIMIT 20
  `);
  return linhas.map((l) => ({ token: l.token, status: statusPublico(l.status), origem: l.origem, criadaEm: new Date(l.createdAt).toISOString() }));
}

// ─── Webhook e conferência ──────────────────────────────────────────────────

export function ehEventoAvaliacao(body: AsaasWebhookBody): boolean {
  return REF_AVALIACAO.test(body.payment?.externalReference || "");
}

/**
 * `gerar`: "segundo-plano" (webhook, tela de status) dispara a IA sem esperar;
 * "fila" (rotina de 10 min) deixa para o laço da própria rotina gerar em ordem.
 */
export async function processarEventoAvaliacao(body: AsaasWebhookBody, gerar: "segundo-plano" | "fila" = "segundo-plano"): Promise<void> {
  if (!(await garantirSchemaAvaliacao())) throw new Error("schema da super avaliação indisponível");
  const payment = body.payment!;
  const m = REF_AVALIACAO.exec(payment.externalReference || "");
  if (!m) return;
  const [a] = await consulta<Linha>(sql`SELECT * FROM "superAvaliacoes" WHERE "id" = ${Number(m[1])} LIMIT 1`);
  if (!a) {
    console.warn(`[SuperAvaliação] evento ${body.event} para avaliação inexistente ${m[1]}`);
    return;
  }
  const paymentId = String(payment.id || "");
  const marcarFinanceiro = async (status: "completed" | "refunded" | "failed") => {
    if (!a.userId) return;
    await db.upsertProviderPayment({
      userId: a.userId, amount: a.amountCents, currency: "BRL", status,
      paymentMethod: `asaas:${String(a.billingType || "").toLowerCase()}`, stripeInvoiceId: `asaas:${paymentId}`,
      providerStatus: body.event, planSlug: "super-avaliacao", description: "Super Avaliação do Diário",
      ...(status === "completed" ? { paidAt: new Date() } : {}),
      ...(status === "refunded" ? { refundedAmount: a.amountCents } : {}),
    }).catch((e) => console.error("[SuperAvaliação] financeiro:", e));
  };

  switch (body.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      const r = await consulta(sql`
        UPDATE "superAvaliacoes" SET "status" = 'paid', "paidAt" = COALESCE("paidAt", now()), "updatedAt" = now()
         WHERE "id" = ${a.id} AND "status" IN ('pending', 'creating', 'cancelled') RETURNING "id"
      `);
      await marcarFinanceiro("completed");
      if (r.length) {
        console.log(`[SuperAvaliação] ${a.id} paga; gerando devolutiva`);
        // Não segura o webhook esperando a IA; se falhar, a rotina de 10 min tenta de novo
        if (gerar === "segundo-plano") void gerarDevolutiva(a.id);
      }
      return;
    }
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'refunded', "updatedAt" = now() WHERE "id" = ${a.id}`);
      await marcarFinanceiro("refunded");
      return;
    case "PAYMENT_DELETED":
      await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'cancelled', "updatedAt" = now() WHERE "id" = ${a.id} AND "status" = 'pending'`);
      return;
    default:
      return;
  }
}

export async function conferirCobrancaAvaliacao(paymentId: string, gerar: "segundo-plano" | "fila" = "segundo-plano"): Promise<"paga" | "pendente" | "ignorada"> {
  const payment = await asaasRequest<NonNullable<AsaasWebhookBody["payment"]>>("GET", `/payments/${encodeURIComponent(paymentId)}`);
  if (!payment || !REF_AVALIACAO.test(payment.externalReference || "")) return "ignorada";
  const status = String(payment.status || "").toUpperCase();
  if (!STATUS_PAGO.has(status)) return "pendente";
  await processarEventoAvaliacao({ id: `conferencia:${paymentId}`, event: status === "CONFIRMED" ? "PAYMENT_CONFIRMED" : "PAYMENT_RECEIVED", payment: { ...payment, id: paymentId } }, gerar);
  return "paga";
}

/** Rotina de 10 min: confere Pix/cartão sem webhook e gera o que ficou pago sem devolutiva. */
export async function processarAvaliacoesPendentes(): Promise<number> {
  if (!(await garantirSchemaAvaliacao())) return 0;
  let feitas = 0;
  if (isAsaasConfigured()) {
    const pendentes = await consulta<{ asaasPaymentId: string }>(sql`
      SELECT "asaasPaymentId" FROM "superAvaliacoes"
       WHERE "status" = 'pending' AND "asaasPaymentId" IS NOT NULL AND "createdAt" > now() - interval '3 days'
       ORDER BY "createdAt" DESC LIMIT 30
    `);
    for (const p of pendentes) {
      try { await conferirCobrancaAvaliacao(p.asaasPaymentId, "fila"); } catch { /* tenta na próxima */ }
    }
  }
  // "generating" parado há mais de 10 min = processo caiu no meio; volta para a fila
  await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'paid', "updatedAt" = now() WHERE "status" = 'generating' AND "updatedAt" < now() - interval '10 minutes'`);
  const pagas = await consulta<{ id: number }>(sql`SELECT "id" FROM "superAvaliacoes" WHERE "status" = 'paid' ORDER BY "paidAt" LIMIT 10`);
  for (const p of pagas) if (await gerarDevolutiva(p.id)) feitas++;
  return feitas;
}

// ─── Geração (IA) ───────────────────────────────────────────────────────────

const PROMPT_SISTEMA = `Você escreve a "Super Avaliação" do Diário da Transformação, material da psicóloga Shadia Hasan que acompanha o programa Pensamentos Automáticos. A pessoa pagou para receber uma devolutiva escrita sobre as próprias respostas.

Tom: acolhedor, direto, humano, em português do Brasil, falando com a pessoa por "você". Frases curtas. Nada de jargão clínico, nada de tom motivacional genérico, sem travessões como separador.

Regras obrigatórias:
1. Use só o que a pessoa escreveu. Cite trechos curtos das respostas dela entre aspas para mostrar de onde vem cada observação. Não invente fatos da vida dela.
2. Não faça diagnóstico, não nomeie transtornos, não prescreva tratamento, não prometa cura. É uma leitura educativa de padrões de pensamento, emoção e ação.
3. Use a lógica do diário: situação, pensamento automático, emoção, resposta, outra leitura e próxima atitude. Aponte padrões que se repetem, crenças que parecem estar por trás e onde a pessoa já mostrou flexibilidade.
4. Valorize o que ela já fez de concreto. Não elogie de forma vazia.
5. Se houver qualquer sinal de sofrimento intenso, desesperança, vontade de morrer ou de se machucar, preencha o campo "cuidado" com acolhimento e a orientação de ligar para o CVV no 188 ou o SAMU no 192 e buscar apoio profissional. Nesse caso, seja mais breve no resto.
6. Os passos sugeridos devem ser pequenos, possíveis nesta semana, ligados ao que ela escreveu.
7. Quando fizer sentido, sugira buscar acompanhamento psicológico como apoio, sem alarmismo.

Responda SOMENTE com um JSON válido, sem texto fora dele, neste formato:
{
  "abertura": "2 a 3 frases que mostram que você leu com atenção o que ela escreveu",
  "padroes": [{"titulo": "nome curto do padrão", "texto": "3 a 5 frases explicando o padrão com trechos dela"}],
  "forcas": ["recurso ou avanço que ela já mostra, com o trecho que mostra isso"],
  "perguntas": ["pergunta para ela levar e responder no diário"],
  "passos": ["ação pequena e concreta para os próximos dias"],
  "fechamento": "2 frases de encerramento, calorosas e sem prometer resultado",
  "cuidado": "só preencha se houver sinal de risco; senão, string vazia"
}
Entre 2 e 4 padrões, 2 a 4 forças, 3 a 5 perguntas, 2 a 4 passos.`;

function montarMensagemUsuario(origem: OrigemAvaliacao, nome: string, respostas: RespostaAvaliada[]): string {
  const blocos: string[] = [];
  let secaoAtual = "";
  for (const r of respostas) {
    if (r.secao && r.secao !== secaoAtual) { secaoAtual = r.secao; blocos.push(`\n## ${r.secao}`); }
    blocos.push(`- ${r.pergunta || "Resposta"}\n  "${r.resposta.replace(/\s+/g, " ")}"`);
  }
  const contexto = origem === "amostra"
    ? "Ela fez o exercício grátis: um Mapa dos pensamentos automáticos em 6 passos, sobre uma situação só. Foque nessa situação e no que ela revela."
    : "Ela está fazendo o Diário da Transformação completo (capítulos, mapa, semana de observação, plano). Olhe o conjunto e conecte as respostas entre capítulos.";
  return `Primeiro nome: ${nome.split(" ")[0]}\n${contexto}\n\nRespostas dela:\n${blocos.join("\n")}`;
}

/** Gera e entrega uma avaliação paga. Devolve true se ficou pronta agora. Nunca lança. */
export async function gerarDevolutiva(id: number): Promise<boolean> {
  let a: Linha | undefined;
  try {
    [a] = await consulta<Linha>(sql`
      UPDATE "superAvaliacoes" SET "status" = 'generating', "updatedAt" = now()
       WHERE "id" = ${id} AND "status" = 'paid' RETURNING *
    `);
    if (!a) return false; // outro processo pegou, ou não está paga
    const respostas = normalizarRespostas(JSON.parse(a.respostas));
    const risco = temSinalDeRisco(respostas);
    const { invokeLLM } = await import("./_core/llm");
    const r = await invokeLLM({
      messages: [{ role: "system", content: PROMPT_SISTEMA }, { role: "user", content: montarMensagemUsuario(a.origem, a.nome, respostas) }],
      response_format: { type: "json_object" },
    } as any);
    const conteudo = r.choices?.[0]?.message?.content;
    const bruto = typeof conteudo === "string" ? conteudo : Array.isArray(conteudo) ? conteudo.map((c: any) => c?.text ?? "").join("") : "";
    const devolutiva = lerDevolutiva(bruto, risco);
    if (!devolutiva) throw new Error("resposta da IA fora do formato");
    await consulta(sql`
      UPDATE "superAvaliacoes" SET "status" = 'ready', "devolutiva" = ${JSON.stringify(devolutiva)}, "readyAt" = now(), "ultimoErro" = NULL, "updatedAt" = now()
       WHERE "id" = ${id}
    `);
    console.log(`[SuperAvaliação] ${id} pronta${risco ? " (com bloco de cuidado)" : ""}`);
    void avisarPronta(a);
    return true;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error(`[SuperAvaliação] falha ao gerar ${id}:`, msg);
    const [r] = await consulta<{ tentativas: number }>(sql`
      UPDATE "superAvaliacoes" SET "status" = 'paid', "tentativas" = "tentativas" + 1, "ultimoErro" = ${msg}, "updatedAt" = now()
       WHERE "id" = ${id} AND "status" = 'generating' RETURNING "tentativas"
    `).catch(() => [] as Array<{ tentativas: number }>);
    if (r && r.tentativas >= MAX_TENTATIVAS && a) await estornarPorFalha(a);
    return false;
  }
}

async function estornarPorFalha(a: Linha): Promise<void> {
  try {
    if (a.asaasPaymentId) await asaasRequest("POST", `/payments/${encodeURIComponent(a.asaasPaymentId)}/refund`, {});
    await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'refunded', "updatedAt" = now() WHERE "id" = ${a.id}`);
    console.warn(`[SuperAvaliação] ${a.id} estornada depois de ${MAX_TENTATIVAS} falhas da IA`);
    const { enviarEmail } = await import("./_core/email");
    const L = await import("./_core/emailLayout");
    await enviarEmail({
      departamento: "atendimento",
      para: a.email,
      assunto: "Devolvemos o valor da sua Super Avaliação",
      html: L.layoutEmail({
        departamento: "atendimento",
        preheader: "Tivemos um problema técnico e o valor já foi devolvido.",
        titulo: "O valor da sua Super Avaliação foi devolvido",
        corpo:
          L.p(`Oi, ${L.escapar(a.nome.split(" ")[0])}. Tivemos um problema técnico e não conseguimos preparar a sua Super Avaliação.`) +
          L.p(`Por isso, já pedimos ao Asaas a devolução dos ${reais(a.amountCents)}. No Pix, o dinheiro volta para a mesma conta; no cartão, aparece como estorno na fatura.`) +
          L.p("Suas respostas continuam no diário. Se quiser tentar de novo mais tarde, é só pedir outra avaliação. Desculpe o transtorno."),
        motivo: "Você recebeu este e-mail porque pediu uma Super Avaliação em shadiahasan.com.",
      }),
    });
  } catch (e) {
    // Sem estorno automático: fica 'paid' com tentativas altas e aparece no admin para resolver à mão
    console.error(`[SuperAvaliação] estorno automático falhou para ${a.id}:`, e instanceof Error ? e.message : e);
    await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'failed', "updatedAt" = now() WHERE "id" = ${a.id}`).catch(() => undefined);
  }
}

async function avisarPronta(a: Linha): Promise<void> {
  try {
    const { enviarEmail } = await import("./_core/email");
    const L = await import("./_core/emailLayout");
    const link = `${L.siteUrl()}/avaliacao/${a.token}`;
    await enviarEmail({
      departamento: "atendimento",
      para: a.email,
      assunto: "Sua Super Avaliação está pronta",
      html: L.layoutEmail({
        departamento: "atendimento",
        preheader: "A leitura das suas respostas do Diário da Transformação.",
        titulo: "Sua Super Avaliação está pronta",
        corpo:
          L.p(`Oi, ${L.escapar(a.nome.split(" ")[0])}. Lemos as respostas que você escreveu no Diário da Transformação e preparamos a sua devolutiva.`) +
          L.botao("Ler minha avaliação", link) +
          L.p("Guarde este e-mail: o link é só seu e abre a avaliação quando você quiser. Não encaminhe para ninguém."),
        motivo: "Você recebeu este e-mail porque comprou uma Super Avaliação em shadiahasan.com.",
      }),
    });
  } catch (e) {
    console.warn(`[SuperAvaliação] e-mail de pronta não enviado (${a.id}):`, e instanceof Error ? e.message : e);
  }
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function listarAvaliacoesAdmin(): Promise<Array<{ id: number; nome: string; email: string; origem: string; status: string; tentativas: number; ultimoErro: string | null; amountCents: number; createdAt: string; readyAt: string | null }>> {
  if (!(await garantirSchemaAvaliacao())) return [];
  return consulta(sql`
    SELECT "id", "nome", "email", "origem", "status", "tentativas", "ultimoErro", "amountCents", "createdAt", "readyAt"
      FROM "superAvaliacoes" WHERE "status" <> 'creating' ORDER BY "createdAt" DESC LIMIT 200
  `);
}

/** Admin: tenta gerar de novo uma avaliação paga que travou (zera as tentativas). */
export async function gerarDeNovoAdmin(id: number): Promise<boolean> {
  await consulta(sql`UPDATE "superAvaliacoes" SET "status" = 'paid', "tentativas" = 0, "updatedAt" = now() WHERE "id" = ${id} AND "status" IN ('paid', 'failed')`);
  return gerarDevolutiva(id);
}

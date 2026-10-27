/**
 * Vínculo da compra sem conta (teste de 1 aula) com contas que já existem.
 *
 * Roda contra um Postgres de verdade: precisa de TEST_DATABASE_URL apontando
 * para um banco DESCARTÁVEL (o teste apaga e recria dados). Sem a variável,
 * o arquivo é pulado. Exemplo local:
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/shadia_teste pnpm test trialGuest.vinculo
 *
 * Cenário central: a pessoa tem conta criada pelo Google, compra a aula de
 * R$ 19,90 sem estar logada (navegador do Facebook) e paga. O acesso tem que
 * cair NA CONTA DELA, e ela tem que conseguir entrar e assistir.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const URL_TESTE = process.env.TEST_DATABASE_URL;
const descrever = URL_TESTE ? describe : describe.skip;

if (URL_TESTE) {
  process.env.DATABASE_URL = URL_TESTE;
  process.env.SESSION_SIGNING_SECRET = "s".repeat(48);
  delete process.env.RESEND_API_KEY;
  delete process.env.META_CAPI_TOKEN;
  delete process.env.GA4_API_SECRET;
}

type Mods = {
  db: typeof import("./db");
  schema: typeof import("../drizzle/schema");
  trial: typeof import("./trial");
  guest: typeof import("./trialGuest");
  drizzle: typeof import("drizzle-orm");
};
let m: Mods;
let aulaId = 0;
let cursoId = 0;

async function banco() {
  const d = await m.db.getDb();
  if (!d) throw new Error("sem banco");
  return d;
}

async function criarContaGoogle(email: string, nome = "Maria Google") {
  // Exatamente o caminho do login com Google
  return m.db.findOrCreateUserByProvider({ provider: "google", providerId: `g-${email}`, email, name: nome });
}

let seq = 0;
/** Grava uma compra sem conta pendente, como criarCompraDeConvidado deixa depois do Asaas. */
async function compraPendente(email: string) {
  await m.guest.ensureGuestSchema();
  const d = await banco();
  seq++;
  const token = `token-de-teste-${seq}-${"x".repeat(30)}`;
  const paymentId = `pay_teste_${seq}`;
  const [c] = await d
    .insert(m.guest.trialGuestCheckouts)
    .values({
      tokenHash: m.guest.hashDe(token),
      name: "Maria Compradora",
      email: m.guest.normalizarEmail(email),
      cpfHash: m.guest.hashDe(`cpf${seq}`),
      lessonId: aulaId,
      courseId: cursoId,
      asaasCustomerId: `cus_${seq}`,
      asaasPaymentId: paymentId,
      invoiceUrl: "https://www.asaas.com/i/teste",
      dueDate: "2026-10-27",
      amountCents: 1990,
      status: "pending",
    })
    .returning();
  return { compra: c, token, paymentId };
}

async function pagar(compraId: number, paymentId: string, evento = "PAYMENT_CONFIRMED") {
  await m.trial.processTrialEvent({
    id: `evt_${paymentId}_${evento}`,
    event: evento,
    payment: {
      id: paymentId,
      customer: "cus_x",
      value: 19.9,
      billingType: "PIX",
      status: evento === "PAYMENT_CONFIRMED" ? "CONFIRMED" : "RECEIVED",
      externalReference: `trialguest:${compraId}:${aulaId}`,
    },
  });
}

descrever("compra sem conta → conta que já existe", () => {
  beforeAll(async () => {
    m = {
      db: await import("./db"),
      schema: await import("../drizzle/schema"),
      trial: await import("./trial"),
      guest: await import("./trialGuest"),
      drizzle: await import("drizzle-orm"),
    };
    await m.trial.ensureTrialSchema();
    await m.guest.ensureGuestSchema();
  });

  beforeEach(async () => {
    const d = await banco();
    await d.execute(m.drizzle.sql`TRUNCATE "trialGuestCheckouts", "trialPasses", "payment_history", users, lessons, courses RESTART IDENTITY CASCADE`);
    const [curso] = await d
      .insert(m.schema.courses)
      .values({ title: "Curso", slug: `curso-${Date.now()}`, instructorId: 1 } as any)
      .returning();
    cursoId = curso.id;
    const [aula] = await d
      .insert(m.schema.lessons)
      .values({ courseId: curso.id, title: "Aula de entrada", order: 1, isPublished: 1, isAccessRestricted: 1, videoPlaybackUrl: "https://v" } as any)
      .returning();
    aulaId = aula.id;
  });

  it("conta Google + compra com o mesmo e-mail: o acesso cai na conta Google", async () => {
    const google = await criarContaGoogle("maria.silva@gmail.com");
    const { compra, paymentId } = await compraPendente("maria.silva@gmail.com");
    await pagar(compra.id, paymentId);

    expect(await m.trial.hasActiveTrialPass(google.id, aulaId)).toBe(true);
    const d = await banco();
    const contas = await d.select().from(m.schema.users);
    expect(contas).toHaveLength(1); // nenhuma conta duplicada
  });

  it("e-mail digitado com maiúsculas e espaços cai na mesma conta", async () => {
    const google = await criarContaGoogle("maria.silva@gmail.com");
    const { compra, paymentId } = await compraPendente("  Maria.Silva@GMAIL.com ");
    await pagar(compra.id, paymentId);
    expect(await m.trial.hasActiveTrialPass(google.id, aulaId)).toBe(true);
  });

  it("Gmail sem os pontos (mesma caixa de entrada) cai na conta Google, sem duplicar", async () => {
    const google = await criarContaGoogle("maria.silva@gmail.com");
    const { compra, paymentId } = await compraPendente("mariasilva@gmail.com");
    await pagar(compra.id, paymentId);
    expect(await m.trial.hasActiveTrialPass(google.id, aulaId)).toBe(true);
    const d = await banco();
    expect(await d.select().from(m.schema.users)).toHaveLength(1);
  });

  it("conta nova criada pela compra e depois login com Google (com pontos) é a mesma conta", async () => {
    const { compra, paymentId } = await compraPendente("joaosouza@gmail.com");
    await pagar(compra.id, paymentId);
    const google = await criarContaGoogle("joao.souza@gmail.com", "João");
    expect(await m.trial.hasActiveTrialPass(google.id, aulaId)).toBe(true);
    const d = await banco();
    expect(await d.select().from(m.schema.users)).toHaveLength(1);
  });

  it("CONFIRMED e depois RECEIVED da mesma cobrança: um passe, um lançamento", async () => {
    await criarContaGoogle("ana@gmail.com");
    const { compra, paymentId } = await compraPendente("ana@gmail.com");
    await pagar(compra.id, paymentId, "PAYMENT_CONFIRMED");
    await pagar(compra.id, paymentId, "PAYMENT_RECEIVED");
    const d = await banco();
    expect(await d.select().from(m.schema.trialPasses)).toHaveLength(1);
    expect(await d.select().from(m.schema.paymentHistory)).toHaveLength(1);
  });

  it("webhook e conferência ao mesmo tempo não criam duas contas", async () => {
    const { compra, paymentId } = await compraPendente("novo@gmail.com");
    await Promise.all([pagar(compra.id, paymentId, "PAYMENT_CONFIRMED"), pagar(compra.id, paymentId, "PAYMENT_RECEIVED")]);
    const d = await banco();
    expect(await d.select().from(m.schema.users)).toHaveLength(1);
    expect(await d.select().from(m.schema.trialPasses)).toHaveLength(1);
  });

  it("conta existente nunca entra sozinha; a tela informa o dono para conferir a sessão", async () => {
    const google = await criarContaGoogle("bia@gmail.com");
    const { compra, paymentId, token } = await compraPendente("bia@gmail.com");
    await pagar(compra.id, paymentId);
    const r = await m.guest.statusDaCompra(token, { consultar: async () => ({}) });
    expect(r?.situacao).toBe("paga");
    expect(r?.entrarSozinho).toBeNull();
    expect(r?.donoId).toBe(google.id);
  });

  it("conta nova criada pela compra entra sozinha", async () => {
    const { compra, paymentId, token } = await compraPendente("carla@gmail.com");
    await pagar(compra.id, paymentId);
    const r = await m.guest.statusDaCompra(token, { consultar: async () => ({}) });
    expect(r?.entrarSozinho?.email).toBe("carla@gmail.com");
  });

  it("link de acesso por e-mail: entra na conta existente uma vez só", async () => {
    const google = await criarContaGoogle("duda@gmail.com");
    const links = await import("./linkDeAcesso");
    const { token } = await links.criarLinkDeAcesso(google.id, `/lesson/${aulaId}`);
    const primeiro = await links.usarLinkDeAcesso(token);
    expect(primeiro?.userId).toBe(google.id);
    expect(primeiro?.destino).toBe(`/lesson/${aulaId}`);
    expect(await links.usarLinkDeAcesso(token)).toBeNull(); // uso único
    expect(await links.usarLinkDeAcesso("token-inventado-que-nao-existe-123456")).toBeNull();
  });

  it("link de acesso não aceita destino fora do site", async () => {
    const links = await import("./linkDeAcesso");
    expect(links.destinoSeguro("https://evil.com/x")).toBe("/my-courses");
    expect(links.destinoSeguro("//evil.com")).toBe("/my-courses");
    expect(links.destinoSeguro("/lesson/12")).toBe("/lesson/12");
    expect(links.destinoSeguro("/\\evil.com")).toBe("/my-courses");
  });
});

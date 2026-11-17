/**
 * Venda avulsa de Programas + modelo comercial, contra um Postgres de verdade.
 *
 * Precisa de TEST_DATABASE_URL apontando para um banco DESCARTÁVEL com o schema
 * do Drizzle aplicado (`pnpm db:push`); o teste apaga e recria dados. Sem a
 * variável, é pulado. O Asaas é simulado (nenhuma chamada sai para a rede).
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/shadia_teste pnpm test programaVenda.integracao
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const URL_TESTE = process.env.TEST_DATABASE_URL;
const descrever = URL_TESTE ? describe : describe.skip;

if (URL_TESTE) {
  process.env.DATABASE_URL = URL_TESTE;
  process.env.ASAAS_API_KEY = "chave-falsa-de-teste";
  process.env.ASAAS_WEBHOOK_TOKEN = "token-de-teste";
  delete process.env.RESEND_API_KEY;
  delete process.env.NTFY_TOPIC;
  delete process.env.EMAIL_AVISOS_ADMIN;
}

// Asaas simulado: guarda as chamadas e devolve ids previsíveis
const chamadas: Array<{ method: string; path: string; body?: any }> = [];
const cobrancas = new Map<string, any>();
let seq = 0;
vi.mock("./asaas", async (original) => {
  const real = await original<typeof import("./asaas")>();
  return {
    ...real,
    asaasRequest: vi.fn(async (method: string, path: string, body?: any) => {
      chamadas.push({ method, path, body });
      if (method === "POST" && path === "/customers") return { id: "cus_teste" };
      if (method === "POST" && path === "/payments") {
        const id = `pay_${++seq}`;
        const p = { id, invoiceUrl: `https://sandbox.asaas.com/i/${id}`, ...body, status: "PENDING" };
        cobrancas.set(id, p);
        return p;
      }
      if (method === "GET" && path.startsWith("/payments/")) return cobrancas.get(decodeURIComponent(path.split("/")[2]));
      if (method === "DELETE") return { deleted: true };
      throw new Error(`chamada inesperada ${method} ${path}`);
    }),
  };
});

type Mods = {
  db: typeof import("./db");
  pv: typeof import("./programaVenda");
  asaas: typeof import("./asaas");
  videos: typeof import("./routers/videos");
  drizzle: typeof import("drizzle-orm");
};
let m: Mods;
const ids = { aluna: 0, assinante: 0, admin: 0, l1: 0, l2: 0, l3: 0, p1: 0, p2: 0, curso1: 0, curso2: 0 };

async function exec(q: any) {
  const d = await m.db.getDb();
  if (!d) throw new Error("sem banco");
  return ((await d.execute(q)) as any).rows as any[];
}
const S = () => m.drizzle.sql;

async function temAcesso(userId: number, lessonId: number, courseId: number) {
  return m.videos.checkUserHasAccess(userId, { isAccessRestricted: 1, courseId, id: lessonId });
}

/** Simula o webhook pelo caminho real: registro idempotente + processamento. */
async function webhook(eventId: string, event: string, paymentId: string, extra: Record<string, unknown> = {}) {
  const c = cobrancas.get(paymentId);
  const body = { id: eventId, event, payment: { ...c, id: paymentId, billingType: "PIX", paymentDate: "2026-11-17", ...extra } };
  const novo = await m.asaas.recordAsaasEvent(body as any);
  if (novo) await m.asaas.processAsaasEvent(body as any);
  return novo;
}

descrever("venda avulsa de Programas (Postgres real)", () => {
  beforeAll(async () => {
    m = {
      db: await import("./db"),
      pv: await import("./programaVenda"),
      asaas: await import("./asaas"),
      videos: await import("./routers/videos"),
      drizzle: await import("drizzle-orm"),
    };
    // Simula o banco de produção de hoje: sem as colunas e tabelas novas
    await exec(S()`ALTER TABLE "contentCollections" DROP COLUMN IF EXISTS "priceCents", DROP COLUMN IF EXISTS "originalPriceCents",
      DROP COLUMN IF EXISTS "headline", DROP COLUMN IF EXISTS "salesDescription", DROP COLUMN IF EXISTS "forWhom",
      DROP COLUMN IF EXISTS "learnings", DROP COLUMN IF EXISTS "ctaText"`);
    await exec(S()`DROP TABLE IF EXISTS "programaCompras", "programaConvidados", "siteSettings", "siteSettingsHistory"`);
    expect(await m.pv.garantirSchemaComercial()).toBe(true);
    expect(await m.asaas.ensureAsaasSchema()).toBe(true);
  });

  beforeEach(async () => {
    chamadas.length = 0;
    cobrancas.clear();
    await exec(S()`TRUNCATE "programaCompras", "programaConvidados", "siteSettings", "siteSettingsHistory", "asaasWebhookEvents", "payment_history",
      "contentCollectionItems", "contentCollections", subscriptions, enrollments, lessons, courses, users RESTART IDENTITY CASCADE`);
    const u = await exec(S()`INSERT INTO users (email, name) VALUES ('aluna@teste.com', 'Aluna Teste'), ('assinante@teste.com', 'Assinante'), ('admin@teste.com', 'Admin') RETURNING id`);
    [ids.aluna, ids.assinante, ids.admin] = u.map((r) => r.id);
    const c = await exec(S()`INSERT INTO courses (title, slug, "instructorId", "isPublished") VALUES ('Módulo 1', 'm1', 1, 0), ('Semana 1', 's1', 1, 0) RETURNING id`);
    [ids.curso1, ids.curso2] = c.map((r) => r.id);
    const l = await exec(S()`INSERT INTO lessons ("courseId", title, "order", "isPublished", "isAccessRestricted") VALUES
      (${ids.curso1}, 'Aula 1', 1, 1, 1), (${ids.curso1}, 'Aula 2', 2, 1, 1), (${ids.curso2}, 'Aula 3', 1, 1, 1) RETURNING id`);
    [ids.l1, ids.l2, ids.l3] = l.map((r) => r.id);
    const p = await exec(S()`INSERT INTO "contentCollections" (title, "isActive") VALUES ('Permita-se Ser Livre', 1), ('Jornada do Código Interno', 1) RETURNING id`);
    [ids.p1, ids.p2] = p.map((r) => r.id);
    await exec(S()`INSERT INTO "contentCollectionItems" ("collectionId", "lessonId", "order") VALUES (${ids.p1}, ${ids.l1}, 0), (${ids.p1}, ${ids.l2}, 1), (${ids.p2}, ${ids.l3}, 0)`);
    await m.pv.salvarPrecosPrograma(ids.p1, 19700, 59700);
    await m.pv.salvarPrecosPrograma(ids.p2, 5700, 19700);
    await exec(S()`INSERT INTO subscriptions ("userId", plan, status) VALUES (${ids.assinante}, 'premium', 'active')`);
  });

  const checkout = (over: Partial<Parameters<Mods["pv"]["criarCheckoutPrograma"]>[0]> = {}) => m.pv.criarCheckoutPrograma({
    userId: ids.aluna, userEmail: "aluna@teste.com", userName: "Aluna Teste", collectionId: ids.p1,
    cpfCnpj: "52998224725", metodo: "pix", origin: "https://shadiahasan.com", ...over,
  });

  it("padrão é assinatura e, nele, não abre cobrança avulsa", async () => {
    expect((await m.pv.lerConfigComercial()).modelo).toBe("assinatura");
    await expect(checkout()).rejects.toThrow(/não está disponível/);
    expect(chamadas).toHaveLength(0);
  });

  it("checkout usa o preço do banco, referência própria, e pendente não libera", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const r = await checkout();
    const post = chamadas.find((c) => c.path === "/payments")!;
    expect(post.body.value).toBe(197);
    expect(post.body.billingType).toBe("PIX");
    expect(post.body.externalReference).toBe(`programa:${ids.aluna}:${ids.p1}`);
    expect(r.url).toContain(r.paymentId);
    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(false);

    // Admin muda o preço: a próxima cobrança sai com o preço novo
    await m.pv.salvarPrecosPrograma(ids.p1, 14700, 59700);
    await checkout({ metodo: "cartao" });
    expect(chamadas.filter((c) => c.path === "/payments").at(-1)!.body.value).toBe(147);
  });

  it("segundo clique igual reaproveita a fatura em vez de gerar outra", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const a = await checkout();
    const b = await checkout();
    expect(b.paymentId).toBe(a.paymentId);
    expect(chamadas.filter((c) => c.path === "/payments")).toHaveLength(1);
  });

  it("pagamento confirmado libera só as aulas do Programa comprado; webhook repetido não duplica", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const { paymentId } = await checkout();
    expect(await webhook("evt_1", "PAYMENT_CONFIRMED", paymentId)).toBe(true);
    expect(await webhook("evt_1", "PAYMENT_CONFIRMED", paymentId)).toBe(false); // mesmo evento: ignorado
    await webhook("evt_2", "PAYMENT_RECEIVED", paymentId); // outro evento da mesma cobrança

    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(true);
    expect(await temAcesso(ids.aluna, ids.l2, ids.curso1)).toBe(true);
    expect(await temAcesso(ids.aluna, ids.l3, ids.curso2)).toBe(false); // outro programa

    const compras = await exec(S()`SELECT status FROM "programaCompras" WHERE "userId" = ${ids.aluna} AND status = 'active'`);
    expect(compras).toHaveLength(1);
    const fin = await exec(S()`SELECT status, amount, "planSlug" FROM payment_history WHERE "stripeInvoiceId" = ${`asaas:${paymentId}`}`);
    expect(fin).toEqual([{ status: "completed", amount: 19700, planSlug: "programa" }]);
    await expect(checkout()).rejects.toThrow(/já tem este programa/);
  });

  it("valor pago menor que o cobrado não libera", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const { paymentId } = await checkout();
    await webhook("evt_x", "PAYMENT_RECEIVED", paymentId, { value: 1 });
    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(false);
  });

  it("trocar o modelo não mexe em assinatura nem em compra; estorno revoga só a compra", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const { paymentId } = await checkout();
    await webhook("evt_a", "PAYMENT_CONFIRMED", paymentId);

    await m.pv.definirModeloComercial("assinatura", ids.admin);
    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(true); // compra continua
    expect(await temAcesso(ids.assinante, ids.l3, ids.curso2)).toBe(true); // assinatura continua
    const hist = await exec(S()`SELECT "newValue" FROM "siteSettingsHistory" ORDER BY id`);
    expect(hist.map((h) => h.newValue)).toEqual(["avulso", "assinatura"]);

    await webhook("evt_b", "PAYMENT_REFUNDED", paymentId);
    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(false);
    expect(await temAcesso(ids.assinante, ids.l1, ids.curso1)).toBe(true);
    const [fin] = await exec(S()`SELECT status FROM payment_history WHERE "stripeInvoiceId" = ${`asaas:${paymentId}`}`);
    expect(fin.status).toBe("refunded");
    // Estornado não volta a ser liberado por um evento atrasado
    await webhook("evt_c", "PAYMENT_RECEIVED", paymentId);
    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(false);
  });

  it("conferência ativa libera quem pagou sem webhook", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const { paymentId } = await checkout();
    cobrancas.get(paymentId).status = "RECEIVED";
    expect(await m.pv.conferirComprasPendentes()).toBe(1);
    expect(await temAcesso(ids.aluna, ids.l2, ids.curso1)).toBe(true);
    expect(await m.pv.conferirComprasPendentes()).toBe(0);
  });

  it("liberação manual e revogação pelo admin", async () => {
    await m.pv.liberarManual("ALUNA@teste.com", ids.p2, ids.admin);
    expect(await temAcesso(ids.aluna, ids.l3, ids.curso2)).toBe(true);
    await expect(m.pv.liberarManual("aluna@teste.com", ids.p2, ids.admin)).rejects.toThrow(/já tem/);
    const [c] = await exec(S()`SELECT id FROM "programaCompras" WHERE "userId" = ${ids.aluna}`);
    await m.pv.revogarCompra(c.id, "teste de revogação", ids.admin);
    expect(await temAcesso(ids.aluna, ids.l3, ids.curso2)).toBe(false);
  });

  it("valida preços no servidor e respeita formas de pagamento desligadas", async () => {
    await expect(m.pv.salvarPrecosPrograma(ids.p1, 19700, 19700)).rejects.toThrow(/maior que o preço/);
    await expect(m.pv.salvarPrecosPrograma(ids.p1, 100, null)).rejects.toThrow(/entre/);
    await m.pv.definirModeloComercial("avulso", ids.admin);
    await expect(checkout({ metodo: "boleto" })).rejects.toThrow(/forma de pagamento/); // boleto vem desligado
    await expect(m.pv.definirMetodosPagamento({ pix: false, cartao: false, boleto: false }, ids.admin)).rejects.toThrow(/ao menos uma/);
  });

  // ── Compra sem conta e atribuição (ajustes de 17/11/2026) ──────────────────

  const convidado = (over: Record<string, unknown> = {}) => m.pv.criarCompraConvidado({
    nome: "Maria Nova Silva", email: "maria.nova@gmail.com", cpfCnpj: "52998224725", collectionId: ids.p1,
    metodo: "pix", origin: "https://shadiahasan.com",
    atribuicao: { utmSource: "facebook", utmCampaign: "programa-livre", fbp: "fb.1.123.456", clientIp: "200.1.1.1" },
    ...over,
  } as any);

  it("compra sem conta: paga primeiro, a conta nasce na confirmação e a compra leva a origem", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const r = await convidado();
    const post = chamadas.find((c) => c.path === "/payments")!;
    expect(post.body.value).toBe(197);
    expect(post.body.externalReference).toMatch(/^programaguest:\d+:\d+$/);
    let st = await m.pv.statusConvidado(r.token);
    expect(st?.situacao).toBe("pendente");
    expect(await exec(S()`SELECT 1 FROM users WHERE email = 'maria.nova@gmail.com'`)).toHaveLength(0); // ainda sem conta

    const paymentId = post.body && [...cobrancas.keys()].at(-1)!;
    await webhook("evt_g1", "PAYMENT_CONFIRMED", paymentId);
    await webhook("evt_g2", "PAYMENT_RECEIVED", paymentId);
    const [u] = await exec(S()`SELECT id FROM users WHERE email = 'maria.nova@gmail.com'`);
    expect(u).toBeTruthy();
    expect(await temAcesso(u.id, ids.l1, ids.curso1)).toBe(true);
    expect(await temAcesso(u.id, ids.l3, ids.curso2)).toBe(false);
    const [c] = await exec(S()`SELECT status, "utmCampaign", fbp, "clientIp" FROM "programaCompras" WHERE "userId" = ${u.id}`);
    expect(c).toEqual({ status: "active", utmCampaign: "programa-livre", fbp: "fb.1.123.456", clientIp: "200.1.1.1" });
    expect(await exec(S()`SELECT 1 FROM users WHERE email = 'maria.nova@gmail.com'`)).toHaveLength(1); // uma conta só

    st = await m.pv.statusConvidado(r.token);
    expect(st?.situacao).toBe("paga");
    expect(st?.entrarSozinho?.userId).toBe(u.id); // conta criada agora: entra sozinho
  });

  it("compra sem conta com e-mail que já tem conta: acesso vai para a conta existente, sem login automático", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const r = await convidado({ email: "ALUNA@teste.com" });
    const paymentId = [...cobrancas.keys()].at(-1)!;
    await webhook("evt_e1", "PAYMENT_CONFIRMED", paymentId);
    expect(await temAcesso(ids.aluna, ids.l1, ids.curso1)).toBe(true);
    const st = await m.pv.statusConvidado(r.token);
    expect(st?.situacao).toBe("paga");
    expect(st?.entrarSozinho).toBeNull();
    // Já tem o programa: não cobra de novo
    await expect(convidado({ email: "aluna@teste.com", cpfCnpj: "11144477735" })).rejects.toThrow(/já tem este programa/);
  });

  it("compra sem conta: tela de aguardando libera na hora quem pagou sem webhook", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const r = await convidado({ email: "outra.pessoa@teste.com" });
    const paymentId = [...cobrancas.keys()].at(-1)!;
    cobrancas.get(paymentId).status = "RECEIVED";
    const st = await m.pv.statusConvidado(r.token);
    expect(st?.situacao).toBe("paga");
    const [u] = await exec(S()`SELECT id FROM users WHERE email = 'outra.pessoa@teste.com'`);
    expect(await temAcesso(u.id, ids.l2, ids.curso1)).toBe(true);
  });

  it("compra sem conta respeita o modelo comercial", async () => {
    await m.pv.definirModeloComercial("assinatura", ids.admin);
    await expect(convidado({ email: "modelo@teste.com" })).rejects.toThrow(/não está disponível/);
  });

  it("checkout logado grava a origem do visitante", async () => {
    await m.pv.definirModeloComercial("avulso", ids.admin);
    const { paymentId } = await checkout({ atribuicao: { utmCampaign: "c1", ga4ClientId: "123.456" } } as any);
    const [c] = await exec(S()`SELECT "utmCampaign", "ga4ClientId" FROM "programaCompras" WHERE "asaasPaymentId" = ${paymentId}`);
    expect(c).toEqual({ utmCampaign: "c1", ga4ClientId: "123.456" });
  });

  it("liberação manual acha a conta do Gmail com ou sem pontos", async () => {
    await exec(S()`INSERT INTO users (email, name) VALUES ('maria.silva@gmail.com', 'Maria Silva')`);
    await m.pv.liberarManual("mariasilva@gmail.com", ids.p2, ids.admin);
    const [u] = await exec(S()`SELECT id FROM users WHERE email = 'maria.silva@gmail.com'`);
    expect(await temAcesso(u.id, ids.l3, ids.curso2)).toBe(true);
  });

  it("presente: quem comprou e assinante Premium recebem; teste de 1 aula e sem compra não", async () => {
    await m.pv.liberarManual("aluna@teste.com", ids.p2, ids.admin);
    expect(await m.pv.podeReceberPresente(ids.aluna, "user", ids.p2)).toBe(true);
    expect(await m.pv.podeReceberPresente(ids.aluna, "user", ids.p1)).toBe(false);
    expect(await m.pv.podeReceberPresente(ids.assinante, "user", ids.p1)).toBe(true); // premium ativo
    expect(await m.pv.podeReceberPresente(ids.aluna, "admin", ids.p1)).toBe(true);
  });
});

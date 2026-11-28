/**
 * Reenvio de conversões e painel contra Postgres real (TEST_DATABASE_URL, banco
 * DESCARTÁVEL). Meta e GA4 são simulados: nada sai para a rede.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL_TESTE = process.env.TEST_DATABASE_URL;
const descrever = URL_TESTE ? describe : describe.skip;
if (URL_TESTE) {
  process.env.DATABASE_URL = URL_TESTE;
  process.env.META_PIXEL_ID = "1";
  process.env.META_CAPI_ACCESS_TOKEN = "t";
  process.env.GA4_API_SECRET = "s";
  delete process.env.TIKTOK_PIXEL_ID;
  delete process.env.RESEND_API_KEY;
}

descrever("conversões pendentes", () => {
  const enviados: Array<{ url: string; body: any }> = [];
  beforeAll(() => {
    vi.stubGlobal("fetch", async (url: string, init: any) => {
      enviados.push({ url: String(url), body: JSON.parse(init.body) });
      return { ok: true, status: 200, text: async () => '{"events_received":1}', json: async () => ({}) };
    });
  });
  // Limpa no fim: passe ativo que sobra daria acesso a alunos de outros testes.
  afterAll(async () => {
    vi.unstubAllGlobals();
    const db = await import("./db");
    const { sql } = await import("drizzle-orm");
    await (await db.getDb())!.execute(sql`TRUNCATE "trialPasses" RESTART IDENTITY CASCADE`);
  });

  it("reenvia só venda consentida e recente, uma vez, com a data do pagamento; o painel soma", async () => {
    const db = await import("./db");
    const { sql } = await import("drizzle-orm");
    const m = await import("./conversoes");
    await m.painelDeVendas(30); // cria as tabelas
    const d = (await db.getDb())!;
    await d.execute(sql`TRUNCATE "trialPasses", "trialGuestCheckouts", "programaCompras", "programaConvidados" RESTART IDENTITY CASCADE`);
    const passe = (id: string, fbp: string | null, dias: number, status = "active") => d.execute(sql`
      INSERT INTO "trialPasses" ("userId","lessonId","courseId","asaasCustomerId","asaasPaymentId","amountCents","status","paidAt","createdAt","fbp","ga4ClientId","utmSource")
      VALUES (1,1,1,'cus_t',${id},1990,${status},now() - (${dias} * interval '1 day'),now() - (${dias} * interval '1 day'),${fbp},${fbp ? "1.2" : null},${fbp ? "instagram" : null})`);
    await passe("pay_ok", "fb.1.1.1", 1);
    await passe("pay_sem_consentimento", null, 1);
    await passe("pay_antiga", "fb.1.1.2", 10);
    await passe("pay_estornada", "fb.1.1.3", 1, "refunded");

    await m.reenviarConversoesPendentes();
    await m.reenviarConversoesPendentes();

    const meta = enviados.filter((e) => e.url.includes("graph.facebook.com"));
    expect(meta.map((e) => e.body.data[0].event_id)).toEqual(["pay_ok"]);
    expect(Math.abs(meta[0].body.data[0].event_time - (Date.now() / 1000 - 86400))).toBeLessThan(300);
    const ga = enviados.filter((e) => e.url.includes("google-analytics"));
    expect(ga).toHaveLength(1);
    expect(ga[0].body.timestamp_micros).toBeGreaterThan(0);

    const p = await m.painelDeVendas(30);
    expect(p.total).toEqual({ cobrancas: 4, pagas: 3, receitaCentavos: 5970 });
    expect(p.vendas.find((v) => v.cobranca === "pay_ok")).toMatchObject({ meta: true, ga4: true, tiktok: false });
  });
});

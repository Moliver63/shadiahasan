/**
 * Quem compra a aula de R$ 19,90 já logado recebe o e-mail de acesso, uma vez.
 * Precisa de TEST_DATABASE_URL apontando para um banco DESCARTÁVEL (ver
 * trialGuest.vinculo.test.ts). Sem a variável, o arquivo é pulado.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const URL_TESTE = process.env.TEST_DATABASE_URL;
const descrever = URL_TESTE ? describe : describe.skip;

if (URL_TESTE) {
  process.env.DATABASE_URL = URL_TESTE;
  process.env.SESSION_SIGNING_SECRET = "s".repeat(48);
  delete process.env.RESEND_API_KEY;
  delete process.env.META_CAPI_TOKEN;
  delete process.env.GA4_API_SECRET;
}

const enviarEmailDeAcesso = vi.fn(async () => {});
vi.mock("./trialGuestEmail", () => ({ enviarEmailDeAcesso, enviarLinkDeAcesso: vi.fn() }));

descrever("compra logada → e-mail de acesso", () => {
  let trial: typeof import("./trial");
  let userId = 0;
  let aulaId = 0;

  beforeAll(async () => {
    const db = await import("./db");
    const schema = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    trial = await import("./trial");
    await trial.ensureTrialSchema();
    const d = (await db.getDb())!;
    await d.execute(sql`TRUNCATE "trialPasses", "payment_history", users, lessons, courses RESTART IDENTITY CASCADE`);
    const user = await db.findOrCreateUserByProvider({ provider: "google", providerId: "g-1", email: "liz@gmail.com", name: "Liz" });
    userId = user.id;
    const [curso] = await d.insert(schema.courses).values({ title: "Curso", slug: "curso-logado", instructorId: 1 } as any).returning();
    const [aula] = await d
      .insert(schema.lessons)
      .values({ courseId: curso.id, title: "Aula", order: 1, isPublished: 1, isAccessRestricted: 1, videoPlaybackUrl: "https://v" } as any)
      .returning();
    aulaId = aula.id;
  });

  it("CONFIRMED e depois RECEIVED: um e-mail, para o dono da compra", async () => {
    for (const event of ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]) {
      await trial.processTrialEvent({
        id: `evt_${event}`,
        event,
        payment: { id: "pay_logado", customer: "cus_x", value: 19.9, billingType: "PIX", externalReference: `trial:${userId}:${aulaId}` },
      });
    }
    expect(await trial.hasActiveTrialPass(userId, aulaId)).toBe(true);
    expect(enviarEmailDeAcesso).toHaveBeenCalledTimes(1);
    expect(enviarEmailDeAcesso).toHaveBeenCalledWith({ userId, lessonId: aulaId, contaNova: false });
  });
});

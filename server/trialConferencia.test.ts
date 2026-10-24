import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: async () => null, upsertProviderPayment: async () => ({}) }));
const { conferirTestesPendentes } = await import("./trial");

describe("conferência de testes pendentes (webhook do Asaas não chegou)", () => {
  it("libera só o que o Asaas diz que foi pago, pelo mesmo processTrialEvent", async () => {
    const liberados: any[] = [];
    const status: Record<string, any> = {
      pay_pago: { status: "RECEIVED", value: 19.9, externalReference: "trial:12:20", customer: "cus_1" },
      pay_conf: { status: "CONFIRMED", value: 19.9, externalReference: "trial:2:20", customer: "cus_2" },
      pay_pend: { status: "PENDING", value: 19.9, externalReference: "trial:3:20" },
      pay_outra: { status: "RECEIVED", value: 99.9, externalReference: "user:4|plan:vip" },
    };
    const n = await conferirTestesPendentes({
      pendentes: async () => Object.keys(status).map((asaasPaymentId) => ({ asaasPaymentId })),
      consultar: async (id) => status[id],
      liberar: async (body) => { liberados.push(body); },
    });
    expect(n).toBe(2);
    expect(liberados.map((b) => [b.payment.id, b.event])).toEqual([["pay_pago", "PAYMENT_RECEIVED"], ["pay_conf", "PAYMENT_CONFIRMED"]]);
  });

  it("erro em uma cobrança não impede as outras", async () => {
    const n = await conferirTestesPendentes({
      pendentes: async () => [{ asaasPaymentId: "a" }, { asaasPaymentId: "b" }],
      consultar: async (id) => { if (id === "a") throw new Error("timeout"); return { status: "RECEIVED", value: 19.9, externalReference: "trial:1:2" }; },
      liberar: async () => {},
    });
    expect(n).toBe(1);
  });
});

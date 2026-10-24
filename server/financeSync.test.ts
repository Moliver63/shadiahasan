import { describe, expect, it } from "vitest";
import {
  sincronizarFinanceiro, statusDoAsaas, vinculoDaCobrancaAsaas, lancamentoDoAsaas,
  vinculoDaFaturaStripe, lancamentoDaFaturaStripe, type ContaAsaas, type MapaUsuariosStripe,
} from "./financeSync";

const CONTAS: ContaAsaas[] = [{ userId: 7, asaasCustomerId: "cus_7", asaasSubscriptionId: "sub_7", planSlug: "premium" }];

describe("Asaas", () => {
  it("mapeia status: recebido/confirmado entra, estorno/chargeback vira estorno, o resto fica pendente", () => {
    expect(statusDoAsaas("RECEIVED")).toBe("completed");
    expect(statusDoAsaas("CONFIRMED")).toBe("completed");
    expect(statusDoAsaas("RECEIVED_IN_CASH")).toBe("completed");
    expect(statusDoAsaas("REFUNDED")).toBe("refunded");
    expect(statusDoAsaas("CHARGEBACK_REQUESTED")).toBe("refunded");
    expect(statusDoAsaas("OVERDUE")).toBe("pending");
    expect(statusDoAsaas("REFUND_REQUESTED")).toBe("pending");
    expect(statusDoAsaas(undefined)).toBe("pending");
  });

  it("teste de 1 aula pela referencia trial:<user>:<aula>, com a mesma descricao do webhook", () => {
    const c = { id: "pay_1", value: 19.9, status: "RECEIVED", billingType: "PIX", externalReference: "trial:12:345", paymentDate: "2026-10-23", dateCreated: "2026-10-23", dueDate: "2026-10-23" };
    const v = vinculoDaCobrancaAsaas(c, CONTAS)!;
    expect(v).toMatchObject({ userId: 12, planSlug: "trial", tipo: "trial", lessonId: 345 });
    const l = lancamentoDoAsaas(c, v);
    expect(l).toMatchObject({ userId: 12, amount: 1990, status: "completed", stripeInvoiceId: "asaas:pay_1", paymentMethod: "asaas:pix", planSlug: "trial", description: "Teste de 1 aula (Asaas) — aula 345" });
    // data do Asaas e de Brasilia: nao pode virar o dia anterior em UTC
    expect(l.paidAt!.toISOString().slice(0, 10)).toBe("2026-10-23");
    expect(l.createdAt!.toISOString().slice(0, 10)).toBe("2026-10-23");
  });

  it("assinatura pela conta Asaas quando a cobranca nao traz referencia", () => {
    const v = vinculoDaCobrancaAsaas({ id: "pay_2", subscription: "sub_7", customer: "cus_x" }, CONTAS);
    expect(v).toEqual({ userId: 7, planSlug: "premium", tipo: "assinatura" });
    expect(lancamentoDoAsaas({ id: "pay_2", subscription: "sub_7", value: 99.9, status: "CONFIRMED" }, v!).description).toBe("Assinatura Premium (Asaas)");
  });

  it("estorno grava o valor estornado; pendente nao tem data de pagamento", () => {
    const v = { userId: 1, planSlug: "trial", tipo: "trial" as const };
    expect(lancamentoDoAsaas({ id: "p", value: 19.9, status: "REFUNDED", paymentDate: "2026-10-20" }, v)).toMatchObject({ status: "refunded", refundedAmount: 1990 });
    expect(lancamentoDoAsaas({ id: "p", value: 19.9, status: "PENDING" }, v).paidAt).toBeNull();
  });

  it("sem referencia, assinatura ou cliente conhecido: nao inventa dono", () => {
    expect(vinculoDaCobrancaAsaas({ id: "p", customer: "cus_desconhecido" }, CONTAS)).toBeNull();
  });
});

describe("Stripe", () => {
  const mapa: MapaUsuariosStripe = {
    porCliente: new Map([["cus_s", 3]]),
    porAssinatura: new Map([["sub_s", { userId: 4, planSlug: "basic" }]]),
    porEmail: new Map([["ana@x.com", 5]]),
  };
  it("vincula por assinatura, depois cliente, depois e-mail", () => {
    expect(vinculoDaFaturaStripe({ id: "in_1", parent: { subscription_details: { subscription: "sub_s" } } }, mapa)).toEqual({ userId: 4, planSlug: "basic" });
    expect(vinculoDaFaturaStripe({ id: "in_2", customer: "cus_s" }, mapa)?.userId).toBe(3);
    expect(vinculoDaFaturaStripe({ id: "in_3", customer_email: " Ana@X.com " }, mapa)?.userId).toBe(5);
    expect(vinculoDaFaturaStripe({ id: "in_4", customer: "cus_nada" }, mapa)).toBeNull();
  });
  it("fatura paga usa amount_paid e a mesma chave do webhook; rascunho e ignorado", () => {
    const l = lancamentoDaFaturaStripe({ id: "in_9", status: "paid", amount_paid: 9990, currency: "brl", created: 1761200000, status_transitions: { paid_at: 1761200100 } }, { userId: 4, planSlug: "premium" })!;
    expect(l).toMatchObject({ stripeInvoiceId: "in_9", amount: 9990, status: "completed", currency: "BRL", paymentMethod: "stripe" });
    expect(lancamentoDaFaturaStripe({ id: "in_d", status: "draft" }, { userId: 4, planSlug: null })).toBeNull();
    expect(lancamentoDaFaturaStripe({ id: "in_v", status: "void", amount_due: 4990 }, { userId: 4, planSlug: null })).toMatchObject({ status: "failed", amount: 4990, paidAt: null });
  });
});

describe("sincronizarFinanceiro", () => {
  it("pagina o Asaas, grava so o que tem dono, conta o resto e nunca chama acesso", async () => {
    const gravadas: any[] = [];
    const paginas = [
      { data: [{ id: "a1", value: 19.9, status: "RECEIVED", externalReference: "trial:1:2" }, { id: "a2", value: 10, status: "PENDING", customer: "cus_?" }], hasMore: true },
      { data: [{ id: "a3", value: 99.9, status: "CONFIRMED", subscription: "sub_7" }, { id: "a4", deleted: true }], hasMore: false },
    ];
    const offsets: number[] = [];
    const r = await sincronizarFinanceiro({
      asaasConfigurado: true, stripeConfigurado: false,
      contasAsaas: async () => CONTAS,
      listarCobrancasAsaas: async (offset) => { offsets.push(offset); return paginas[offsets.length - 1] as any; },
      gravar: async (l) => { gravadas.push(l); },
    });
    expect(offsets).toEqual([0, 2]);
    expect(gravadas.map((g) => g.stripeInvoiceId)).toEqual(["asaas:a1", "asaas:a3"]);
    expect(r.asaas).toMatchObject({ lidas: 4, gravadas: 2, semUsuario: 1, ignoradas: 1 });
    expect(r.asaas.exemplosSemUsuario?.[0]).toContain("a2");
    expect(r.stripe.configurado).toBe(false);
  });

  it("erro de um provedor nao derruba o outro", async () => {
    const r = await sincronizarFinanceiro({
      asaasConfigurado: true, stripeConfigurado: true,
      contasAsaas: async () => { throw new Error("401 chave invalida"); },
      listarCobrancasAsaas: async () => ({ data: [], hasMore: false }),
      mapaStripe: async () => ({ porCliente: new Map([["c", 9]]), porAssinatura: new Map(), porEmail: new Map() }),
      listarFaturasStripe: async () => ({ data: [{ id: "in_1", status: "paid", customer: "c", amount_paid: 4990 }], has_more: false }),
      gravar: async () => {},
    });
    expect(r.asaas.erro).toContain("401");
    expect(r.stripe).toMatchObject({ lidas: 1, gravadas: 1 });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { avisarVenda, deveAvisar, formaDePagamento, textoDaVenda } from "./avisoVenda";

describe("aviso de venda (ntfy)", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.NTFY_TOPIC; });

  it("monta o texto sem dados pessoais", () => {
    const t = textoDaVenda({ amount: 1990, planSlug: "trial", paymentMethod: "asaas:pix" });
    expect(t.titulo).toMatch(/Venda confirmada: R\$\s19,90/);
    expect(t.corpo).toMatch(/^Teste de 1 aula · Pix · /);
    expect(textoDaVenda({ amount: 9990, planSlug: "premium", paymentMethod: "stripe" }).corpo).toMatch(/^Assinatura \(premium\) · Cartão/);
  });

  it("traduz a forma de pagamento", () => {
    expect(formaDePagamento("asaas:credit_card")).toBe("Cartão");
    expect(formaDePagamento("asaas:boleto")).toBe("Boleto");
    expect(formaDePagamento(null)).toBe("não informado");
  });

  it("não avisa pagamento antigo", () => {
    const agora = Date.parse("2026-11-02T15:00:00Z");
    expect(deveAvisar({ paidAt: new Date("2026-11-02T00:00:00Z") }, agora)).toBe(true);
    expect(deveAvisar({ paidAt: new Date("2026-10-20T00:00:00Z") }, agora)).toBe(false);
    expect(deveAvisar({}, agora)).toBe(true);
  });

  it("não envia sem NTFY_TOPIC e envia JSON quando configurado", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", f);
    await avisarVenda({ amount: 1990, planSlug: "trial" });
    expect(f).not.toHaveBeenCalled();

    process.env.NTFY_TOPIC = "topico-teste";
    await avisarVenda({ amount: 1990, planSlug: "trial", paymentMethod: "asaas:pix" });
    expect(f).toHaveBeenCalledOnce();
    const corpo = JSON.parse(f.mock.calls[0][1].body);
    expect(corpo.topic).toBe("topico-teste");
    expect(corpo.title).toContain("19,90");
  });

  it("nunca lança se o ntfy falhar", async () => {
    process.env.NTFY_TOPIC = "x";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    await expect(avisarVenda({ amount: 100 })).resolves.toBeUndefined();
  });
});

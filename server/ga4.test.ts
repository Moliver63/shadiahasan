import { describe, expect, it, vi } from "vitest";
import { clientIdValido, enviarCompraGA4, ga4ServidorConfigurado, montarCorpo } from "./ga4";

const compra = { clientId: "111.222", sessionId: "1730000123", userId: 50, transactionId: "pay_abc", valor: 19.9, itemId: "lesson:20", itemNome: "Introdução" };

describe("compra no GA4 pelo servidor", () => {
  it("só liga com a chave secreta", () => {
    expect(ga4ServidorConfigurado({})).toBe(false);
    expect(ga4ServidorConfigurado({ GA4_API_SECRET: "x" })).toBe(true);
  });
  it("corpo: purchase com transaction_id, sessão, user_id interno e anúncios negados", () => {
    const c = montarCorpo(compra);
    expect(c.client_id).toBe("111.222");
    expect(c.user_id).toBe("50");
    expect(c.consent).toEqual({ ad_user_data: "DENIED", ad_personalization: "DENIED" });
    expect(c.events[0].name).toBe("purchase");
    expect(c.events[0].params).toMatchObject({ transaction_id: "pay_abc", value: 19.9, currency: "BRL", session_id: "1730000123" });
    expect(JSON.stringify(c)).not.toContain("@");
  });
  it("sem chave ou sem client_id válido (sem consentimento) não envia", async () => {
    const f = vi.fn();
    expect(await enviarCompraGA4(compra, { env: {}, fetchImpl: f as any })).toBe(false);
    expect(await enviarCompraGA4({ ...compra, clientId: "x" }, { env: { GA4_API_SECRET: "s" }, fetchImpl: f as any })).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(clientIdValido("123.456")).toBe(true);
  });
  it("envia para o endpoint do GA4 e nunca lança", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    expect(await enviarCompraGA4(compra, { env: { GA4_API_SECRET: "s3cr3t" }, fetchImpl: f as any })).toBe(true);
    expect(f.mock.calls[0][0]).toContain("measurement_id=G-DGCPN51SD6");
    const quebra = vi.fn().mockRejectedValue(new Error("rede"));
    expect(await enviarCompraGA4(compra, { env: { GA4_API_SECRET: "s" }, fetchImpl: quebra as any })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { configuracaoDeRastreamento, montarFunil } from "./conversoes";

describe("funil por origem", () => {
  it("soma cobranças, pagas e receita; sem UTM fica em um grupo", () => {
    const f = montarFunil([
      { source: "instagram", campaign: "a", paga: true, centavos: 1990 },
      { source: "instagram", campaign: "a", paga: false, centavos: 1990 },
      { source: null, paga: false, centavos: 5700 },
    ]);
    expect(f.total).toEqual({ cobrancas: 3, pagas: 1, receitaCentavos: 1990 });
    expect(f.porOrigem[0]).toMatchObject({ origem: "instagram", campanha: "a", cobrancas: 2, pagas: 1 });
    expect(f.porOrigem[1].origem).toMatch(/Sem UTM/);
  });
});

describe("configuração de rastreamento", () => {
  it("diz o que falta e avisa modo teste, sem expor valores", () => {
    const c = configuracaoDeRastreamento({ META_PIXEL_ID: "123", TIKTOK_PIXEL_ID: "p", TIKTOK_EVENTS_ACCESS_TOKEN: "segredo", TIKTOK_EVENTS_TEST_CODE: "T1" } as any);
    expect(c.metaServidor).toMatchObject({ ligado: false, faltando: ["META_CAPI_ACCESS_TOKEN"] });
    expect(c.tiktokServidor).toMatchObject({ ligado: true, modoTeste: "TIKTOK_EVENTS_TEST_CODE" });
    expect(JSON.stringify(c)).not.toContain("segredo");
  });
});

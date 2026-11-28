import { describe, expect, it } from "vitest";
import { montarCsv, montarLinkDeCampanha } from "./campanhaLink";

describe("link de campanha", () => {
  it("normaliza os campos e mantém o link no site", () => {
    expect(montarLinkDeCampanha({ caminho: "https://outro.com/collections/8", origem: "Instagram", meio: "bio", campanha: "Aula 19,90 Novembro" }))
      .toBe("https://shadiahasan.com/collections/8?utm_source=instagram&utm_medium=bio&utm_campaign=aula-19-90-novembro");
    expect(montarLinkDeCampanha({ caminho: "//evil.com", origem: "meta", meio: "", campanha: "x" })).toMatch(/^https:\/\/shadiahasan\.com\//);
  });
  it("sem origem ou campanha não gera link", () => {
    expect(montarLinkDeCampanha({ caminho: "/", origem: "", meio: "cpc", campanha: "x" })).toBeNull();
  });
  it("CSV escapa aspas e neutraliza fórmula", () => {
    expect(montarCsv([['=1+1', 'a"b,c']])).toBe(`"'=1+1","a""b,c"`);
  });
});

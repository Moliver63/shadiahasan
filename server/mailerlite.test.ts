import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinaturaValida, emailsCancelados, grupoDaOrigem, lerMapaGrupos, montarInscrito } from "./mailerlite";

describe("mapa de grupos do MailerLite", () => {
  it("lê JSON e descarta ids que não são números", () => {
    expect(lerMapaGrupos('{"autoavaliacao":"204468296120010379","home":"abc","*":123}')).toEqual({
      autoavaliacao: "204468296120010379",
      "*": "123",
    });
  });
  it("variável vazia ou inválida não sincroniza nada", () => {
    expect(lerMapaGrupos(undefined)).toEqual({});
    expect(lerMapaGrupos("{quebrado")).toEqual({});
    expect(lerMapaGrupos("[1,2]")).toEqual({});
  });
  it("usa o grupo da origem, depois o *, senão nenhum", () => {
    expect(grupoDaOrigem({ autoavaliacao: "1", "*": "9" }, "autoavaliacao")).toBe("1");
    expect(grupoDaOrigem({ autoavaliacao: "1", "*": "9" }, "home")).toBe("9");
    expect(grupoDaOrigem({ autoavaliacao: "1" }, "home")).toBeNull();
  });
});

describe("montarInscrito", () => {
  it("envia primeiro nome, origem, perfil, UTMs e data da confirmação", () => {
    const corpo = montarInscrito(
      {
        email: " Maria@Exemplo.com ",
        nome: "Maria da Silva",
        origem: "autoavaliacao",
        perfil: "evita",
        utmSource: "google",
        utmCampaign: "comunicacao-pesquisa",
        utmTerm: null,
        confirmadoEm: new Date("2026-11-18T10:00:00Z"),
      },
      "42",
    );
    expect(corpo).toEqual({
      email: "maria@exemplo.com",
      fields: { name: "Maria", origem: "autoavaliacao", perfil: "evita", utm_source: "google", utm_campaign: "comunicacao-pesquisa" },
      groups: ["42"],
      status: "active",
      opted_in_at: "2026-11-18 10:00:00",
    });
  });
  it("sem nome e sem data, não manda campos vazios", () => {
    const corpo = montarInscrito(
      { email: "a@b.com", nome: null, origem: "home", perfil: null, utmSource: null, utmCampaign: null, utmTerm: null, confirmadoEm: null },
      "7",
    );
    expect(corpo).toEqual({ email: "a@b.com", fields: { origem: "home" }, groups: ["7"], status: "active" });
  });
});

describe("webhook do MailerLite", () => {
  const segredo = "segredo-de-teste";
  const corpo = JSON.stringify({ type: "subscriber.unsubscribed", subscriber: { email: "X@Y.com" } });
  const assinatura = createHmac("sha256", segredo).update(corpo).digest("hex");

  it("aceita só a assinatura certa", () => {
    expect(assinaturaValida(corpo, assinatura, segredo)).toBe(true);
    expect(assinaturaValida(corpo + " ", assinatura, segredo)).toBe(false);
    expect(assinaturaValida(corpo, undefined, segredo)).toBe(false);
    expect(assinaturaValida(corpo, assinatura, "")).toBe(false);
  });
  it("extrai e-mails cancelados em envio simples e em lote, ignorando outros eventos", () => {
    expect(emailsCancelados(JSON.parse(corpo))).toEqual(["x@y.com"]);
    expect(
      emailsCancelados({
        events: [
          { type: "subscriber.unsubscribed", data: { email: "a@b.com" } },
          { type: "subscriber.created", subscriber: { email: "c@d.com" } },
          { type: "subscriber.unsubscribed", subscriber: { email: "a@b.com" } },
        ],
      }),
    ).toEqual(["a@b.com"]);
    expect(emailsCancelados({ type: "subscriber.created", subscriber: { email: "c@d.com" } })).toEqual([]);
  });
});

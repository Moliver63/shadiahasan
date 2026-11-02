import { describe, expect, it } from "vitest";
import { dataEmBrasilia, momentoDoPagamento } from "./pagamentoData";

// 29/10/2026 13:20 em Brasília
const AGORA = new Date("2026-10-29T16:20:57Z");

describe("momentoDoPagamento", () => {
  it("só a data, de hoje em Brasília: usa o instante atual, não meia-noite", () => {
    expect(momentoDoPagamento("2026-10-29", AGORA).toISOString()).toBe(AGORA.toISOString());
  });

  it("só a data, de outro dia: meio-dia de Brasília daquele dia", () => {
    const d = momentoDoPagamento("2026-10-27", AGORA);
    expect(d.toISOString()).toBe("2026-10-27T15:00:00.000Z");
    expect(dataEmBrasilia(d)).toBe("2026-10-27");
  });

  it("com hora: usa como veio", () => {
    expect(momentoDoPagamento("2026-10-29T10:05:00-03:00", AGORA).toISOString()).toBe("2026-10-29T13:05:00.000Z");
  });

  it("vazio ou inválido: agora", () => {
    expect(momentoDoPagamento(null, AGORA)).toBe(AGORA);
    expect(momentoDoPagamento("", AGORA)).toBe(AGORA);
    expect(momentoDoPagamento("ontem", AGORA)).toBe(AGORA);
  });

  it("perto da meia-noite UTC ainda é o dia de Brasília", () => {
    // 01:30 UTC do dia 30 = 22:30 do dia 29 em Brasília
    const tarde = new Date("2026-10-30T01:30:00Z");
    expect(momentoDoPagamento("2026-10-29", tarde)).toBe(tarde);
  });
});

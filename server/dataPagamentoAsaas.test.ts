import { describe, expect, it } from "vitest";
import { dataDePagamentoAsaas } from "./dataPagamentoAsaas";

describe("dataDePagamentoAsaas", () => {
  const agora = new Date("2026-11-26T16:25:56Z"); // 13:25 em Brasília
  it("pagamento de hoje: nunca no dia anterior nem no futuro", () => {
    const d = dataDePagamentoAsaas("2026-11-26", agora);
    expect(d.getTime()).toBeLessThanOrEqual(agora.getTime());
    expect(d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })).toBe("26/11/2026");
  });
  it("pagamento de dia anterior: meio-dia de Brasília, mesmo dia", () => {
    const d = dataDePagamentoAsaas("2026-10-28", agora);
    expect(d.toISOString()).toBe("2026-10-28T15:00:00.000Z");
    expect(d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })).toBe("28/10/2026");
  });
  it("sem data ou data inválida: agora", () => {
    expect(dataDePagamentoAsaas(null, agora)).toBe(agora);
    expect(dataDePagamentoAsaas("lixo", agora)).toBe(agora);
  });
});

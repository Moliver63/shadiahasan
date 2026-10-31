import { describe, expect, it } from "vitest";
import { calcularPassos, respostaValida } from "./requisitos";

describe("resposta de verdade", () => {
  it("aceita resposta com as próprias palavras", () => {
    expect(respostaValida("Entendi que preciso observar meus pensamentos antes de reagir.")).toBe(true);
  });
  it("recusa curta, vazia, repetida ou sem sentido", () => {
    expect(respostaValida("")).toBe(false);
    expect(respostaValida("muito bom")).toBe(false);
    expect(respostaValida("a".repeat(60))).toBe(false);
    expect(respostaValida("bom bom bom bom bom bom bom bom bom bom bom")).toBe(false);
    expect(respostaValida(null)).toBe(false);
  });
});

describe("passos do certificado", () => {
  const base = { assistida: true, disponiveis: 3, respondidas: 3, depoimento: true };
  it("só libera com os três requisitos", () => {
    expect(calcularPassos(base).liberado).toBe(true);
    expect(calcularPassos({ ...base, assistida: false }).liberado).toBe(false);
    expect(calcularPassos({ ...base, respondidas: 2 }).liberado).toBe(false);
    expect(calcularPassos({ ...base, depoimento: false }).liberado).toBe(false);
  });
  it("aula com menos de 3 perguntas publicadas nunca libera", () => {
    const p = calcularPassos({ ...base, disponiveis: 2, respondidas: 2 });
    expect(p.perguntasProntas).toBe(false);
    expect(p.liberado).toBe(false);
  });
  it("indica o próximo passo na ordem: assistir, perguntas, depoimento", () => {
    expect(calcularPassos({ ...base, assistida: false, respondidas: 0, depoimento: false }).proximo).toBe("assistir");
    expect(calcularPassos({ ...base, respondidas: 1, depoimento: false }).proximo).toBe("perguntas");
    expect(calcularPassos({ ...base, depoimento: false }).proximo).toBe("depoimento");
    expect(calcularPassos(base).proximo).toBe("liberado");
  });
});

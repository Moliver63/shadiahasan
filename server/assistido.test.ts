import { describe, expect, it } from "vitest";
import { atingiuMinimo, creditoDoPulso, duracaoEfetiva, MAX_POR_PULSO, PRIMEIRO_PULSO } from "./assistido";

describe("crédito de tempo assistido", () => {
  it("primeiro envio rende no máximo 20 s, mesmo que o navegador diga 3600", () => {
    expect(creditoDoPulso(3600, null)).toBe(PRIMEIRO_PULSO);
    expect(creditoDoPulso(10, null)).toBe(10);
  });

  it("limita pelo tempo real decorrido (até 2x de velocidade) e pelo teto por envio", () => {
    expect(creditoDoPulso(15, 15)).toBe(15); // reprodução normal
    expect(creditoDoPulso(30, 15)).toBe(30); // 2x
    expect(creditoDoPulso(3600, 15)).toBeCloseTo(31.5); // 15 s reais rendem no máximo 31,5 s de vídeo
    expect(creditoDoPulso(3600, 60)).toBe(MAX_POR_PULSO); // teto por envio
    expect(creditoDoPulso(30, 2)).toBeCloseTo(4.2); // 2 s reais não rendem 30 s de vídeo
    expect(creditoDoPulso(30, 0)).toBe(0); // rajada de chamadas não rende nada
  });

  it("ignora valores inválidos ou negativos", () => {
    expect(creditoDoPulso(-5, 10)).toBe(0);
    expect(creditoDoPulso(Number.NaN, 10)).toBe(0);
    expect(creditoDoPulso(10, Number.NaN)).toBe(0);
  });

  it("não dá para acelerar: spam de chamadas rende no máximo 2,1x o tempo real", () => {
    // 600 chamadas, uma por segundo, pedindo 40 s cada: 10 minutos reais
    let total = creditoDoPulso(40, null);
    for (let i = 0; i < 600; i++) total += creditoDoPulso(40, 1);
    expect(total).toBeLessThanOrEqual(600 * 2.1 + PRIMEIRO_PULSO + 0.001);
    // uma aula de 1 h exige 2880 s: levaria no mínimo ~23 min reais
    expect(total).toBeLessThan(2880);
  });
});

describe("regra dos 80%", () => {
  it("só conta com 80% da duração e com duração conhecida", () => {
    expect(atingiuMinimo(800, 1000)).toBe(true);
    expect(atingiuMinimo(799, 1000)).toBe(false);
    expect(atingiuMinimo(5000, null)).toBe(false);
    expect(atingiuMinimo(5000, 0)).toBe(false);
  });

  it("usa a duração da aula; sem ela, a do player dentro de limites", () => {
    expect(duracaoEfetiva(600, 5)).toBe(600);
    expect(duracaoEfetiva(null, 600)).toBe(600);
    expect(duracaoEfetiva(0, 5)).toBe(30); // piso: não dá para "assistir" 5 s e ganhar
    expect(duracaoEfetiva(null, 10 * 3600)).toBe(6 * 3600);
    expect(duracaoEfetiva(null, null)).toBeNull();
  });
});

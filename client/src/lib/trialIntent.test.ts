import { describe, expect, it } from "vitest";
import { guardarIntencao, lerIntencao, limparIntencao, veioDaOferta } from "./trialIntent";

function memoria() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("intenção de compra do teste", () => {
  it("guarda antes do login e devolve depois, dentro de 1 hora", () => {
    const s = memoria();
    guardarIntencao(20, 1_000, s);
    expect(lerIntencao(1_000 + 30 * 60_000, s)).toBe(20);
  });
  it("vencida some", () => {
    const s = memoria();
    guardarIntencao(20, 0, s);
    expect(lerIntencao(61 * 60_000, s)).toBeNull();
    expect(s.getItem("shadia:trialIntent")).toBeNull();
  });
  it("lixo no storage nao quebra", () => {
    const s = memoria();
    s.setItem("shadia:trialIntent", "{nao json");
    expect(lerIntencao(0, s)).toBeNull();
    s.setItem("shadia:trialIntent", JSON.stringify({ lessonId: -3, em: 0 }));
    expect(lerIntencao(0, s)).toBeNull();
  });
  it("limpar apaga", () => {
    const s = memoria();
    guardarIntencao(5, 0, s);
    limparIntencao(s);
    expect(lerIntencao(0, s)).toBeNull();
  });
});

describe("visitante do anúncio", () => {
  it("reconhece o link real da campanha 804", () => {
    expect(veioDaOferta("?utm_source=meta&utm_medium=paid&utm_campaign=aula-19-90&fbclid=x", "")).toBe(true);
  });
  it("reconhece link direto para a oferta", () => {
    expect(veioDaOferta("", "#experimente-uma-aula")).toBe(true);
    expect(veioDaOferta("?oferta", "")).toBe(true);
  });
  it("visita comum nao rola a página", () => {
    expect(veioDaOferta("?utm_campaign=outra", "")).toBe(false);
    expect(veioDaOferta("", "")).toBe(false);
  });
});

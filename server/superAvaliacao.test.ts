import { describe, expect, it } from "vitest";
import { lerDevolutiva, normalizarRespostas, temMaterialSuficiente, temSinalDeRisco, TEXTO_CUIDADO } from "../shared/superAvaliacao";

const r = (resposta: string) => ({ secao: "Mapa", pergunta: "P", resposta });
const json = (extra: Record<string, unknown> = {}) => JSON.stringify({
  abertura: "Li com atenção.", padroes: [{ titulo: "Leitura de silêncio", texto: "Você lê silêncio como rejeição." }],
  forcas: ["Você já testou outra leitura."], perguntas: ["O que mais pode ser?"], passos: ["Pergunte antes de concluir."], fechamento: "Siga.", cuidado: "", ...extra,
});

describe("Super Avaliação: regras", () => {
  it("normaliza: descarta vazias, corta tamanho e ignora formato errado", () => {
    expect(normalizarRespostas("x")).toEqual([]);
    const out = normalizarRespostas([{ resposta: "  " }, { secao: "A", pergunta: "B", resposta: "ok" }, { resposta: "y".repeat(5000) }]);
    expect(out).toHaveLength(2);
    expect(out[1].resposta).toHaveLength(3000);
  });

  it("exige material mínimo diferente para o exercício e para o diário", () => {
    const quatro = [r("a b c d e f g"), r("a b c d e f g"), r("a b c d e f g"), r("a b c d e f g")];
    expect(temMaterialSuficiente("amostra", quatro)).toBe(true);
    expect(temMaterialSuficiente("amostra", quatro.slice(0, 3))).toBe(false);
    expect(temMaterialSuficiente("diario", quatro)).toBe(false);
  });

  it("detecta sinais de risco", () => {
    expect(temSinalDeRisco([r("às vezes penso em me matar")])).toBe(true);
    expect(temSinalDeRisco([r("fiquei com vergonha na reunião")])).toBe(false);
  });

  it("lê o JSON da IA, mesmo com cerca de código, e recusa resposta incompleta", () => {
    expect(lerDevolutiva("```json\n" + json() + "\n```", false)?.padroes[0].titulo).toBe("Leitura de silêncio");
    expect(lerDevolutiva("não sei", false)).toBeNull();
    expect(lerDevolutiva(json({ passos: [] }), false)).toBeNull();
    expect(lerDevolutiva(json(), false)?.cuidado).toBeUndefined();
  });

  it("com risco, sempre abre com o cuidado e o CVV, mesmo se a IA esquecer", () => {
    expect(lerDevolutiva(json(), true)?.cuidado).toBe(TEXTO_CUIDADO);
    expect(lerDevolutiva(json({ cuidado: "Cuide-se." }), true)?.cuidado).toMatch(/188/);
  });
});

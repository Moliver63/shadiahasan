import { describe, expect, it } from "vitest";
import { decidirEmissoes, gerarNumero, lerConcluidas, nomeValido, numeroValido } from "./certificados";
import { dataPorExtenso, gerarPdfCertificado } from "./certificadoPdf";

const vazio = new Set<number>();

describe("regras de emissão", () => {
  const programa = { id: 7, title: "Permita-se SER LIVRE", lessonIds: [1, 2, 3] };

  it("aula nova ganha certificado de aula; o geral só quando TODAS as aulas do Programa foram concluídas", () => {
    const parcial = decidirEmissoes({ novasAulas: [2], concluidas: new Set([1, 2]), programas: [programa], jaTemAula: vazio, jaTemPrograma: vazio });
    expect(parcial).toEqual({ aulas: [2], programas: [] });

    const completo = decidirEmissoes({ novasAulas: [3], concluidas: new Set([1, 2, 3]), programas: [programa], jaTemAula: new Set([1, 2]), jaTemPrograma: vazio });
    expect(completo).toEqual({ aulas: [3], programas: [7] });
  });

  it("nunca duplica: aula e Programa que o aluno já tem não saem de novo", () => {
    const r = decidirEmissoes({ novasAulas: [1, 2, 3], concluidas: new Set([1, 2, 3]), programas: [programa], jaTemAula: new Set([1, 2, 3]), jaTemPrograma: new Set([7]) });
    expect(r).toEqual({ aulas: [], programas: [] });
  });

  it("aula repetida na lista conta uma vez", () => {
    expect(decidirEmissoes({ novasAulas: [5, 5, 5], concluidas: new Set([5]), programas: [], jaTemAula: vazio, jaTemPrograma: vazio }).aulas).toEqual([5]);
  });

  it("Programa com 1 aula não gera o geral (seria igual ao da aula) e Programa sem aulas também não", () => {
    const um = { id: 8, title: "Curto", lessonIds: [9] };
    const nenhum = { id: 9, title: "Vazio", lessonIds: [] };
    const r = decidirEmissoes({ novasAulas: [9], concluidas: new Set([9]), programas: [um, nenhum], jaTemAula: vazio, jaTemPrograma: vazio });
    expect(r).toEqual({ aulas: [9], programas: [] });
  });

  it("uma aula que está em dois Programas pode fechar os dois ao mesmo tempo", () => {
    const outro = { id: 11, title: "Outro", lessonIds: [3, 4] };
    const r = decidirEmissoes({ novasAulas: [3], concluidas: new Set([1, 2, 3, 4]), programas: [programa, outro], jaTemAula: vazio, jaTemPrograma: vazio });
    expect([...r.programas].sort((a, b) => a - b)).toEqual([7, 11]);
  });
});

describe("número do certificado", () => {
  it("segue o formato SH-AAAA-XXXXXXXX sem caracteres confusos e quase nunca repete", () => {
    const nums = Array.from({ length: 2000 }, () => gerarNumero(new Date("2026-10-30T12:00:00Z")));
    for (const n of nums.slice(0, 50)) {
      expect(n).toMatch(/^SH-2026-[A-HJ-NP-Z2-9]{8}$/);
      expect(numeroValido(n)).toBe(true);
    }
    expect(new Set(nums).size).toBe(nums.length);
  });
  it("recusa lixo e números no formato antigo (que dava para adivinhar)", () => {
    for (const ruim of ["", "SH-1730000000000-3-9", "sh-2026-ABCDEFGH", "SH-2026-ABCDEFG0", "SH-2026-ABCDEFGHI", "'; DROP TABLE users;--", 42, null]) {
      expect(numeroValido(ruim as any)).toBe(false);
    }
  });
});

describe("dados de entrada", () => {
  it("lê a lista de aulas concluídas do jeito que o site grava, tolerando lixo", () => {
    expect(lerConcluidas("[1,2,3]")).toEqual([1, 2, 3]);
    expect(lerConcluidas('["4", 5, -1, 0, 1.5, "x"]')).toEqual([4, 5]);
    expect(lerConcluidas("não é json")).toEqual([]);
    expect(lerConcluidas('{"a":1}')).toEqual([]);
    expect(lerConcluidas(null)).toEqual([]);
  });
  it("nome parecido com e-mail ou vazio não vai impresso no certificado", () => {
    expect(nomeValido("  Maria Souza ")).toBe("Maria Souza");
    expect(nomeValido("maria@gmail.com")).toBeNull();
    expect(nomeValido("   ")).toBeNull();
    expect(nomeValido(null)).toBeNull();
  });
});

describe("PDF", () => {
  const base = { numero: "SH-2026-K7M3QX9A", emitidoEm: new Date("2026-10-30T02:30:00Z"), urlVerificacao: "https://shadiahasan.com/certificado/SH-2026-K7M3QX9A" };

  it("data por extenso usa o dia de Brasília (23h30 de 29/10 em Brasília ainda é dia 29)", () => {
    expect(dataPorExtenso(new Date("2026-10-30T02:30:00Z"))).toBe("29 de outubro de 2026");
  });

  it("gera um PDF de uma página para aula e para Programa, inclusive com nome e título enormes", async () => {
    const casos = [
      { ...base, tipo: "aula" as const, nomeAluno: "Maria Aparecida de Souza", titulo: "Reconhecendo padrões", subtitulo: "Permita-se SER LIVRE" },
      { ...base, tipo: "programa" as const, nomeAluno: "João", titulo: "Permita-se SER LIVRE", subtitulo: null },
      { ...base, tipo: "aula" as const, nomeAluno: "A".repeat(120), titulo: "T ".repeat(150), subtitulo: "P ".repeat(100) },
    ];
    for (const c of casos) {
      const pdf = await gerarPdfCertificado(c);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(5_000);
      expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    }
  });
});

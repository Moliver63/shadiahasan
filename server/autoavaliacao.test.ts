import { describe, expect, it } from "vitest";
import { AVISO_AUTOAVALIACAO, calcularResultado, ESTILOS, PERFIS, PERGUNTAS, type Estilo } from "../shared/autoavaliacao";

/** Respostas que escolhem sempre a opção do estilo pedido. */
const sempre = (e: Estilo) => PERGUNTAS.map((p) => p.opcoes.findIndex((o) => o.estilo === e));

describe("autoavaliação: conteúdo", () => {
  it("cada pergunta tem uma opção de cada estilo, sem repetir", () => {
    for (const p of PERGUNTAS) {
      expect(p.opcoes.map((o) => o.estilo).sort()).toEqual([...ESTILOS].sort());
    }
  });

  it("a opção que revela o estilo não cai sempre na mesma posição", () => {
    for (const e of ESTILOS) {
      const posicoes = new Set(sempre(e));
      expect(posicoes.size).toBeGreaterThan(1);
    }
  });

  it("tem 8 situações e um perfil completo por estilo", () => {
    expect(PERGUNTAS).toHaveLength(8);
    for (const e of ESTILOS) {
      const p = PERFIS[e];
      expect(p.titulo.length).toBeGreaterThan(5);
      expect(p.texto.length).toBeGreaterThanOrEqual(2);
      expect(p.passo.length).toBeGreaterThan(20);
    }
  });

  it("texto sem travessão e sem se apresentar como teste ou diagnóstico", () => {
    const todo = JSON.stringify([PERGUNTAS, PERFIS]);
    expect(todo).not.toMatch(/[—–]/);
    expect(AVISO_AUTOAVALIACAO).toMatch(/não é teste psicológico nem diagnóstico/i);
    expect(todo).not.toMatch(/diagn[óo]stic/i);
  });
});

describe("autoavaliação: cálculo", () => {
  it("quem escolhe sempre o mesmo estilo recebe esse estilo, sem secundário", () => {
    for (const e of ESTILOS) {
      const r = calcularResultado(sempre(e))!;
      expect(r.principal).toBe(e);
      expect(r.secundario).toBeNull();
      expect(r.contagens[e]).toBe(8);
    }
  });

  it("mostra o segundo padrão só quando ele também pesa (3 respostas ou mais)", () => {
    const r1 = sempre("evita");
    const forte = sempre("forte");
    const com2 = r1.map((v, i) => (i < 2 ? forte[i] : v)); // 6 evita + 2 forte
    expect(calcularResultado(com2)!.secundario).toBeNull();
    const com3 = r1.map((v, i) => (i < 3 ? forte[i] : v)); // 5 evita + 3 forte
    const r = calcularResultado(com3)!;
    expect(r.principal).toBe("evita");
    expect(r.secundario).toBe("forte");
  });

  it("empate é decidido sempre do mesmo jeito (claro, evita, indireto, forte)", () => {
    const partes: Record<Estilo, number[]> = { claro: sempre("claro"), evita: sempre("evita"), forte: sempre("forte"), indireto: sempre("indireto") };
    const mistura = (a: Estilo, b: Estilo) => PERGUNTAS.map((_, i) => (i < 4 ? partes[a][i] : partes[b][i]));
    expect(calcularResultado(mistura("forte", "claro"))!.principal).toBe("claro");
    expect(calcularResultado(mistura("forte", "indireto"))!.principal).toBe("indireto");
    expect(calcularResultado(mistura("indireto", "evita"))!.principal).toBe("evita");
  });

  it("recusa respostas incompletas, fora da faixa ou do tipo errado", () => {
    expect(calcularResultado([])).toBeNull();
    expect(calcularResultado(sempre("claro").slice(0, 7))).toBeNull();
    expect(calcularResultado([...sempre("claro").slice(0, 7), 4])).toBeNull();
    expect(calcularResultado([...sempre("claro").slice(0, 7), -1])).toBeNull();
    expect(calcularResultado([...sempre("claro").slice(0, 7), 1.5])).toBeNull();
    expect(calcularResultado(null as any)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { descreverIntervalo, dentroDaJanelaDeEnvio, horaEmBrasilia, MAX_PASSOS, PASSOS_INICIAIS, validarPassos, type PassoEntrada } from "./marketingSequencia";

const passo = (o: Partial<PassoEntrada> = {}): PassoEntrada => ({ diasDepois: 0, assunto: "Assunto válido", corpo: "Texto com mais de trinta caracteres para passar na validação.", botaoTexto: null, botaoUrl: null, pularSeAssina: false, ...o });

describe("janela de envio (horário de Brasília)", () => {
  it("manda das 8h às 19h59 e espera fora disso", () => {
    expect(dentroDaJanelaDeEnvio(new Date("2026-10-31T10:59:00Z"))).toBe(false); // 07:59
    expect(dentroDaJanelaDeEnvio(new Date("2026-10-31T11:00:00Z"))).toBe(true); // 08:00
    expect(dentroDaJanelaDeEnvio(new Date("2026-10-31T22:59:00Z"))).toBe(true); // 19:59
    expect(dentroDaJanelaDeEnvio(new Date("2026-10-31T23:00:00Z"))).toBe(false); // 20:00
    expect(dentroDaJanelaDeEnvio(new Date("2026-10-31T03:00:00Z"))).toBe(false); // 00:00
  });
  it("meia-noite é hora 0, não 24", () => {
    expect(horaEmBrasilia(new Date("2026-10-31T03:00:00Z"))).toBe(0);
  });
});

describe("validarPassos", () => {
  it("aceita uma lista válida", () => expect(validarPassos([passo(), passo({ diasDepois: 3 })])).toBeNull());
  it("recusa vazia e acima do limite", () => {
    expect(validarPassos([])).toMatch(/pelo menos um/);
    expect(validarPassos(Array.from({ length: MAX_PASSOS + 1 }, () => passo()))).toMatch(/No máximo/);
  });
  it("recusa intervalo inválido e aponta o e-mail", () => {
    expect(validarPassos([passo(), passo({ diasDepois: -1 })])).toMatch(/E-mail 2.*intervalo/);
    expect(validarPassos([passo({ diasDepois: 1.5 })])).toMatch(/E-mail 1/);
    expect(validarPassos([passo({ diasDepois: 999 })])).toMatch(/intervalo/);
  });
  it("reaproveita as regras de texto e botão", () => {
    expect(validarPassos([passo({ assunto: "oi" })])).toMatch(/assunto/i);
    expect(validarPassos([passo({ botaoTexto: "Ver", botaoUrl: "javascript:x" })])).toMatch(/http/i);
  });
});

describe("rascunhos iniciais", () => {
  it("são válidos e começam na hora da confirmação", () => {
    expect(validarPassos(PASSOS_INICIAIS)).toBeNull();
    expect(PASSOS_INICIAIS[0].diasDepois).toBe(0);
  });
  it("não prometem aula gratuita, não citam preço e não usam marcas de texto automático", () => {
    const tudo = PASSOS_INICIAIS.map((p) => `${p.assunto} ${p.corpo}`).join(" ");
    expect(tudo).not.toMatch(/gratuit|grátis/i);
    expect(tudo).not.toMatch(/R\$/);
    expect(tudo).not.toMatch(/—|além disso|vale ressaltar|não só/i);
  });
  it("os e-mails de oferta pulam quem já assina; o de boas-vindas não", () => {
    expect(PASSOS_INICIAIS[0].pularSeAssina).toBe(false);
    expect(PASSOS_INICIAIS.slice(1).every((p) => p.pularSeAssina)).toBe(true);
  });
});

describe("descreverIntervalo", () => {
  it("fala em português claro", () => {
    expect(descreverIntervalo(1, 0)).toMatch(/confirma/);
    expect(descreverIntervalo(1, 1)).toBe("1 dia depois da confirmação");
    expect(descreverIntervalo(2, 3)).toBe("3 dias depois do e-mail anterior");
    expect(descreverIntervalo(2, 0)).toMatch(/mesmo dia/);
  });
});

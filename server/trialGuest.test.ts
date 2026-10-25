import { describe, expect, it } from "vitest";
import {
  compraSemContaLigada, criarLimitador, decidirRetorno, emailValido, GUEST_REF, hashDe, mascararEmail, normalizarEmail,
} from "./trialGuest";
import { assinarSessao, lerSessao, sessaoValidaPara } from "./_core/sessionCookie";
import { isTrialEvent } from "./trial";

const CHAVE = new TextEncoder().encode("k".repeat(48));
const HORA = 60 * 60 * 1000;

describe("compra sem conta: chave liga/desliga", () => {
  it("ligada sem variável; TRIAL_GUEST_CHECKOUT=off volta ao fluxo antigo", () => {
    expect(compraSemContaLigada({})).toBe(true);
    expect(compraSemContaLigada({ TRIAL_GUEST_CHECKOUT: "OFF" })).toBe(false);
    expect(compraSemContaLigada({ TRIAL_GUEST_CHECKOUT: "on" })).toBe(true);
  });
});

describe("e-mail", () => {
  it("normaliza (Fulana@ e fulana@ são a mesma conta) e valida formato", () => {
    expect(normalizarEmail("  Fulana@Gmail.COM ")).toBe("fulana@gmail.com");
    expect(emailValido("fulana@gmail.com")).toBe(true);
    expect(emailValido("fulana@gmail")).toBe(false);
    expect(emailValido("fulana gmail.com")).toBe(false);
  });
  it("mascara para a pessoa conferir sem expor o e-mail inteiro", () => {
    expect(mascararEmail("fulana@gmail.com")).toBe("fu••••@gmail.com");
    expect(mascararEmail("ab@x.com")).toBe("ab•••@x.com");
  });
});

describe("limite de tentativas (robôs)", () => {
  it("bloqueia depois do limite e libera quando a janela passa", () => {
    const pode = criarLimitador(3, HORA);
    const t0 = 1_000_000;
    expect([pode("ip:1", t0), pode("ip:1", t0 + 1), pode("ip:1", t0 + 2)]).toEqual([true, true, true]);
    expect(pode("ip:1", t0 + 3)).toBe(false);
    expect(pode("ip:2", t0 + 3)).toBe(true);
    expect(pode("ip:1", t0 + HORA + 10)).toBe(true);
  });
  it("CPF guardado só como hash", () => {
    expect(hashDe("12345678909")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDe("12345678909")).not.toContain("12345678909");
  });
});

describe("depois do pagamento: quem entra sozinho", () => {
  const agora = new Date("2026-10-25T12:00:00Z");
  const paga = { status: "paid", userId: 50, paidAt: new Date(agora.getTime() - HORA) };

  it("conta criada por esta compra: entra sozinho", () => {
    expect(decidirRetorno({ ...paga, userCreated: 1 }, agora)).toEqual({ situacao: "paga", entrarSozinho: true, precisaEntrar: false });
  });
  it("e-mail que JÁ tinha conta: nunca entra sozinho (ninguém acessa a conta do outro)", () => {
    expect(decidirRetorno({ ...paga, userCreated: 0 }, agora)).toEqual({ situacao: "paga", entrarSozinho: false, precisaEntrar: true });
  });
  it("token antigo (mais de 48 h depois do pagamento) não loga mais", () => {
    const velha = { ...paga, userCreated: 1, paidAt: new Date(agora.getTime() - 49 * HORA) };
    expect(decidirRetorno(velha, agora).entrarSozinho).toBe(false);
  });
  it("pendente ou cancelada: nada de login", () => {
    expect(decidirRetorno({ status: "pending", userId: null, userCreated: 0, paidAt: null }, agora).situacao).toBe("pendente");
    expect(decidirRetorno({ status: "cancelled", userId: null, userCreated: 0, paidAt: null }, agora).situacao).toBe("cancelada");
    // pago no Asaas mas a conta ainda não materializou: continua esperando
    expect(decidirRetorno({ status: "paid", userId: null, userCreated: 0, paidAt: agora }, agora).situacao).toBe("pendente");
  });
});

describe("sessão provisória", () => {
  const conta = { email: "fulana@gmail.com", emailVerified: 0, passwordHash: null, loginMethod: "email" };

  it("vale enquanto a conta é só da compra", async () => {
    const s = await lerSessao(await assinarSessao({ id: 50, email: conta.email }, { chave: CHAVE, provisoria: true }), { chave: CHAVE });
    expect(s?.provisoria).toBe(true);
    expect(sessaoValidaPara(s!, conta)).toBe(true);
  });
  it("cai quando alguém prova ser dono do e-mail: confirmou, criou senha ou entrou com Google", async () => {
    const s = (await lerSessao(await assinarSessao({ id: 50, email: conta.email }, { chave: CHAVE, provisoria: true }), { chave: CHAVE }))!;
    expect(sessaoValidaPara(s, { ...conta, emailVerified: 1 })).toBe(false);
    expect(sessaoValidaPara(s, { ...conta, passwordHash: "hash" })).toBe(false);
    expect(sessaoValidaPara(s, { ...conta, loginMethod: "google" })).toBe(false);
  });
  it("sessão normal não muda de comportamento", async () => {
    const s = (await lerSessao(await assinarSessao({ id: 50, email: conta.email }, { chave: CHAVE }), { chave: CHAVE }))!;
    expect(s.provisoria).toBe(false);
    expect(sessaoValidaPara(s, { ...conta, emailVerified: 1, passwordHash: "hash", loginMethod: "google" })).toBe(true);
    expect(sessaoValidaPara(s, { ...conta, email: "outra@gmail.com" })).toBe(false);
  });
});

describe("webhook do Asaas reconhece a compra sem conta", () => {
  it("trialguest:<compra>:<aula> é evento do teste; trial:<user>:<aula> continua", () => {
    expect(GUEST_REF.test("trialguest:12:20")).toBe(true);
    expect(isTrialEvent({ payment: { externalReference: "trialguest:12:20" } } as any)).toBe(true);
    expect(isTrialEvent({ payment: { externalReference: "trial:2:20" } } as any)).toBe(true);
    expect(isTrialEvent({ payment: { externalReference: "user:2|plan:basic" } } as any)).toBe(false);
  });
});

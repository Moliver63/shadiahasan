import { describe, it, expect } from "vitest";
import {
  contatoAtivo, criarLimitador, emailValido, exigeConfirmacaoPorEmail, normalizarEmail, novoToken, podeReenviarConfirmacao,
  tokenValido, urlConfirmar, urlSair, ESPERA_CONFIRMACAO_MS,
} from "./marketing";
import { cabecalhosDeCancelamento, corpoParaBlocos, montarEmailCampanha, montarEmailConfirmacao, preheaderDe, urlDoBotao } from "./marketingEmail";
import { origensDeTexto, origensParaTexto, validarConteudo } from "./marketingEnvio";

const base = "https://shadiahasan.com";
const TOKEN = "A".repeat(32);

describe("contatos", () => {
  it("normaliza e valida e-mail", () => {
    expect(normalizarEmail("  Maria@Exemplo.COM ")).toBe("maria@exemplo.com");
    expect(emailValido("maria@exemplo.com")).toBe(true);
    for (const ruim of ["", "maria", "maria@", "a b@c.com", "x@y"]) expect(emailValido(ruim)).toBe(false);
  });
  it("token tem 32 caracteres seguros e é diferente a cada vez", () => {
    const a = novoToken();
    expect(tokenValido(a)).toBe(true);
    expect(novoToken()).not.toBe(a);
    for (const ruim of ["", "curto", "x".repeat(33), "a".repeat(31) + "/", 123, null, undefined]) expect(tokenValido(ruim as any)).toBe(false);
  });
  it("só recebe quem confirmou e não cancelou", () => {
    const d = new Date();
    expect(contatoAtivo({ confirmadoEm: d, descadastradoEm: null })).toBe(true);
    expect(contatoAtivo({ confirmadoEm: null, descadastradoEm: null })).toBe(false);
    expect(contatoAtivo({ confirmadoEm: d, descadastradoEm: d })).toBe(false);
  });
  it("toda origem exige confirmação por e-mail", () => {
    for (const o of ["home", "cadastro", "compra-aula"] as const) expect(exigeConfirmacaoPorEmail(o)).toBe(true);
  });
  it("confirmação só pode ser reenviada depois da espera", () => {
    const agora = new Date("2026-10-31T12:00:00Z");
    expect(podeReenviarConfirmacao(null, agora)).toBe(true);
    expect(podeReenviarConfirmacao(new Date(agora.getTime() - 60_000), agora)).toBe(false);
    expect(podeReenviarConfirmacao(new Date(agora.getTime() - ESPERA_CONFIRMACAO_MS), agora)).toBe(true);
  });
  it("limitador bloqueia depois do máximo e libera depois da janela", () => {
    const ok = criarLimitador(2, 1000);
    expect(ok("ip", 0)).toBe(true);
    expect(ok("ip", 10)).toBe(true);
    expect(ok("ip", 20)).toBe(false);
    expect(ok("outro", 20)).toBe(true);
    expect(ok("ip", 1500)).toBe(true);
  });
  it("links usam o token codificado", () => {
    expect(urlSair(base, TOKEN)).toBe(`${base}/api/marketing/sair?t=${TOKEN}`);
    expect(urlConfirmar(base, "a b")).toContain("t=a%20b");
  });
});

describe("conteúdo da campanha", () => {
  const ok = { nome: "Oferta de novembro", assunto: "Uma aula para começar", corpo: "Texto com mais de trinta caracteres para passar na validação.", botaoTexto: "", botaoUrl: "" };
  it("aceita conteúdo válido", () => expect(validarConteudo(ok)).toBeNull());
  it("recusa nome, assunto e texto curtos", () => {
    expect(validarConteudo({ ...ok, nome: "ab" })).toMatch(/nome/i);
    expect(validarConteudo({ ...ok, assunto: "oi" })).toMatch(/assunto/i);
    expect(validarConteudo({ ...ok, corpo: "curto" })).toMatch(/curto/i);
  });
  it("botão exige texto e endereço juntos, com http(s)", () => {
    expect(validarConteudo({ ...ok, botaoTexto: "Ver", botaoUrl: "" })).toMatch(/botão/i);
    expect(validarConteudo({ ...ok, botaoTexto: "", botaoUrl: "https://x.com" })).toMatch(/botão/i);
    expect(validarConteudo({ ...ok, botaoTexto: "Ver", botaoUrl: "javascript:alert(1)" })).toMatch(/http/i);
    expect(validarConteudo({ ...ok, botaoTexto: "Ver", botaoUrl: "https://shadiahasan.com/pricing" })).toBeNull();
  });
  it("origens: ignora valores desconhecidos e repetidos", () => {
    expect(origensDeTexto("home, x ,compra-aula")).toEqual(["home", "compra-aula"]);
    expect(origensParaTexto(["home", "home", "cadastro"])).toBe("home,cadastro");
    expect(origensDeTexto("")).toEqual([]);
    expect(origensDeTexto(null)).toEqual([]);
  });
});

describe("e-mails", () => {
  it("campanha leva link de cancelar, saudação pelo primeiro nome e o texto escapado", () => {
    const m = montarEmailCampanha({ assunto: "Aula nova", corpo: "Primeira linha <b>x</b>\nsegunda linha\n\nOutro parágrafo & fim.", botaoTexto: "Ver aula", botaoUrl: "https://shadiahasan.com/courses" }, { nome: "Maria Souza", token: TOKEN }, base);
    expect(m.html).toContain(`${base}/api/marketing/sair?t=${TOKEN}`);
    expect(m.html).toContain("Olá, Maria.");
    expect(m.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(m.html).toContain("segunda linha");
    expect(m.html).toContain("Outro parágrafo &amp; fim.");
    expect(m.html).toContain('href="https://shadiahasan.com/courses"');
    expect(m.texto).toContain("cancele sua inscrição");
    expect(m.texto).toContain(`${base}/api/marketing/sair?t=${TOKEN}`);
  });
  it("sem nome a saudação é só 'Olá.' e botão inválido não aparece", () => {
    const m = montarEmailCampanha({ assunto: "Aula nova", corpo: "Texto qualquer para o e-mail de teste.", botaoTexto: "Clique", botaoUrl: "javascript:alert(1)" }, { nome: null, token: TOKEN }, base);
    expect(m.html).toContain("Olá.");
    expect(m.html).not.toContain("javascript:");
    expect(m.html).not.toContain("Clique");
  });
  it("urlDoBotao só aceita http e https", () => {
    expect(urlDoBotao("https://a.com/x?y=1")).toBe("https://a.com/x?y=1");
    expect(urlDoBotao("http://a.com")).toBe("http://a.com");
    for (const ruim of ["javascript:x", "ftp://a.com", "a.com", "", null, "https://a b.com"]) expect(urlDoBotao(ruim as any)).toBeNull();
  });
  it("parágrafos e preheader", () => {
    expect((corpoParaBlocos("a\n\n\nb\nc").match(/<p /g) ?? []).length).toBe(2);
    expect(preheaderDe("x ".repeat(100)).length).toBeLessThanOrEqual(100);
  });
  it("confirmação traz o endereço, o botão e o aviso de que pode ignorar", () => {
    const m = montarEmailConfirmacao({ email: "maria@exemplo.com", nome: "Maria", token: TOKEN, base });
    expect(m.html).toContain("maria@exemplo.com");
    expect(m.html).toContain(`${base}/api/marketing/confirmar?t=${TOKEN}`);
    expect(m.texto).toContain("ignore este e-mail");
  });
  it("cabeçalhos de cancelamento com um clique", () => {
    const h = cabecalhosDeCancelamento(TOKEN, base);
    expect(h["List-Unsubscribe"]).toBe(`<${base}/api/marketing/sair?t=${TOKEN}>`);
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

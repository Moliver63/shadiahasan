/**
 * E-mails do marketing: confirmação de inscrição e campanha.
 * Só monta HTML e texto (funções puras). O envio fica em marketingEnvio.ts.
 */
import { botao, escapar, layoutEmail, linkReserva, p, pequeno, saudacao, siteUrl } from "./_core/emailLayout";
import { htmlParaTexto } from "./_core/emailLayout";
import { urlConfirmar, urlSair } from "./marketing";

export type EmailMontado = { assunto: string; html: string; texto: string; preheader: string };

/** "Olá" + texto do admin. Parágrafos separados por linha em branco; quebra simples vira <br>. */
export function corpoParaBlocos(texto: string): string {
  return (texto ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((par) => par.trim())
    .filter(Boolean)
    .map((par) => p(escapar(par).replace(/\n/g, "<br>")))
    .join("");
}

/** Só aceita http(s). Evita "javascript:" colado por engano no campo do botão. */
export function urlDoBotao(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!/^https?:\/\/[^\s]+$/i.test(u)) return null;
  return u;
}

export function preheaderDe(texto: string): string {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  return limpo.length > 100 ? `${limpo.slice(0, 99).trimEnd()}…` : limpo;
}

export function montarEmailConfirmacao(p0: { email: string; nome?: string | null; token: string; base?: string; resultado?: { titulo: string; resumo: string } }): EmailMontado {
  const base = p0.base ?? siteUrl();
  const link = urlConfirmar(base, p0.token);
  const corpo =
    p(saudacao(p0.nome)) +
    (p0.resultado
      ? p(`Seu resultado na autoavaliação de comunicação: <strong>${escapar(p0.resultado.titulo)}</strong>. ${escapar(p0.resultado.resumo)}`) +
        p(`Para receber os próximos conteúdos da Shadia em <strong>${escapar(p0.email)}</strong>, confirme abaixo.`)
      : p(`Alguém pediu para receber as novidades da Shadia Hasan em <strong>${escapar(p0.email)}</strong>. Se foi você, confirme abaixo.`)) +
    botao("Confirmar minha inscrição", link) +
    linkReserva(link) +
    pequeno("Se não foi você, ignore este e-mail. Sem a confirmação, nada será enviado.");
  const assunto = p0.resultado ? "Seu resultado e a confirmação da sua inscrição" : "Confirme sua inscrição para receber as novidades da Shadia";
  const preheader = p0.resultado ? "Seu resultado está aqui. Falta só um clique para confirmar." : "Falta só um clique para confirmar.";
  const html = layoutEmail({ preheader, titulo: "Confirme sua inscrição", corpo, departamento: "psicologa", motivo: "Você recebeu este e-mail porque este endereço foi informado em shadiahasan.com." });
  return { assunto, html, texto: htmlParaTexto(html), preheader };
}

export type CampanhaConteudo = { assunto: string; corpo: string; botaoTexto?: string | null; botaoUrl?: string | null };

export function montarEmailCampanha(c: CampanhaConteudo, contato: { nome?: string | null; token: string }, base?: string): EmailMontado {
  const site = base ?? siteUrl();
  const sair = urlSair(site, contato.token);
  const url = urlDoBotao(c.botaoUrl);
  const texto = (c.botaoTexto ?? "").trim();
  const preheader = preheaderDe(c.corpo);
  const corpo =
    p(saudacao(contato.nome)) +
    corpoParaBlocos(c.corpo) +
    (url && texto ? botao(texto, url) : "") +
    pequeno(`Para deixar de receber estes e-mails, <a href="${escapar(sair)}" style="color:#23686C;">cancele sua inscrição</a>.`);
  const html = layoutEmail({
    preheader,
    titulo: c.assunto,
    corpo,
    departamento: "psicologa",
    motivo: "Você recebe este e-mail porque autorizou receber novidades e ofertas da Shadia Hasan.",
  });
  return { assunto: c.assunto, html, texto: htmlParaTexto(html), preheader };
}

/** Cabeçalhos que fazem Gmail e Apple Mail mostrarem "Cancelar inscrição" (um clique). */
export function cabecalhosDeCancelamento(token: string, base?: string): Record<string, string> {
  const site = base ?? siteUrl();
  return {
    "List-Unsubscribe": `<${urlSair(site, token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

import { Resend } from "resend";
import {
  atencao,
  botao,
  destaque,
  emailContato,
  escapar,
  formatarData,
  formatarReais,
  htmlParaTexto,
  layoutEmail,
  linkReserva,
  MARCA,
  p,
  pequeno,
  blocoContatos,
  resumo,
  saudacao,
  siteUrl,
  textoParaHtml,
} from "./emailLayout";

/**
 * Cliente criado na primeira necessidade, não no import.
 *
 * `new Resend(undefined)` LANÇA ("Missing API key"), e isso rodava ao importar
 * o módulo. Qualquer arquivo que chegasse aqui por importação indireta
 * quebrava quando `RESEND_API_KEY` não estava no ambiente: era o motivo de
 * `pnpm test` falhar na coleta dos 5 arquivos de teste, sem rodar um teste.
 * Em produção, significa que o processo morre no import se a chave sair do
 * ambiente, em vez de falhar só o envio de e-mail.
 */
let clienteResend: Resend | null = null;
export function getResend(): Resend | null {
  if (clienteResend) return clienteResend;
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return null;
  clienteResend = new Resend(chave);
  return clienteResend;
}

const FROM_EMAIL = () => process.env.FROM_EMAIL || "Shadia Hasan <noreply@shadiahasan.com>";

/** Remetente da caixa de contato (respostas escritas à mão no admin). */
export function remetenteContato(): string {
  return process.env.EMAIL_CONTATO_REMETENTE || `Shadia Hasan <${emailContato()}>`;
}

export type ResultadoEnvio = { success: boolean; id?: string; error?: string };

/**
 * Envio genérico. Nunca lança: e-mail é "melhor esforço" e não pode derrubar
 * pagamento, cadastro ou webhook. Quem precisa saber se saiu olha `success`.
 *
 * Toda mensagem leva `replyTo` para a caixa de contato: se o aluno responder,
 * a resposta cai no painel (/admin/emails) em vez de se perder no noreply@.
 */
export async function enviarEmail(params: {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  de?: string;
  responderPara?: string;
}): Promise<ResultadoEnvio> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[Email] RESEND_API_KEY ausente: "${params.assunto}" para ${params.para} não foi enviado`);
    return { success: false, error: "RESEND_API_KEY não configurada" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: params.de ?? FROM_EMAIL(),
      to: [params.para],
      subject: params.assunto,
      html: params.html,
      text: params.texto ?? htmlParaTexto(params.html),
      replyTo: params.responderPara ?? emailContato(),
    });
    if (error) {
      console.error("[Email] Resend recusou o envio:", error);
      return { success: false, error: error.message };
    }
    console.log(`[Email] enviado para ${params.para}: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error("[Email] falha ao enviar:", error);
    return { success: false, error: String(error) };
  }
}

// ─── Conta ───────────────────────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const url = `${siteUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const html = layoutEmail({
    preheader: "Falta só confirmar seu e-mail para entrar na plataforma.",
    titulo: "Confirme seu e-mail",
    corpo:
      p(saudacao(name)) +
      p("Que bom ter você aqui. Para ativar sua conta, confirme que este e-mail é seu:") +
      botao("Confirmar meu e-mail", url) +
      linkReserva(url) +
      pequeno("O link vale por 24 horas. Se não foi você que criou a conta, ignore esta mensagem."),
    motivo: "Você recebeu este e-mail porque alguém criou uma conta em shadiahasan.com com este endereço.",
  });
  return enviarEmail({ para: email, assunto: "Confirme seu e-mail", html });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = `${siteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const html = layoutEmail({
    preheader: "Use o link para criar uma nova senha. Ele vale por 1 hora.",
    titulo: "Nova senha",
    corpo:
      p(saudacao(name)) +
      p("Recebemos um pedido para trocar a senha da sua conta. Se foi você, crie a nova senha por aqui:") +
      botao("Criar nova senha", url) +
      linkReserva(url) +
      atencao("Não pediu a troca? Pode ignorar este e-mail. Sua senha atual continua valendo."),
    motivo: "Você recebeu este e-mail porque foi pedida uma nova senha para esta conta.",
  });
  return enviarEmail({ para: email, assunto: "Crie sua nova senha", html });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const site = siteUrl();
  const html = layoutEmail({
    preheader: "Sua conta está ativa. Veja por onde começar.",
    titulo: "Sua conta está ativa",
    corpo:
      p(saudacao(name)) +
      p("E-mail confirmado. A partir de agora você entra na plataforma com este endereço, de qualquer aparelho.") +
      p("Um bom começo é escolher um tema e assistir à primeira aula com calma, sem pressa de terminar. Cada aula foi pensada para ser vivida, não só assistida.") +
      botao("Ver os cursos", `${site}/courses`) +
      destaque(
        `Em <a href="${escapar(site)}/minha-area" style="color:${MARCA.verde};">Minha Área</a> você acompanha o progresso e, em <a href="${escapar(site)}/certificates" style="color:${MARCA.verde};">Certificados</a>, encontra os dos cursos concluídos.`,
      ),
    motivo: "Você recebeu este e-mail porque criou uma conta em shadiahasan.com.",
  });
  return enviarEmail({ para: email, assunto: "Sua conta está ativa", html });
}

// ─── Pagamento ───────────────────────────────────────────────────────────────

/**
 * Lembrete de cobrança em aberto (PIX, boleto ou cartão ainda não pago).
 * O link é o da fatura do Asaas; o texto evita pressão e falsa urgência.
 */
export async function sendPaymentReminderEmail(
  email: string,
  name: string,
  params: { invoiceUrl: string; what: string; note?: string },
) {
  const html = layoutEmail({
    preheader: "Seu pagamento ficou pela metade. Dá para retomar de onde parou.",
    titulo: "Seu pagamento ficou pela metade",
    corpo:
      p(saudacao(name)) +
      p(`Você começou a contratar <strong>${escapar(params.what)}</strong>, mas o pagamento não foi concluído. Se foi só uma interrupção, é possível retomar de onde parou:`) +
      botao("Concluir pagamento", params.invoiceUrl) +
      (params.note ? p(escapar(params.note)) : "") +
      pequeno("Se você já pagou, pode ignorar esta mensagem. A liberação acontece sozinha assim que o pagamento é confirmado."),
  });
  return enviarEmail({ para: email, assunto: "Seu pagamento não foi concluído", html });
}

/**
 * Teste de 1 aula comprado sem conta ("pagar primeiro"): a aula já está
 * liberada. O e-mail entrega o link da aula e, para conta nova, o link de
 * criar senha. Criar a senha por este link prova que o e-mail é da pessoa
 * (confirma o e-mail) e permite entrar de qualquer aparelho.
 */
export async function sendTrialAccessEmail(params: {
  email: string;
  name: string;
  siteUrl: string;
  lessonUrl: string;
  /** null para quem já tinha conta: só avisa que liberou e manda entrar */
  createPasswordUrl: string | null;
}) {
  const blocoSenha = params.createPasswordUrl
    ? p("Sua conta foi criada com este e-mail. Para entrar de outro celular ou do computador, crie sua senha:") +
      botao("Criar minha senha", params.createPasswordUrl) +
      pequeno("O link vale por 7 dias. Criar a senha também confirma que este e-mail é seu.")
    : p("A aula foi liberada na conta que você já tem com este e-mail. O botão acima já entra na sua conta, sem senha. Depois, entre como sempre (senha ou Google).");

  const html = layoutEmail({
    preheader: "Pagamento confirmado. Sua aula já pode ser assistida.",
    titulo: "Sua aula está liberada",
    corpo:
      p(saudacao(params.name)) +
      p("Recebi seu pagamento, obrigada. A aula já está liberada para você:") +
      botao("Assistir à aula", params.lessonUrl) +
      pequeno("Este botão entra direto na sua conta e funciona uma vez, por 7 dias. Não encaminhe este e-mail.") +
      blocoSenha,
    motivo: "Você recebeu este e-mail porque comprou a aula experimental em shadiahasan.com.",
  });
  return enviarEmail({ para: params.email, assunto: "Sua aula está liberada", html });
}

/** Link de uso único para entrar sem senha (vale 24 h). */
export async function sendLinkDeAcessoEmail(email: string, name: string, url: string) {
  const html = layoutEmail({
    preheader: "Seu link para entrar na plataforma. Vale por 24 horas.",
    titulo: "Seu link de acesso",
    corpo:
      p(saudacao(name)) +
      p("Toque no botão para entrar na sua conta. Não precisa de senha nem de Google.") +
      botao("Entrar e assistir", url) +
      linkReserva(url) +
      pequeno("O link vale por 24 horas e funciona uma vez. Se não foi você que pediu, ignore este e-mail: ninguém entra sem ele."),
    motivo: "Você recebeu este e-mail porque pediu um link de acesso em shadiahasan.com.",
  });
  return enviarEmail({ para: email, assunto: "Seu link de acesso", html });
}

// ─── Assinatura ──────────────────────────────────────────────────────────────

const MOTIVO_ASSINATURA = "Você recebeu este e-mail porque tem uma assinatura em shadiahasan.com.";

/** Primeira confirmação de pagamento de uma assinatura. */
export async function sendAssinaturaAtivadaEmail(
  email: string,
  name: string,
  params: { plano: string; valorCentavos?: number | null; forma?: string | null },
) {
  const site = siteUrl();
  const linhas: Array<[string, string]> = [["Plano", params.plano]];
  if (params.valorCentavos) linhas.push(["Valor mensal", formatarReais(params.valorCentavos)]);
  if (params.forma) linhas.push(["Pagamento", params.forma]);

  const html = layoutEmail({
    preheader: `Seu plano ${params.plano} está ativo. Todas as aulas do plano já estão liberadas.`,
    titulo: "Sua assinatura está ativa",
    corpo:
      p(saudacao(name)) +
      p("Recebi a confirmação do seu pagamento. Que bom ter você comigo. As aulas do seu plano já estão liberadas.") +
      resumo(linhas) +
      botao("Começar agora", `${site}/courses`) +
      p("Vá no seu ritmo. Uma aula bem vivida vale mais que três assistidas às pressas.") +
      pequeno(`A renovação é mensal e automática. Você pode cancelar quando quiser em <a href="${escapar(site)}/my-subscription" style="color:${MARCA.verde};">Minha assinatura</a>.`),
    motivo: MOTIVO_ASSINATURA,
  });
  return enviarEmail({ para: email, assunto: `Sua assinatura ${params.plano} está ativa`, html });
}

/** Renovação paga (e reativação depois de uma pausa por atraso). */
export async function sendPagamentoRecebidoEmail(
  email: string,
  name: string,
  params: { plano: string; valorCentavos?: number | null; pagoEm?: Date | null; reativado?: boolean; reciboUrl?: string | null },
) {
  const linhas: Array<[string, string]> = [["Plano", params.plano]];
  if (params.valorCentavos) linhas.push(["Valor", formatarReais(params.valorCentavos)]);
  linhas.push(["Data", formatarData(params.pagoEm ?? new Date())]);

  const html = layoutEmail({
    preheader: params.reativado ? "Pagamento confirmado. Seu acesso voltou." : "Pagamento da sua assinatura confirmado.",
    titulo: params.reativado ? "Seu acesso voltou" : "Pagamento confirmado",
    corpo:
      p(saudacao(name)) +
      p(
        params.reativado
          ? "Recebi seu pagamento e o acesso às aulas foi liberado de novo. Você continua exatamente de onde parou."
          : "Recebi o pagamento da sua assinatura deste mês. Seu acesso segue normal, não precisa fazer nada.",
      ) +
      resumo(linhas) +
      (params.reciboUrl ? pequeno(`Comprovante: <a href="${escapar(params.reciboUrl)}" style="color:${MARCA.verde};">ver recibo</a>`) : "") +
      botao("Ir para as aulas", `${siteUrl()}/minha-area`),
    motivo: MOTIVO_ASSINATURA,
  });
  return enviarEmail({
    para: email,
    assunto: params.reativado ? "Seu acesso foi liberado de novo" : "Pagamento da assinatura confirmado",
    html,
  });
}

/** Cobrança venceu sem pagamento. O acesso continua durante a carência. */
export async function sendPagamentoAtrasadoEmail(
  email: string,
  name: string,
  params: { plano: string; faturaUrl?: string | null; diasCarencia: number; falhaCartao?: boolean },
) {
  const carencia =
    params.diasCarencia > 0
      ? `Seu acesso continua liberado por mais ${params.diasCarencia} ${params.diasCarencia === 1 ? "dia" : "dias"}. Depois disso, ele fica pausado até o pagamento, sem perder nada do que você já fez.`
      : "Seu acesso fica pausado até o pagamento, sem perder nada do que você já fez.";

  const html = layoutEmail({
    preheader: "A mensalidade venceu e ainda não foi paga. Veja como resolver.",
    titulo: "A mensalidade ainda não foi paga",
    corpo:
      p(saudacao(name)) +
      p(
        params.falhaCartao
          ? `A cobrança da sua assinatura <strong>${escapar(params.plano)}</strong> não passou no cartão. Às vezes é só limite ou um bloqueio do banco.`
          : `A mensalidade da sua assinatura <strong>${escapar(params.plano)}</strong> venceu e o pagamento ainda não apareceu por aqui.`,
      ) +
      atencao(carencia) +
      (params.faturaUrl ? botao("Pagar agora", params.faturaUrl) : "") +
      pequeno("Se você já pagou, desconsidere. Pagamentos por boleto podem levar até 3 dias úteis para serem confirmados."),
    motivo: MOTIVO_ASSINATURA,
  });
  return enviarEmail({ para: email, assunto: "Sua mensalidade está em aberto", html });
}

/** Passou a carência: acesso pausado até pagar. */
export async function sendAcessoPausadoEmail(
  email: string,
  name: string,
  params: { plano: string; faturaUrl?: string | null },
) {
  const html = layoutEmail({
    preheader: "Seu acesso às aulas foi pausado. Seu progresso está guardado.",
    titulo: "Seu acesso foi pausado",
    corpo:
      p(saudacao(name)) +
      p(`Como a mensalidade da assinatura <strong>${escapar(params.plano)}</strong> continua em aberto, o acesso às aulas foi pausado.`) +
      destaque("Nada foi perdido. Seu progresso, certificados e histórico continuam guardados. Assim que o pagamento for confirmado, tudo volta sozinho.") +
      (params.faturaUrl ? botao("Pagar e voltar às aulas", params.faturaUrl) : p("Para regularizar, é só responder este e-mail que eu envio o link de pagamento.")),
    motivo: MOTIVO_ASSINATURA,
  });
  return enviarEmail({ para: email, assunto: "Seu acesso às aulas foi pausado", html });
}

/** O próprio aluno cancelou. */
export async function sendCancelamentoConfirmadoEmail(
  email: string,
  name: string,
  params: { plano: string; acessoAte: Date | null },
) {
  const site = siteUrl();
  const html = layoutEmail({
    preheader: params.acessoAte
      ? `Cancelamento feito. Seu acesso continua até ${formatarData(params.acessoAte)}.`
      : "Cancelamento feito. Nenhuma nova cobrança será feita.",
    titulo: "Cancelamento confirmado",
    corpo:
      p(saudacao(name)) +
      p(`Sua assinatura <strong>${escapar(params.plano)}</strong> foi cancelada. Nenhuma nova cobrança será feita.`) +
      (params.acessoAte
        ? destaque(`Você continua com acesso a todas as aulas do plano até <strong>${escapar(formatarData(params.acessoAte))}</strong>, o período que já foi pago.`)
        : "") +
      p("Obrigada por ter feito parte. Se quiser me contar o que pesou na decisão, é só responder este e-mail. Eu leio todas as respostas.") +
      pequeno(`Mudou de ideia? Dá para assinar de novo quando quiser em <a href="${escapar(site)}/pricing" style="color:${MARCA.verde};">${escapar(site.replace(/^https?:\/\//, ""))}/pricing</a>.`),
    motivo: MOTIVO_ASSINATURA,
  });
  return enviarEmail({ para: email, assunto: "Sua assinatura foi cancelada", html });
}

/** Acesso encerrado: fim do período pago depois de cancelar, ou estorno. */
export async function sendAssinaturaEncerradaEmail(
  email: string,
  name: string,
  params: { plano: string; motivo: "fim_periodo" | "estorno"; valorCentavos?: number | null },
) {
  const site = siteUrl();
  const estorno = params.motivo === "estorno";
  const html = layoutEmail({
    preheader: estorno ? "O estorno foi feito e a assinatura foi encerrada." : "O período da sua assinatura terminou.",
    titulo: estorno ? "Estorno realizado" : "Sua assinatura terminou",
    corpo:
      p(saudacao(name)) +
      (estorno
        ? p(
            `O pagamento da assinatura <strong>${escapar(params.plano)}</strong>${params.valorCentavos ? ` (${escapar(formatarReais(params.valorCentavos))})` : ""} foi estornado e a assinatura foi encerrada. O prazo para o valor aparecer depende do banco ou da operadora do cartão.`,
          )
        : p(`O período pago da sua assinatura <strong>${escapar(params.plano)}</strong> terminou hoje, e o acesso às aulas do plano foi encerrado.`)) +
      p("Sua conta continua ativa, com o histórico e os certificados guardados. Se um dia quiser voltar, você retoma do ponto onde parou.") +
      botao("Ver planos", `${site}/pricing`),
    motivo: MOTIVO_ASSINATURA,
  });
  return enviarEmail({
    para: email,
    assunto: estorno ? "Estorno da assinatura realizado" : "Sua assinatura terminou",
    html,
  });
}

// ─── Caixa de contato (respostas escritas no admin) ─────────────────────────

/**
 * Resposta manual do admin a uma mensagem recebida em contato@. O texto vem
 * cru de um textarea, então é escapado; fecha com a assinatura da marca e
 * cita a mensagem original, como qualquer cliente de e-mail.
 */
export function emailRespostaContato(params: {
  corpo: string;
  citacao?: { remetente: string; data: string; corpo: string };
  /** Setor que responde (ex.: "Financeiro") e o endereço da caixa. */
  setor?: string | null;
  endereco?: string | null;
}): string {
  const site = siteUrl();
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:600px;padding:16px;font-family:${sans};font-size:15px;line-height:1.65;color:${MARCA.texto};">
  <div>${textoParaHtml(params.corpo)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:1px solid ${MARCA.linha};">
    <tr><td style="padding-top:16px;">
      <a href="${escapar(site)}" target="_blank" style="text-decoration:none;"><img src="${escapar(site)}/email/assinatura-email.png" width="200" height="44" alt="Shadia Hasan · Psicologia &amp; Desenvolvimento Humano" style="display:block;width:200px;height:auto;border:0;font-family:Georgia,serif;font-size:16px;color:${MARCA.azul};"></a>
    </td></tr>
    <tr><td style="padding-top:10px;">${blocoContatos({ setor: params.setor, email: params.endereco, semNome: true })}</td></tr>
  </table>
  ${
    params.citacao
      ? `<div style="margin-top:28px;padding-left:12px;border-left:2px solid ${MARCA.linha};color:${MARCA.suave};font-size:13px;">
    <p style="margin:0 0 6px;">Em ${escapar(params.citacao.data)}, ${escapar(params.citacao.remetente)} escreveu:</p>
    <div>${textoParaHtml(params.citacao.corpo)}</div>
  </div>`
      : ""
  }
</div>
</body></html>`;
}

/** Aviso interno (para o e-mail pessoal da equipe), sem layout de marketing. */
export async function enviarAvisoInterno(assunto: string, linhas: string[], link?: { texto: string; url: string }) {
  const destino = (process.env.EMAIL_AVISOS_ADMIN || "").trim();
  if (!destino) return { success: false, error: "EMAIL_AVISOS_ADMIN não configurado" } as ResultadoEnvio;
  // Mandar aviso para a própria caixa de contato criaria um laço: cada aviso
  // viraria uma "mensagem nova", que geraria outro aviso.
  if (destino.toLowerCase() === emailContato().toLowerCase()) {
    console.warn("[Email] EMAIL_AVISOS_ADMIN igual ao e-mail de contato; aviso ignorado para evitar laço");
    return { success: false, error: "destino igual à caixa de contato" } as ResultadoEnvio;
  }
  const html = layoutEmail({
    preheader: linhas[0] || assunto,
    titulo: assunto,
    corpo: linhas.map((l) => p(escapar(l))).join("") + (link ? botao(link.texto, link.url) : ""),
    motivo: "Aviso automático do painel da plataforma.",
  });
  return enviarEmail({ para: destino, assunto: `[Painel] ${assunto}`, html });
}

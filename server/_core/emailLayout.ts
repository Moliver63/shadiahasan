/**
 * Layout único dos e-mails da Shadia Hasan.
 *
 * Mesma identidade do logo: azul profundo, verde-petróleo, papel claro e
 * título em serifa. Feito com tabelas e estilo inline porque Gmail, Outlook e
 * o app de e-mail do celular ignoram <style> e CSS moderno com frequência.
 *
 * Nada aqui envia e-mail: só monta HTML e texto puro. O envio fica em email.ts.
 */

export const MARCA = {
  azul: "#0B3354",
  verde: "#23686C",
  verdeClaro: "#E6EFEE",
  papel: "#F5F2EC",
  branco: "#FFFFFF",
  texto: "#24303A",
  suave: "#5B6770",
  linha: "#E3DDD3",
  alerta: "#8A5A12",
  alertaFundo: "#FBF3E4",
} as const;

const SERIFA = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Endereço público do site, sem barra no fim. */
export function siteUrl(): string {
  return (process.env.SITE_URL || "https://shadiahasan.com").replace(/\/+$/, "");
}

/** Endereço que recebe as respostas (caixa de e-mail do admin). */
export function emailContato(): string {
  return process.env.EMAIL_CONTATO || "contato@shadiahasan.com";
}

export const WHATSAPP_URL = "https://wa.me/5547991665536";

/**
 * Contatos que fecham todo e-mail. Boas práticas: quem envia (nome + registro
 * profissional), canais escritos por extenso (o número aparece mesmo se o link
 * não abrir ou o e-mail for impresso), site e política de privacidade (LGPD).
 */
export const CONTATOS = {
  nome: "Shadia Hasan",
  profissao: "Psicóloga · CRP 12/27052",
  whatsappTexto: "(47) 99166-5536",
  instagram: "@shadia_hasan",
  instagramUrl: "https://www.instagram.com/shadia_hasan",
} as const;

/** Logo com largura e altura fixas (evita "pulo" do layout) e texto alternativo visível se a imagem for bloqueada. */
export function logoEmail(largura = 150): string {
  const site = siteUrl();
  const altura = Math.round((largura * 361) / 440); // proporção do PNG (440x361)
  return `<a href="${escapar(site)}" target="_blank" style="text-decoration:none;"><img src="${escapar(site)}/email/logo-email.png" width="${largura}" height="${altura}" alt="Shadia Hasan · Psicologia &amp; Desenvolvimento Humano" style="display:block;width:${largura}px;height:auto;max-width:100%;border:0;outline:none;font-family:${SERIFA};font-size:18px;line-height:1.3;color:${MARCA.azul};"></a>`;
}

/**
 * Bloco de contatos (assinatura): nome, registro, WhatsApp, e-mail, site e Instagram.
 * `setor` troca a linha do registro pelo setor que responde (ex.: "Financeiro").
 */
export function blocoContatos(params: { setor?: string | null; email?: string | null; semNome?: boolean } = {}): string {
  const site = siteUrl();
  const email = params.email || emailContato();
  const dominio = site.replace(/^https?:\/\//, "");
  const link = (href: string, texto: string) =>
    `<a href="${escapar(href)}" target="_blank" style="color:${MARCA.verde};text-decoration:none;">${escapar(texto)}</a>`;
  const cel = `font-family:${SANS};font-size:13px;line-height:1.7;color:${MARCA.suave};`;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    ${params.semNome ? "" : `<tr><td style="font-family:${SERIFA};font-size:16px;line-height:1.4;color:${MARCA.azul};">${escapar(CONTATOS.nome)}</td></tr>`}
    <tr><td style="${cel}">${params.setor ? `<strong style="color:${MARCA.azul};font-weight:600;">${escapar(params.setor)}</strong> · ` : ""}${escapar(CONTATOS.profissao)}</td></tr>
    <tr><td style="${cel}">WhatsApp ${link(WHATSAPP_URL, CONTATOS.whatsappTexto)} · ${link(`mailto:${email}`, email)}</td></tr>
    <tr><td style="${cel}">${link(site, dominio)} · Instagram ${link(CONTATOS.instagramUrl, CONTATOS.instagram)}</td></tr>
  </table>`;
}

export function escapar(texto: string): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Texto cru (de um textarea) vira HTML: escapa e mantém as quebras de linha. */
export function textoParaHtml(texto: string): string {
  return escapar(texto).replace(/\r?\n/g, "<br>");
}

export function primeiroNome(nome?: string | null): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}

export function saudacao(nome?: string | null): string {
  const n = primeiroNome(nome);
  return n ? `Olá, ${escapar(n)}.` : "Olá.";
}

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
}

// ─── Blocos ──────────────────────────────────────────────────────────────────

export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${MARCA.texto};">${html}</p>`;
}

export function pequeno(html: string): string {
  return `<p style="margin:0 0 12px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MARCA.suave};">${html}</p>`;
}

/** Caixa de destaque suave (verde). */
export function destaque(html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
    <tr><td style="background:${MARCA.verdeClaro};border-left:3px solid ${MARCA.verde};border-radius:4px;padding:16px 18px;font-family:${SANS};font-size:15px;line-height:1.6;color:${MARCA.texto};">${html}</td></tr>
  </table>`;
}

/** Caixa de atenção (âmbar), para atraso e pausa. */
export function atencao(html: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
    <tr><td style="background:${MARCA.alertaFundo};border-left:3px solid ${MARCA.alerta};border-radius:4px;padding:16px 18px;font-family:${SANS};font-size:15px;line-height:1.6;color:${MARCA.texto};">${html}</td></tr>
  </table>`;
}

/** Linhas "rótulo: valor" (resumo de pagamento, plano etc.). */
export function resumo(linhas: Array<[string, string]>): string {
  const tr = linhas
    .map(
      ([rotulo, valor]) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${MARCA.linha};font-family:${SANS};font-size:14px;color:${MARCA.suave};">${escapar(rotulo)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid ${MARCA.linha};font-family:${SANS};font-size:14px;color:${MARCA.texto};font-weight:600;">${escapar(valor)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">${tr}</table>`;
}

/** Botão que funciona até no Outlook (célula com fundo, link em bloco). */
export function botao(texto: string, url: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr><td align="center" bgcolor="${MARCA.azul}" style="border-radius:6px;">
      <a href="${escapar(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapar(texto)}</a>
    </td></tr>
  </table>`;
}

/** Link por extenso, para quando o botão não abre. */
export function linkReserva(url: string): string {
  return pequeno(
    `Se o botão não abrir, copie este endereço no navegador:<br><a href="${escapar(url)}" style="color:${MARCA.verde};word-break:break-all;">${escapar(url)}</a>`,
  );
}

// ─── Envelope ────────────────────────────────────────────────────────────────

export function layoutEmail(params: {
  /** Frase curta que aparece ao lado do assunto na caixa de entrada. */
  preheader: string;
  titulo: string;
  corpo: string;
  /** Por que a pessoa recebeu este e-mail (rodapé). */
  motivo?: string;
}): string {
  const site = siteUrl();
  const dominio = site.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapar(params.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${MARCA.papel};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapar(params.preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${MARCA.papel};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td align="center" style="padding:0 0 24px;">
        ${logoEmail(150)}
      </td></tr>
      <tr><td style="background:${MARCA.branco};border:1px solid ${MARCA.linha};border-radius:10px;padding:36px 32px 28px;">
        <h1 style="margin:0 0 20px;font-family:${SERIFA};font-weight:normal;font-size:26px;line-height:1.3;color:${MARCA.azul};">${escapar(params.titulo)}</h1>
        ${params.corpo}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;border-top:1px solid ${MARCA.linha};">
          <tr><td style="padding-top:18px;">${blocoContatos()}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:22px 12px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MARCA.suave};">
        Ficou com dúvida? É só responder este e-mail: a resposta chega direto para a nossa equipe.<br>
        <a href="${escapar(site)}/minha-area" style="color:${MARCA.verde};text-decoration:none;">Minha Área</a>
        &nbsp;·&nbsp; <a href="${escapar(site)}/faq" style="color:${MARCA.verde};text-decoration:none;">Perguntas frequentes</a>
        &nbsp;·&nbsp; <a href="${escapar(site)}/privacy" style="color:${MARCA.verde};text-decoration:none;">Política de privacidade</a>
        ${params.motivo ? `<br><span style="color:#8A939A;">${escapar(params.motivo)}</span>` : ""}
        <br><span style="color:#8A939A;">© ${new Date().getFullYear()} ${escapar(CONTATOS.nome)} · ${escapar(dominio)}</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/**
 * Versão em texto puro a partir do HTML. Melhora a entrega (filtros de spam
 * desconfiam de e-mail só em HTML) e é o que aparece em relógios e leitores.
 */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, "")
    .replace(/<(head|style|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, txt) => {
      const t = txt.replace(/<[^>]+>/g, "").trim();
      if (!t) return ""; // link só de imagem (logo)
      return href.startsWith("mailto:") || t === href ? t : `${t} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h1|tr|table|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8203;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

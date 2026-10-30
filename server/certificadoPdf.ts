/**
 * PDF do certificado (A4 paisagem) com a identidade da Shadia Hasan.
 *
 * Cores e logo são os mesmos dos e-mails (server/_core/emailLayout.ts e
 * client/public/email/logo-email.png). Títulos em Cormorant Garamond e textos
 * em Inter, embutidos a partir dos pacotes @fontsource (sem depender de fonte
 * instalada no servidor). Se alguma fonte faltar, cai para as fontes padrão do
 * PDF: o certificado nunca deixa de ser gerado por causa de fonte.
 *
 * Não inventa dados: sem carga horária, sem registro profissional. Só o que o
 * sistema sabe (aluno, aula ou Programa, data, número) e o QR de verificação.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { TipoCertificado } from "./certificados";

const COR = { azul: "#0B3354", verde: "#23686C", papel: "#F5F2EC", texto: "#24303A", suave: "#5B6770", linha: "#C9C2B6" } as const;

export type DadosPdf = {
  tipo: TipoCertificado;
  nomeAluno: string;
  titulo: string;
  subtitulo: string | null;
  numero: string;
  emitidoEm: Date;
  urlVerificacao: string;
};

export function dataPorExtenso(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" }).format(d);
}

const req = createRequire(import.meta.url);

function arquivoDeFonte(pacote: string, nome: string): string | null {
  try {
    const raiz = path.dirname(req.resolve(`${pacote}/package.json`));
    const f = path.join(raiz, "files", nome);
    return existsSync(f) ? f : null;
  } catch {
    return null;
  }
}

function ler(caminho: string | null): Buffer | null {
  try { return caminho ? readFileSync(caminho) : null; } catch { return null; }
}

function logoDaMarca(): Buffer | null {
  for (const base of [process.cwd(), path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")]) {
    for (const rel of ["client/public/email/logo-email.png", "dist/public/email/logo-email.png"]) {
      const b = ler(path.join(base, rel));
      if (b) return b;
    }
  }
  return null;
}

type Fontes = { titulo: string; tituloItalico: string; texto: string; textoForte: string };

function registrarFontes(doc: PDFKit.PDFDocument): Fontes {
  const alvo: Array<[string, string, string]> = [
    ["Titulo", "@fontsource/cormorant-garamond", "cormorant-garamond-latin-600-normal.woff"],
    ["TituloItalico", "@fontsource/cormorant-garamond", "cormorant-garamond-latin-500-italic.woff"],
    ["Texto", "@fontsource/inter", "inter-latin-400-normal.woff"],
    ["TextoForte", "@fontsource/inter", "inter-latin-600-normal.woff"],
  ];
  const ok: Record<string, boolean> = {};
  for (const [nome, pacote, arquivo] of alvo) {
    const b = ler(arquivoDeFonte(pacote, arquivo));
    if (!b) { ok[nome] = false; continue; }
    try { doc.registerFont(nome, b); ok[nome] = true; } catch { ok[nome] = false; }
  }
  return {
    titulo: ok.Titulo ? "Titulo" : "Times-Bold",
    tituloItalico: ok.TituloItalico ? "TituloItalico" : "Times-Italic",
    texto: ok.Texto ? "Texto" : "Helvetica",
    textoForte: ok.TextoForte ? "TextoForte" : "Helvetica-Bold",
  };
}

/** Menor corpo (a partir de `tamanho`, até `minimo`) em que o texto cabe em `maxLinhas` linhas de `largura`. */
function ajustar(doc: PDFKit.PDFDocument, texto: string, fonte: string, tamanho: number, largura: number, minimo: number, maxLinhas = 1): number {
  let t = tamanho;
  doc.font(fonte);
  while (t > minimo) {
    doc.fontSize(t);
    const umaLinha = doc.heightOfString("Ag", { width: 100000 });
    if (doc.heightOfString(texto, { width: largura }) <= umaLinha * maxLinhas * 1.02) break;
    t -= 1;
  }
  return t;
}

export async function gerarPdfCertificado(d: DadosPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4", layout: "landscape", margin: 0,
    info: {
      Title: `Certificado ${d.numero}`,
      Author: "Shadia Hasan · Psicologia & Desenvolvimento Humano",
      Subject: d.tipo === "programa" ? "Certificado de conclusão de Programa" : "Certificado de conclusão de aula",
    },
  });
  const pedacos: Buffer[] = [];
  doc.on("data", (c: Buffer) => pedacos.push(c));
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(pedacos)));
    doc.on("error", reject);
  });

  const L = doc.page.width; // 841.89
  const A = doc.page.height; // 595.28
  const f = registrarFontes(doc);
  const centro = L / 2;

  // Fundo e molduras
  doc.rect(0, 0, L, A).fill(COR.papel);
  doc.lineWidth(1.4).strokeColor(COR.azul).rect(22, 22, L - 44, A - 44).stroke();
  doc.lineWidth(0.5).strokeColor(COR.verde).rect(30, 30, L - 60, A - 60).stroke();

  // Logo
  const logo = logoDaMarca();
  let y = 48;
  if (logo) {
    try { doc.image(logo, centro - 52, y, { width: 104 }); y += 104 * (361 / 440) + 14; } catch { y += 20; }
  } else {
    doc.font(f.titulo).fontSize(26).fillColor(COR.azul).text("SHADIA HASAN", 0, y, { width: L, align: "center", characterSpacing: 2 });
    y += 44;
  }

  // Tipo do certificado
  const kicker = d.tipo === "programa" ? "CERTIFICADO DE CONCLUSÃO DO PROGRAMA" : "CERTIFICADO DE CONCLUSÃO DE AULA";
  doc.font(f.textoForte).fontSize(10).fillColor(COR.verde).text(kicker, 0, y, { width: L, align: "center", characterSpacing: 2.6 });
  y += 30;

  doc.font(f.tituloItalico).fontSize(17).fillColor(COR.suave).text("Certificamos que", 0, y, { width: L, align: "center" });
  y += 26;

  // Nome do aluno: uma linha sempre que possível; nome enorme encolhe e, no limite, usa duas
  const nome = d.nomeAluno.trim();
  const larguraNome = L - 200;
  const tamNome = ajustar(doc, nome, f.titulo, 42, larguraNome, 20, 1);
  doc.font(f.titulo).fontSize(tamNome).fillColor(COR.azul);
  const alturaNome = doc.heightOfString(nome, { width: larguraNome, align: "center" });
  doc.text(nome, 100, y, { width: larguraNome, align: "center" });
  y += alturaNome + 12;
  doc.lineWidth(0.6).strokeColor(COR.verde).moveTo(centro - 150, y).lineTo(centro + 150, y).stroke();
  y += 16;

  doc.font(f.tituloItalico).fontSize(17).fillColor(COR.suave)
    .text(d.tipo === "programa" ? "concluiu todas as aulas do Programa" : "concluiu a aula", 0, y, { width: L, align: "center" });
  y += 28;

  // Título: até 2 linhas, encolhendo o corpo antes de cortar
  const larguraTitulo = L - 220;
  const tamTitulo = ajustar(doc, d.titulo, f.titulo, 28, larguraTitulo, 17, 2);
  doc.font(f.titulo).fontSize(tamTitulo).fillColor(COR.azul);
  const umaLinhaTitulo = doc.heightOfString("Ag", { width: 100000 });
  const alturaTitulo = Math.min(doc.heightOfString(d.titulo, { width: larguraTitulo, align: "center" }), umaLinhaTitulo * 2.02);
  doc.text(d.titulo, 110, y, { width: larguraTitulo, align: "center", height: umaLinhaTitulo * 2.02, ellipsis: true });
  y += alturaTitulo + 8;

  if (d.subtitulo && d.tipo === "aula") {
    doc.font(f.texto).fontSize(11).fillColor(COR.suave).text(`Programa: ${d.subtitulo}`, 110, y, { width: larguraTitulo, align: "center", height: 16, ellipsis: true });
    y += 22;
  }

  doc.font(f.texto).fontSize(11).fillColor(COR.texto).text(`Emitido em ${dataPorExtenso(d.emitidoEm)}`, 0, Math.max(y + 6, A - 168), { width: L, align: "center" });

  // Rodapé: assinatura, número e QR
  const base = A - 98;
  doc.lineWidth(0.6).strokeColor(COR.linha).moveTo(78, base).lineTo(290, base).stroke();
  doc.font(f.titulo).fontSize(17).fillColor(COR.azul).text("Shadia Hasan", 78, base + 6, { width: 212, align: "center" });
  doc.font(f.texto).fontSize(8.5).fillColor(COR.suave).text("Psicologia & Desenvolvimento Humano", 78, base + 27, { width: 212, align: "center" });

  doc.font(f.texto).fontSize(8.5).fillColor(COR.suave).text("Número do certificado", 0, base + 2, { width: L, align: "center" });
  doc.font(f.textoForte).fontSize(11).fillColor(COR.azul).text(d.numero, 0, base + 15, { width: L, align: "center", characterSpacing: 0.8 });

  const qr = await QRCode.toBuffer(d.urlVerificacao, { margin: 0, width: 300, errorCorrectionLevel: "M", color: { dark: COR.azul, light: COR.papel } });
  const tamQr = 64;
  doc.image(qr, L - 78 - tamQr, base - 26, { width: tamQr });
  doc.font(f.texto).fontSize(7.5).fillColor(COR.suave)
    .text("Confira a autenticidade", L - 78 - tamQr - 208, base - 14, { width: 200, align: "right" })
    .text(d.urlVerificacao.replace(/^https?:\/\//, ""), L - 78 - tamQr - 208, base - 2, { width: 200, align: "right" });

  doc.end();
  return pronto;
}

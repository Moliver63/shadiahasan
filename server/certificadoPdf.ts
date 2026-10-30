/**
 * PDF do certificado (A4 paisagem), no modelo de referência enviado pela
 * Shadia: fundo branco, moldura dupla azul, fita e árvore à esquerda, ramo no
 * canto superior direito (server/assets/certificado-arte.jpg), logo real no topo,
 * título grande em serifa, nome do aluno em azul, bloco de assinatura e QR.
 *
 * Títulos em Cormorant Garamond e textos em Inter, embutidos a partir dos
 * pacotes @fontsource. Se fonte, arte ou logo faltarem, o certificado ainda é
 * gerado (fontes padrão do PDF, sem arte, nome da marca em texto).
 *
 * Não inventa dados: carga horária só aparece quando a duração das aulas é
 * conhecida; não imprime CPF nem registro profissional.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { TipoCertificado } from "./certificados";

const COR = {
  titulo: "#1B2A5C",
  nome: "#2438A8",
  moldura: "#2D70AC",
  molduraFina: "#447DB8",
  texto: "#3B4560",
  suave: "#66708A",
  linha: "#C5CCDD",
} as const;

export type DadosPdf = {
  tipo: TipoCertificado;
  nomeAluno: string;
  titulo: string;
  subtitulo: string | null;
  numero: string;
  emitidoEm: Date;
  urlVerificacao: string;
  /** Soma das durações das aulas, em segundos. Sem valor, a carga horária não é impressa. */
  duracaoSegundos?: number | null;
};

export function dataPorExtenso(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** "1h 20min", "45 min", "2h". Menos de 1 minuto ou valor inválido: null (não imprime). */
export function formatarCarga(segundos: number | null | undefined): string | null {
  if (!segundos || !Number.isFinite(segundos) || segundos < 60) return null;
  const min = Math.round(segundos / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}min`;
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

function bases(): string[] {
  return [process.cwd(), path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")];
}

function logoDaMarca(): Buffer | null {
  for (const base of bases()) {
    for (const rel of ["server/assets/logo-certificado.png", "client/public/email/logo-email.png", "dist/public/email/logo-email.png"]) {
      const b = ler(path.join(base, rel));
      if (b) return b;
    }
  }
  return null;
}

function arteDeFundo(): Buffer | null {
  for (const base of bases()) {
    for (const rel of ["server/assets/certificado-arte.jpg", "dist/assets/certificado-arte.jpg", "assets/certificado-arte.jpg"]) {
      const b = ler(path.join(base, rel));
      if (b) return b;
    }
  }
  return null;
}

type Fontes = { titulo: string; tituloItalico: string; texto: string; textoForte: string };

function registrarFontes(doc: PDFKit.PDFDocument): Fontes {
  const alvo: Array<[string, string, string]> = [
    ["Titulo", "@fontsource/cormorant-garamond", "cormorant-garamond-latin-700-normal.woff"],
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
      Subject: d.tipo === "programa" ? "Certificado de conclusão de programa" : "Certificado de conclusão de aula",
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
  const cx = L / 2;
  // Zona de texto: entre a fita/árvore (esquerda) e o ramo (direita) da arte.
  const zx = 190;
  const zl = L - 2 * zx; // ~462

  // Fundo branco + arte
  doc.rect(0, 0, L, A).fill("#FFFFFF");
  const arte = arteDeFundo();
  if (arte) { try { doc.image(arte, 0, 0, { width: L, height: A }); } catch { /* segue sem arte */ } }

  // Moldura dupla (vetorial, nítida em qualquer zoom)
  doc.lineWidth(1.9).strokeColor(COR.moldura).rect(6.8, 6.8, L - 13.6, A - 13.6).stroke();
  doc.lineWidth(0.8).strokeColor(COR.molduraFina).rect(12.4, 12.4, L - 24.8, A - 24.8).stroke();

  // Logo
  const logo = logoDaMarca();
  let y = 34;
  if (logo) {
    try { const w = 96; doc.image(logo, cx - w / 2, y, { width: w }); y += w * (361 / 440) + 8; } catch { y += 20; }
  } else {
    doc.font(f.titulo).fontSize(24).fillColor(COR.titulo).text("SHADIA HASAN", 0, y + 8, { width: L, align: "center", characterSpacing: 2 });
    y += 52;
  }

  doc.font(f.textoForte).fontSize(8.5).fillColor(COR.moldura)
    .text("UMA JORNADA DE APRENDIZADO", 0, y, { width: L, align: "center", characterSpacing: 3.2 });
  y += 24;

  const tTit = ajustar(doc, "Certificado de Conclusão", f.titulo, 46, zl + 40, 30, 1);
  doc.font(f.titulo).fontSize(tTit).fillColor(COR.titulo)
    .text("Certificado de Conclusão", 0, y, { width: L, align: "center" });
  y += tTit * 1.05 + 18;

  doc.font(f.tituloItalico).fontSize(15).fillColor(COR.suave).text("Certificamos que", 0, y, { width: L, align: "center" });
  y += 28;

  // Nome: uma linha sempre que possível; nome enorme encolhe e, no limite, usa duas
  const nome = d.nomeAluno.trim();
  const tamNome = ajustar(doc, nome, f.titulo, 36, zl + 30, 18, 1);
  doc.font(f.titulo).fontSize(tamNome).fillColor(COR.nome);
  const alturaNome = doc.heightOfString(nome, { width: zl + 30, align: "center" });
  doc.text(nome, cx - (zl + 30) / 2, y, { width: zl + 30, align: "center" });
  y += alturaNome + 10;
  const grad = doc.linearGradient(cx - 190, y, cx + 190, y);
  grad.stop(0, "#FFFFFF").stop(0.5, COR.nome).stop(1, "#FFFFFF");
  doc.rect(cx - 190, y, 380, 1.3).fill(grad);
  y += 20;

  doc.font(f.tituloItalico).fontSize(15).fillColor(COR.suave)
    .text(d.tipo === "programa" ? "concluiu o programa" : "concluiu a aula", 0, y, { width: L, align: "center" });
  y += 28;

  const larguraTitulo = zl + 20;
  const tamTitulo = ajustar(doc, d.titulo, f.titulo, 26, larguraTitulo, 16, 2);
  doc.font(f.titulo).fontSize(tamTitulo).fillColor(COR.titulo);
  const umaLinhaTitulo = doc.heightOfString("Ag", { width: 100000 });
  const alturaTitulo = Math.min(doc.heightOfString(d.titulo, { width: larguraTitulo, align: "center" }), umaLinhaTitulo * 2.02);
  doc.text(d.titulo, cx - larguraTitulo / 2, y, { width: larguraTitulo, align: "center", height: umaLinhaTitulo * 2.02, ellipsis: true });
  y += alturaTitulo + 8;

  if (d.subtitulo && d.tipo === "aula") {
    doc.font(f.texto).fontSize(10.5).fillColor(COR.suave).text(`Programa: ${d.subtitulo}`, cx - larguraTitulo / 2, y, { width: larguraTitulo, align: "center", height: 15, ellipsis: true });
    y += 20;
  }

  const carga = formatarCarga(d.duracaoSegundos);
  const linhaData = `Emitido em ${dataPorExtenso(d.emitidoEm)}${carga ? `  ·  Carga horária: ${carga}` : ""}`;
  doc.font(f.texto).fontSize(10.5).fillColor(COR.texto).text(linhaData, cx - larguraTitulo / 2, Math.min(y + 8, 424), { width: larguraTitulo, align: "center" });

  // Divisor e bloco de assinatura
  const yDiv = 474;
  doc.lineWidth(0.6).strokeColor(COR.linha).moveTo(172, yDiv).lineTo(L - 172, yDiv).stroke();
  const yBloco = yDiv + 14;
  doc.font(f.tituloItalico).fontSize(20).fillColor(COR.titulo).text("Shadia Hasan", 200, yBloco, { width: cx - 200 - 24, align: "center" });
  doc.font(f.texto).fontSize(8.5).fillColor(COR.suave)
    .text(d.tipo === "programa" ? "Responsável pelo programa" : "Responsável pela aula", 200, yBloco + 25, { width: cx - 200 - 24, align: "center" });
  doc.lineWidth(0.6).strokeColor(COR.linha).moveTo(cx, yBloco, ).lineTo(cx, yBloco + 38).stroke();
  doc.font(f.texto).fontSize(8.5).fillColor(COR.suave)
    .text("Identificação do certificado", cx + 24, yBloco + 2, { width: cx - 200 - 24, align: "center" });
  doc.font(f.textoForte).fontSize(11.5).fillColor(COR.titulo)
    .text(d.numero, cx + 24, yBloco + 17, { width: cx - 200 - 24, align: "center", characterSpacing: 0.8 });

  doc.font(f.textoForte).fontSize(9).fillColor(COR.moldura)
    .text("shadiahasan.com", 0, yBloco + 52, { width: L, align: "center", characterSpacing: 0.6 });

  // QR de verificação, canto inferior direito (área livre da arte)
  const qr = await QRCode.toBuffer(d.urlVerificacao, { margin: 0, width: 300, errorCorrectionLevel: "M", color: { dark: COR.titulo, light: "#FFFFFF" } });
  const tamQr = 54;
  const qx = L - 56 - tamQr;
  doc.image(qr, qx, yBloco - 6, { width: tamQr });
  doc.font(f.texto).fontSize(6.5).fillColor(COR.suave)
    .text("Verifique a autenticidade", qx - 16, yBloco + tamQr - 1, { width: tamQr + 32, align: "center" });

  doc.end();
  return pronto;
}

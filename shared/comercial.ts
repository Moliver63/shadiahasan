/**
 * shared/comercial.ts — regras puras da venda avulsa de Programas (front e back).
 *
 * O que é vendido avulso é o Programa (`contentCollections`), não o curso:
 * em produção, "Permita-se Ser Livre", "Jornada do Código Interno",
 * "Pensamentos Automáticos" e "A vida responde ao que você pensa" são
 * Programas que juntam aulas de vários cursos em rascunho.
 */

export type ModeloComercial = "assinatura" | "avulso";
export const MODELOS_COMERCIAIS: ModeloComercial[] = ["assinatura", "avulso"];
export const MODELO_PADRAO: ModeloComercial = "assinatura";

export type MetodoPagamento = "pix" | "cartao" | "boleto";
export const METODOS: MetodoPagamento[] = ["pix", "cartao", "boleto"];
export type MetodosAtivos = Record<MetodoPagamento, boolean>;
export const METODOS_PADRAO: MetodosAtivos = { pix: true, cartao: true, boleto: false };

export const NOME_METODO: Record<MetodoPagamento, string> = {
  pix: "Pix",
  cartao: "Cartão de crédito",
  boleto: "Boleto",
};

/** billingType do Asaas para cada forma escolhida pelo aluno. */
export const BILLING_TYPE: Record<MetodoPagamento, "PIX" | "CREDIT_CARD" | "BOLETO"> = {
  pix: "PIX",
  cartao: "CREDIT_CARD",
  boleto: "BOLETO",
};

/** Faixa aceita para o preço de um Programa (centavos). Fora dela, não vende. */
export const PRECO_MIN = 500; // R$ 5,00 (mínimo do Asaas para Pix/boleto)
export const PRECO_MAX = 1_000_000; // R$ 10.000,00

export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "197,00", "R$ 197", "197.5" → centavos. Devolve null se não for um valor válido. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = String(texto ?? "").replace(/[R$\s]/g, "").trim();
  if (!limpo) return null;
  // "1.234,56" (pt-BR) ou "1234.56"
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return Math.round(Number(normalizado) * 100);
}

export type ErroPreco = string | null;

/**
 * Preço de venda obrigatório para vender; o "de" (riscado) é opcional e,
 * quando existe, precisa ser maior que o preço de venda. Assim a tela nunca
 * mostra "de R$ 57 por R$ 197" nem um riscado igual ao preço.
 */
export function validarPrecos(precoCentavos: number | null, precoOriginalCentavos: number | null): ErroPreco {
  if (precoCentavos == null) return null; // sem preço = não vende avulso; não é erro
  if (!Number.isInteger(precoCentavos) || precoCentavos < PRECO_MIN || precoCentavos > PRECO_MAX) {
    return `O preço precisa estar entre ${formatarReais(PRECO_MIN)} e ${formatarReais(PRECO_MAX)}.`;
  }
  if (precoOriginalCentavos != null) {
    if (!Number.isInteger(precoOriginalCentavos) || precoOriginalCentavos > PRECO_MAX) return "Preço original inválido.";
    if (precoOriginalCentavos <= precoCentavos) return "O preço original (riscado) precisa ser maior que o preço de venda.";
  }
  return null;
}

/** Programa está à venda? (preço válido). O modo comercial é conferido à parte. */
export function precoVendavel(precoCentavos: number | null | undefined): precoCentavos is number {
  return typeof precoCentavos === "number" && validarPrecos(precoCentavos, null) === null;
}

export function percentualDesconto(preco: number, original: number | null | undefined): number | null {
  if (!original || original <= preco) return null;
  return Math.round((1 - preco / original) * 100);
}

/** Referência externa da cobrança no Asaas: "programa:<userId>:<collectionId>". */
export const REF_PROGRAMA = /^programa:(\d+):(\d+)$/;
export function refPrograma(userId: number, collectionId: number): string {
  return `programa:${userId}:${collectionId}`;
}
export function lerRefPrograma(ref?: string | null): { userId: number; collectionId: number } | null {
  const m = REF_PROGRAMA.exec(ref || "");
  return m ? { userId: Number(m[1]), collectionId: Number(m[2]) } : null;
}

export function metodosAtivos(valor: unknown): MetodosAtivos {
  const v = (valor && typeof valor === "object" ? valor : {}) as Partial<Record<MetodoPagamento, unknown>>;
  const r = { ...METODOS_PADRAO };
  for (const m of METODOS) if (typeof v[m] === "boolean") r[m] = v[m] as boolean;
  return r;
}

/** Linhas não vazias de um campo "uma por linha". */
export function linhas(texto?: string | null): string[] {
  return String(texto ?? "").split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

/** Parágrafos separados por linha em branco. */
export function paragrafos(texto?: string | null): string[] {
  return String(texto ?? "").split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Compra sem conta (pagar primeiro, conta depois): "programaguest:<convidadoId>:<collectionId>". */
export const REF_PROGRAMA_CONVIDADO = /^programaguest:(\d+):(\d+)$/;
export function refConvidado(convidadoId: number, collectionId: number): string {
  return `programaguest:${convidadoId}:${collectionId}`;
}
export function lerRefConvidado(ref?: string | null): { convidadoId: number; collectionId: number } | null {
  const m = REF_PROGRAMA_CONVIDADO.exec(ref || "");
  return m ? { convidadoId: Number(m[1]), collectionId: Number(m[2]) } : null;
}

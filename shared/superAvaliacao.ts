/**
 * Super Avaliação: devolutiva escrita, gerada por IA no tom da Shadia, sobre as
 * respostas do Diário da Transformação (exercício grátis ou diário completo).
 * Regras puras, usadas no servidor e nos testes.
 */

export const PRECO_SUPER_AVALIACAO_CENTAVOS = 1500;

/** Cobrança no Asaas: externalReference "avaliacao:<id>". */
export const REF_AVALIACAO = /^avaliacao:(\d+)$/;
export const refAvaliacao = (id: number) => `avaliacao:${id}`;

export type OrigemAvaliacao = "amostra" | "diario";

export type RespostaAvaliada = { secao: string; pergunta: string; resposta: string };

/** Mínimo para a avaliação ter o que ler: respostas e palavras. */
export const MINIMO = {
  amostra: { respostas: 4, palavras: 25 },
  diario: { respostas: 6, palavras: 80 },
} as const;

const LIMITE_RESPOSTA = 3000;
const LIMITE_TOTAL = 24000;
const MAX_RESPOSTAS = 80;

/** Limpa e corta o que veio do navegador. Descarta respostas vazias. */
export function normalizarRespostas(entrada: unknown): RespostaAvaliada[] {
  if (!Array.isArray(entrada)) return [];
  const saida: RespostaAvaliada[] = [];
  let total = 0;
  for (const item of entrada.slice(0, MAX_RESPOSTAS)) {
    const r = item as Record<string, unknown>;
    const resposta = String(r?.resposta ?? "").trim().slice(0, LIMITE_RESPOSTA);
    if (!resposta) continue;
    if (total + resposta.length > LIMITE_TOTAL) break;
    total += resposta.length;
    saida.push({
      secao: String(r?.secao ?? "").trim().slice(0, 80),
      pergunta: String(r?.pergunta ?? "").trim().slice(0, 300),
      resposta,
    });
  }
  return saida;
}

export function contarPalavras(respostas: RespostaAvaliada[]): number {
  return respostas.reduce((n, r) => n + r.resposta.split(/\s+/).filter(Boolean).length, 0);
}

export function temMaterialSuficiente(origem: OrigemAvaliacao, respostas: RespostaAvaliada[]): boolean {
  const m = MINIMO[origem];
  return respostas.length >= m.respostas && contarPalavras(respostas) >= m.palavras;
}

/**
 * Sinais de risco no que a pessoa escreveu. Não decide nada sozinho: só garante
 * que a devolutiva abra com o cuidado (CVV 188, SAMU 192), mesmo se a IA esquecer.
 */
const SINAIS_DE_RISCO = [
  /suic/i, /me matar/i, /tirar (a )?minha (pr[oó]pria )?vida/i, /n[aã]o quero mais viver/i, /queria morrer/i,
  /quero morrer/i, /acabar com (a )?minha vida/i, /me machucar/i, /me cortar/i, /autoles/i, /automutila/i,
  /sumir (de vez|para sempre|pra sempre)/i,
];
export function temSinalDeRisco(respostas: RespostaAvaliada[]): boolean {
  return respostas.some((r) => SINAIS_DE_RISCO.some((re) => re.test(r.resposta)));
}

export type DevolutivaAvaliacao = {
  abertura: string;
  padroes: Array<{ titulo: string; texto: string }>;
  forcas: string[];
  perguntas: string[];
  passos: string[];
  fechamento: string;
  cuidado?: string;
};

const texto = (v: unknown, max = 1200) => String(v ?? "").trim().slice(0, max);
const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => texto(x, 600)).filter(Boolean).slice(0, max) : []);

/** Lê o JSON da IA com tolerância (cerca de código, campos faltando). Null se não der para usar. */
export function lerDevolutiva(bruto: string, risco: boolean): DevolutivaAvaliacao | null {
  const limpo = String(bruto ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let j: Record<string, unknown>;
  try {
    const ini = limpo.indexOf("{"), fim = limpo.lastIndexOf("}");
    j = JSON.parse(ini >= 0 && fim > ini ? limpo.slice(ini, fim + 1) : limpo);
  } catch {
    return null;
  }
  const d: DevolutivaAvaliacao = {
    abertura: texto(j.abertura),
    padroes: Array.isArray(j.padroes)
      ? (j.padroes as unknown[]).map((p) => ({ titulo: texto((p as any)?.titulo, 120), texto: texto((p as any)?.texto) })).filter((p) => p.titulo && p.texto).slice(0, 4)
      : [],
    forcas: lista(j.forcas, 4),
    perguntas: lista(j.perguntas, 5),
    passos: lista(j.passos, 4),
    fechamento: texto(j.fechamento, 800),
  };
  if (!d.abertura || d.padroes.length === 0 || d.passos.length === 0) return null;
  const cuidadoIA = texto(j.cuidado, 800);
  if (risco || cuidadoIA) d.cuidado = cuidadoIA || TEXTO_CUIDADO;
  if (risco && !/188/.test(d.cuidado ?? "")) d.cuidado = `${d.cuidado} ${TEXTO_CUIDADO}`;
  return d;
}

export const TEXTO_CUIDADO =
  "Se em algum momento a dor ficar grande demais ou surgir a vontade de se machucar, você não precisa passar por isso sozinha. Ligue para o CVV no 188 (24 horas, gratuito) ou para o SAMU no 192, e procure uma pessoa de confiança ou um profissional de saúde mental.";

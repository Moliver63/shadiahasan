/**
 * Presentes por Programa: material extra para quem compra.
 *
 * Hoje só o Diário da Transformação, de Pensamentos Automáticos (Programa 9 em
 * produção). O arquivo fica em server/assets/presentes e só é entregue pela
 * rota /api/presentes/<programa>/<arquivo>, que confere quem pode baixar.
 * O título precisa bater com o do Programa (proteção contra id trocado).
 */
export type Presente = {
  titulo: string;
  descricao: string;
  arquivo: string; // nome em server/assets/presentes
  /** Versão online (página protegida) e exercício grátis público, quando houver. */
  online?: string;
  amostra?: string;
  paraPrograma: RegExp;
};

export const PRESENTES: Record<number, Presente> = {
  9: {
    titulo: "Diário da Transformação",
    descricao: "O diário da Shadia para responder ao fim de cada módulo, online ou em PDF: 5 capítulos guiados com a história da Júlia como exemplo, mapa dos pensamentos, uma semana de observação, carta para sua versão futura (que chega no seu e-mail seis meses depois) e plano de continuidade.",
    arquivo: "diario-da-transformacao.pdf",
    online: "/presentes/diario",
    amostra: "/diario",
    paraPrograma: /pensamentos\s+autom[áa]ticos/i,
  },
};

export function presenteDoPrograma(collectionId: number, tituloPrograma?: string | null): Presente | null {
  const p = PRESENTES[collectionId];
  if (!p) return null;
  if (tituloPrograma != null && !p.paraPrograma.test(tituloPrograma)) return null;
  return p;
}

export function urlDoPresente(collectionId: number, p: Presente): string {
  return `/api/presentes/${collectionId}/${p.arquivo}`;
}

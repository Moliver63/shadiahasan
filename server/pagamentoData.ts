/**
 * pagamentoData.ts — quando o pagamento entrou, a partir do que o Asaas manda.
 *
 * O Asaas manda `paymentDate` só com a data ("2026-10-29"), sem hora.
 * `new Date("2026-10-29")` vira meia-noite UTC, e a venda das 13:20 aparecia
 * gravada como 00:00 — 21:00 do dia anterior em Brasília. Qualquer conta por
 * hora (o aviso de venda nova, o "última hora" do painel) perdia a venda.
 *
 * Regra:
 *  - veio com hora (ISO completo): usa como veio;
 *  - veio só a data e é hoje em Brasília: o webhook chegou agora, então é agora;
 *  - veio só a data de outro dia (reprocessamento atrasado): meio-dia de
 *    Brasília daquele dia, para cair no dia certo em qualquer fuso;
 *  - não veio nada ou veio lixo: agora.
 */

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" do instante dado, no horário de Brasília. */
export function dataEmBrasilia(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

export function momentoDoPagamento(paymentDate: string | null | undefined, agora: Date = new Date()): Date {
  if (!paymentDate) return agora;
  const valor = String(paymentDate).trim();
  if (SO_DATA.test(valor)) {
    if (valor === dataEmBrasilia(agora)) return agora;
    return new Date(`${valor}T12:00:00-03:00`);
  }
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? agora : d;
}

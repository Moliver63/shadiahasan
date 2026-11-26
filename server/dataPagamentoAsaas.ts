/**
 * O Asaas manda `paymentDate` só como data ("2026-11-26", dia de Brasília). `new Date("2026-11-26")`
 * vira meia-noite UTC, ou seja, 21h do dia ANTERIOR em Brasília: a cobrança de 26/11 aparecia
 * como paga em 25/11 21:00 no histórico. Aqui a data vira meio-dia de Brasília, limitada ao
 * instante atual (para um pagamento de hoje de manhã não ficar no futuro). Sem data válida, agora.
 */
export function dataDePagamentoAsaas(paymentDate?: string | null, agora: Date = new Date()): Date {
  if (!paymentDate || !/^\d{4}-\d{2}-\d{2}/.test(paymentDate)) return agora;
  const meioDia = new Date(`${paymentDate.slice(0, 10)}T12:00:00-03:00`);
  if (Number.isNaN(meioDia.getTime())) return agora;
  return meioDia.getTime() > agora.getTime() ? agora : meioDia;
}

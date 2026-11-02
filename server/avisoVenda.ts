/**
 * avisoVenda.ts — push no celular a cada venda confirmada (via ntfy.sh).
 *
 * Configuração: defina NTFY_TOPIC no Render com um nome difícil de adivinhar
 * (ex.: shadia-vendas-8f3k2q). No celular, instale o app ntfy e assine o
 * mesmo tópico. Sem NTFY_TOPIC, nada é enviado.
 *
 * Regras:
 *  - Só avisa na transição para "completed" (não repete em webhooks duplicados).
 *  - Não avisa pagamentos antigos (sincronização retroativa): paidAt > 48h.
 *  - Nunca envia nome, e-mail ou CPF — só valor, produto, forma e horário.
 *  - Nunca lança: o aviso não pode quebrar o processamento de um pagamento.
 */

export type DadosVenda = {
  amount?: number | null; // centavos
  planSlug?: string | null;
  paymentMethod?: string | null;
  paidAt?: Date | null;
};

const JANELA_MS = 48 * 60 * 60 * 1000;

export function textoDaVenda(v: DadosVenda): { titulo: string; corpo: string } {
  const valor = ((v.amount ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const produto = v.planSlug === "trial" ? "Teste de 1 aula" : `Assinatura${v.planSlug ? ` (${v.planSlug})` : ""}`;
  const forma = formaDePagamento(v.paymentMethod);
  const quando = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return { titulo: `Venda confirmada: ${valor}`, corpo: `${produto} · ${forma} · ${quando}` };
}

export function formaDePagamento(m?: string | null): string {
  const s = (m || "").toLowerCase();
  if (s.includes("pix")) return "Pix";
  if (s.includes("credit") || s.includes("card") || s === "stripe") return "Cartão";
  if (s.includes("boleto")) return "Boleto";
  return m || "não informado";
}

export function deveAvisar(v: DadosVenda, agora = Date.now()): boolean {
  if (!v.paidAt) return true;
  const t = new Date(v.paidAt).getTime();
  return Number.isNaN(t) || agora - t <= JANELA_MS;
}

export async function avisarVenda(v: DadosVenda): Promise<void> {
  const topico = process.env.NTFY_TOPIC;
  if (!topico || !deveAvisar(v)) return;
  try {
    const { titulo, corpo } = textoDaVenda(v);
    const base = (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/$/, "");
    // Publicação em JSON: aceita acentos e "R$" no título sem problema de header.
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topico, title: titulo, message: corpo, tags: ["moneybag"], priority: 4 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) console.error("[AvisoVenda] ntfy respondeu", r.status);
  } catch (e) {
    console.error("[AvisoVenda] falha:", e instanceof Error ? e.message : e);
  }
}

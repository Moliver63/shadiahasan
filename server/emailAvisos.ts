/**
 * emailAvisos.ts — e-mails automáticos de assinatura, enviados uma vez só.
 *
 * Os webhooks (Asaas, Stripe) podem chegar repetidos e eventos com erro são
 * reprocessados na subida do servidor. Para o aluno não receber o mesmo e-mail
 * duas vezes, cada aviso reserva uma chave em `emailAvisosEnviados` ANTES de
 * enviar. Se o envio falhar, a reserva é desfeita e a próxima tentativa envia.
 *
 * Nenhuma função daqui lança: e-mail nunca pode quebrar o processamento de um
 * pagamento.
 */

import { eq, sql } from "drizzle-orm";
import * as db from "./db";
import { emailAvisosEnviados, users } from "../drizzle/schema";
import type { ResultadoEnvio } from "./_core/email";

let schemaPronto: Promise<boolean> | null = null;

export function ensureAvisosSchema(): Promise<boolean> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "emailAvisosEnviados" (
            "chave" varchar(200) PRIMARY KEY,
            "userId" integer,
            "tipo" varchar(40) NOT NULL,
            "resendId" varchar(100),
            "enviadoEm" timestamp NOT NULL DEFAULT now()
          )
        `);
        return true;
      } catch (e) {
        console.error("[Avisos] falha ao criar tabela:", e instanceof Error ? e.message : e);
        schemaPronto = null;
        return false;
      }
    })();
  }
  return schemaPronto;
}

async function pessoa(userId: number) {
  const d = await db.getDb();
  if (!d) return null;
  const [u] = await d.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.email ? { email: u.email, name: u.name || "" } : null;
}

/**
 * Envia no máximo uma vez por `chave`. Retorna true se enviou agora.
 */
export async function enviarUmaVez(
  chave: string,
  userId: number,
  tipo: string,
  enviar: (p: { email: string; name: string }) => Promise<ResultadoEnvio>,
): Promise<boolean> {
  try {
    if (!(await ensureAvisosSchema())) return false;
    const d = await db.getDb();
    if (!d) return false;
    const destinatario = await pessoa(userId);
    if (!destinatario) return false;

    const reservado = await d
      .insert(emailAvisosEnviados)
      .values({ chave: chave.slice(0, 200), userId, tipo })
      .onConflictDoNothing()
      .returning({ chave: emailAvisosEnviados.chave });
    if (!reservado.length) return false; // já enviado antes

    const r = await enviar(destinatario);
    if (!r.success) {
      await d.delete(emailAvisosEnviados).where(eq(emailAvisosEnviados.chave, chave.slice(0, 200)));
      return false;
    }
    if (r.id) {
      await d.update(emailAvisosEnviados).set({ resendId: r.id }).where(eq(emailAvisosEnviados.chave, chave.slice(0, 200)));
    }
    return true;
  } catch (e) {
    console.warn(`[Avisos] falha no aviso ${tipo} (${chave}):`, e instanceof Error ? e.message : e);
    return false;
  }
}

const FORMAS: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  undefined: "",
};

export function nomeFormaPagamento(billingType?: string | null): string | null {
  if (!billingType) return null;
  return FORMAS[billingType.toLowerCase()] || null;
}

// ─── Avisos de assinatura ────────────────────────────────────────────────────

export async function avisarAssinaturaAtivada(p: {
  chave: string;
  userId: number;
  plano: string;
  valorCentavos?: number | null;
  forma?: string | null;
}) {
  const { sendAssinaturaAtivadaEmail, enviarAvisoInterno } = await import("./_core/email");
  const enviou = await enviarUmaVez(p.chave, p.userId, "assinatura_ativada", (u) =>
    sendAssinaturaAtivadaEmail(u.email, u.name, { plano: p.plano, valorCentavos: p.valorCentavos, forma: p.forma }),
  );
  if (enviou) {
    // Aviso para a equipe; uma vez por assinatura, junto com o do aluno.
    const u = await pessoa(p.userId);
    void enviarAvisoInterno("Nova assinatura", [
      `${u?.name || "Aluno"} (${u?.email || "sem e-mail"}) assinou o plano ${p.plano}.`,
      p.valorCentavos ? `Valor: ${(p.valorCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "",
    ].filter(Boolean)).catch(() => undefined);
  }
  return enviou;
}

export function avisarPagamentoRecebido(p: {
  chave: string;
  userId: number;
  plano: string;
  valorCentavos?: number | null;
  pagoEm?: Date | null;
  reativado?: boolean;
  reciboUrl?: string | null;
}) {
  return enviarUmaVez(p.chave, p.userId, p.reativado ? "acesso_reativado" : "pagamento_recebido", async (u) => {
    const { sendPagamentoRecebidoEmail } = await import("./_core/email");
    return sendPagamentoRecebidoEmail(u.email, u.name, p);
  });
}

export function avisarPagamentoAtrasado(p: {
  chave: string;
  userId: number;
  plano: string;
  faturaUrl?: string | null;
  diasCarencia: number;
  falhaCartao?: boolean;
}) {
  return enviarUmaVez(p.chave, p.userId, "pagamento_atrasado", async (u) => {
    const { sendPagamentoAtrasadoEmail } = await import("./_core/email");
    return sendPagamentoAtrasadoEmail(u.email, u.name, p);
  });
}

export function avisarAcessoPausado(p: { chave: string; userId: number; plano: string; faturaUrl?: string | null }) {
  return enviarUmaVez(p.chave, p.userId, "acesso_pausado", async (u) => {
    const { sendAcessoPausadoEmail } = await import("./_core/email");
    return sendAcessoPausadoEmail(u.email, u.name, p);
  });
}

export function avisarCancelamento(p: { chave: string; userId: number; plano: string; acessoAte: Date | null }) {
  return enviarUmaVez(p.chave, p.userId, "cancelamento", async (u) => {
    const { sendCancelamentoConfirmadoEmail } = await import("./_core/email");
    return sendCancelamentoConfirmadoEmail(u.email, u.name, p);
  });
}

export function avisarAssinaturaEncerrada(p: {
  chave: string;
  userId: number;
  plano: string;
  motivo: "fim_periodo" | "estorno";
  valorCentavos?: number | null;
}) {
  return enviarUmaVez(p.chave, p.userId, p.motivo === "estorno" ? "estorno" : "assinatura_encerrada", async (u) => {
    const { sendAssinaturaEncerradaEmail } = await import("./_core/email");
    return sendAssinaturaEncerradaEmail(u.email, u.name, p);
  });
}

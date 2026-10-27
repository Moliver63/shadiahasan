/**
 * emailConta.ts — achar a conta de um e-mail sem criar duplicata.
 *
 * O Gmail ignora pontos e tudo depois do "+" no nome do endereço:
 * maria.silva@gmail.com, mariasilva@gmail.com e maria.silva+aula@googlemail.com
 * são a MESMA caixa de entrada. Antes, a compra sem conta digitada sem os
 * pontos criava uma segunda conta, e o login com Google (que devolve o
 * endereço com pontos) caía na outra: a pessoa pagava e não via a aula.
 *
 * Só o Gmail tem essa regra garantida. Outros provedores (Outlook, Yahoo,
 * domínio próprio) podem tratar pontos como letras diferentes, então lá vale
 * só maiúscula/minúscula e espaços.
 */
import { sql } from "drizzle-orm";
import { users } from "../drizzle/schema";

const DOMINIOS_GMAIL = new Set(["gmail.com", "googlemail.com"]);

export function normalizarEmailConta(email: string): string {
  return String(email || "").trim().toLowerCase();
}

/** Mesma caixa de entrada → mesma chave. */
export function chaveDoEmail(email: string): string {
  const e = normalizarEmailConta(email);
  const arroba = e.lastIndexOf("@");
  if (arroba < 1) return e;
  const local = e.slice(0, arroba);
  const dominio = e.slice(arroba + 1);
  if (!DOMINIOS_GMAIL.has(dominio)) return e;
  return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
}

type Banco = { select: (...a: any[]) => any };

/**
 * Conta do e-mail: primeiro o endereço exato (sem diferença de maiúscula);
 * se for Gmail e não houver, a conta com a mesma caixa de entrada.
 */
export async function encontrarContaPorEmail(d: Banco, email: string): Promise<{ id: number; email: string } | null> {
  const e = normalizarEmailConta(email);
  if (!e) return null;
  const [exata] = await d
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${e}`)
    .limit(1);
  if (exata) return exata;

  const dominio = e.slice(e.lastIndexOf("@") + 1);
  if (!DOMINIOS_GMAIL.has(dominio)) return null;
  const chave = chaveDoEmail(e);
  // Compara a chave do Gmail no banco; ordena pela mais antiga (a conta "original").
  const [mesmaCaixa] = await d
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`(lower(${users.email}) like '%@gmail.com' or lower(${users.email}) like '%@googlemail.com')
      and replace(split_part(split_part(lower(${users.email}), '@', 1), '+', 1), '.', '') || '@gmail.com' = ${chave}`)
    .orderBy(users.id)
    .limit(1);
  return mesmaCaixa ?? null;
}


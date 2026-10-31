/**
 * Campanhas de e-mail: público, envio em lotes e acompanhamento.
 *
 * Como o envio é seguro:
 *  - Só recebe quem está ATIVO no momento do envio (confirmado e sem cancelamento).
 *    A checagem acontece a cada lote: quem cancela no meio do envio sai da fila.
 *  - Cada destinatário é uma linha em `marketingEnvios` (campanha, contato) com chave única:
 *    nada é enviado duas vezes para a mesma pessoa, mesmo se o envio for retomado.
 *  - O envio roda em segundo plano no servidor, em lotes de 50 (a API do Resend aceita até
 *    100 por chamada e 2 chamadas por segundo). Se o servidor reiniciar no meio, a campanha
 *    fica "enviando" e o admin usa "Continuar envio": só os pendentes saem.
 *  - Falha de um lote não derruba a campanha: tenta um a um e registra o erro de cada pessoa.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";
import { enviarEmail, getResend, remetenteDoSetor } from "./_core/email";
import { cabecalhosDeCancelamento, montarEmailCampanha, urlDoBotao, type CampanhaConteudo } from "./marketingEmail";
import { garantirTabelasMarketing, linhasDe, ORIGENS, type Origem } from "./marketing";

export const TAMANHO_LOTE = 50;
const PAUSA_ENTRE_LOTES_MS = 700;
/** Linha "processando" parada há mais que isso volta para a fila ao retomar. */
const PROCESSANDO_EXPIRA_MIN = 5;

// ─── Regras puras ───────────────────────────────────────────────────────────

export type Segmento = { origens: Origem[]; semAssinatura: boolean };

export function origensDeTexto(t: string | null | undefined): Origem[] {
  return (t ?? "").split(",").map((s) => s.trim()).filter((s): s is Origem => (ORIGENS as readonly string[]).includes(s));
}
export function origensParaTexto(o: Origem[]): string {
  return Array.from(new Set(o.filter((x) => (ORIGENS as readonly string[]).includes(x)))).join(",");
}

export type ErroConteudo = string | null;

/** Confere o texto antes de salvar ou enviar. Devolve a primeira mensagem de erro. */
export function validarConteudo(c: { nome: string; assunto: string; corpo: string; botaoTexto?: string | null; botaoUrl?: string | null }): ErroConteudo {
  if (c.nome.trim().length < 3) return "Dê um nome interno à campanha (para você achar depois).";
  if (c.assunto.trim().length < 5) return "O assunto precisa ter pelo menos 5 caracteres.";
  if (c.assunto.length > 200) return "O assunto está longo demais (máximo 200 caracteres).";
  if (c.corpo.trim().length < 30) return "O texto está curto demais. Escreva pelo menos algumas frases.";
  const temTexto = !!(c.botaoTexto ?? "").trim();
  const temUrl = !!(c.botaoUrl ?? "").trim();
  if (temTexto !== temUrl) return "Para usar o botão, preencha o texto e o endereço. Para não usar, deixe os dois vazios.";
  if (temUrl && !urlDoBotao(c.botaoUrl)) return "O endereço do botão precisa começar com http:// ou https://.";
  return null;
}

// ─── Público ────────────────────────────────────────────────────────────────

/** Trecho SQL "tem assinatura": nos dois sistemas de assinatura do site. */
export const temAssinatura = sql`
  EXISTS (
    SELECT 1 FROM "users" u WHERE lower(u."email") = c."email" AND (
      EXISTS (SELECT 1 FROM "user_subscriptions" us WHERE us."userId" = u."id" AND us."status" IN ('active','trialing','past_due'))
      OR EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."userId" = u."id" AND s."plan" <> 'free' AND s."status" IN ('active','trial'))
    )
  )`;

function filtroSegmento(seg: Segmento) {
  const origens = seg.origens.length ? sql`AND c."origem" IN (${sql.join(seg.origens.map((o) => sql`${o}`), sql`, `)})` : sql``;
  const semAss = seg.semAssinatura ? sql`AND NOT ${temAssinatura}` : sql``;
  return sql`c."confirmadoEm" IS NOT NULL AND c."descadastradoEm" IS NULL ${origens} ${semAss}`;
}

export async function contarSegmento(seg: Segmento): Promise<number> {
  if (!(await garantirTabelasMarketing())) return 0;
  const d = await db.getDb();
  if (!d) return 0;
  const r = linhasDe(await d.execute(sql`SELECT COUNT(*)::int AS n FROM "marketingContatos" c WHERE ${filtroSegmento(seg)}`))[0];
  return Number(r?.n ?? 0);
}

// ─── Campanhas ──────────────────────────────────────────────────────────────

export type Campanha = {
  id: number; nome: string; assunto: string; corpo: string; botaoTexto: string | null; botaoUrl: string | null;
  origens: Origem[]; semAssinatura: boolean; status: string; criadoEm: Date; iniciadoEm: Date | null; concluidoEm: Date | null;
};

function mapear(r: any): Campanha {
  return {
    id: Number(r.id), nome: r.nome, assunto: r.assunto, corpo: r.corpo, botaoTexto: r.botaoTexto, botaoUrl: r.botaoUrl,
    origens: origensDeTexto(r.origens), semAssinatura: !!r.semAssinatura, status: r.status,
    criadoEm: new Date(r.criadoEm), iniciadoEm: r.iniciadoEm ? new Date(r.iniciadoEm) : null, concluidoEm: r.concluidoEm ? new Date(r.concluidoEm) : null,
  };
}

export async function obterCampanha(id: number): Promise<Campanha | null> {
  if (!(await garantirTabelasMarketing())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const r = linhasDe(await d.execute(sql`SELECT * FROM "marketingCampanhas" WHERE "id" = ${id}`))[0];
  return r ? mapear(r) : null;
}

export type ResumoCampanha = Campanha & { total: number; enviados: number; erros: number; pendentes: number; ignorados: number };

export async function listarCampanhas(): Promise<ResumoCampanha[]> {
  if (!(await garantirTabelasMarketing())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const linhas = linhasDe(await d.execute(sql`
    SELECT k.*,
      COUNT(e."contatoId")::int AS total,
      COUNT(*) FILTER (WHERE e."status" = 'enviado')::int AS enviados,
      COUNT(*) FILTER (WHERE e."status" = 'erro')::int AS erros,
      COUNT(*) FILTER (WHERE e."status" IN ('pendente','processando'))::int AS pendentes,
      COUNT(*) FILTER (WHERE e."status" = 'ignorado')::int AS ignorados
    FROM "marketingCampanhas" k LEFT JOIN "marketingEnvios" e ON e."campanhaId" = k."id"
    GROUP BY k."id" ORDER BY k."id" DESC LIMIT 100
  `));
  return linhas.map((r) => ({ ...mapear(r), total: Number(r.total), enviados: Number(r.enviados), erros: Number(r.erros), pendentes: Number(r.pendentes), ignorados: Number(r.ignorados) }));
}

export async function salvarCampanha(p: {
  id?: number | null; nome: string; assunto: string; corpo: string; botaoTexto?: string | null; botaoUrl?: string | null;
  origens: Origem[]; semAssinatura: boolean; criadoPor: number | null;
}): Promise<number> {
  const erro = validarConteudo(p);
  if (erro) throw new Error(erro);
  if (!(await garantirTabelasMarketing())) throw new Error("Banco indisponível.");
  const d = await db.getDb();
  if (!d) throw new Error("Banco indisponível.");
  const bt = (p.botaoTexto ?? "").trim() || null;
  const bu = (p.botaoUrl ?? "").trim() || null;
  const og = origensParaTexto(p.origens);
  if (p.id) {
    const r = linhasDe(await d.execute(sql`
      UPDATE "marketingCampanhas"
      SET "nome" = ${p.nome.trim()}, "assunto" = ${p.assunto.trim()}, "corpo" = ${p.corpo}, "botaoTexto" = ${bt}, "botaoUrl" = ${bu},
          "origens" = ${og}, "semAssinatura" = ${p.semAssinatura}
      WHERE "id" = ${p.id} AND "status" = 'rascunho' RETURNING "id"
    `));
    if (!r.length) throw new Error("Só dá para editar campanhas em rascunho.");
    return p.id;
  }
  const r = linhasDe(await d.execute(sql`
    INSERT INTO "marketingCampanhas" ("nome","assunto","corpo","botaoTexto","botaoUrl","origens","semAssinatura","criadoPor")
    VALUES (${p.nome.trim()}, ${p.assunto.trim()}, ${p.corpo}, ${bt}, ${bu}, ${og}, ${p.semAssinatura}, ${p.criadoPor}) RETURNING "id"
  `));
  return Number(r[0].id);
}

/** Exclui só rascunho (campanha enviada fica no histórico). */
export async function excluirRascunho(id: number): Promise<boolean> {
  if (!(await garantirTabelasMarketing())) return false;
  const d = await db.getDb();
  if (!d) return false;
  const r = linhasDe(await d.execute(sql`DELETE FROM "marketingCampanhas" WHERE "id" = ${id} AND "status" = 'rascunho' RETURNING "id"`));
  return r.length > 0;
}

export async function errosDaCampanha(id: number): Promise<{ email: string; erro: string }[]> {
  if (!(await garantirTabelasMarketing())) return [];
  const d = await db.getDb();
  if (!d) return [];
  return linhasDe(await d.execute(sql`SELECT "email", COALESCE("erro",'') AS erro FROM "marketingEnvios" WHERE "campanhaId" = ${id} AND "status" = 'erro' ORDER BY "email" LIMIT 50`)).map((r) => ({ email: r.email, erro: r.erro }));
}

// ─── Envio ──────────────────────────────────────────────────────────────────

export type Destinatario = { contatoId: number; email: string; nome: string | null; token: string };
export type ResultadoLote = { contatoId: number; ok: boolean; resendId?: string; erro?: string }[];
/** Quem de fato manda. Em produção é o Resend; nos testes, um falso. */
export type Remetente = (campanha: CampanhaConteudo, lote: Destinatario[]) => Promise<ResultadoLote>;

export const remetenteResend: Remetente = async (campanha, lote) => {
  const resend = getResend();
  if (!resend) return lote.map((d) => ({ contatoId: d.contatoId, ok: false, erro: "RESEND_API_KEY não configurada" }));
  const de = remetenteDoSetor("psicologa");
  const montar = (d: Destinatario) => {
    const m = montarEmailCampanha(campanha, { nome: d.nome, token: d.token });
    return { from: de, to: [d.email], subject: m.assunto, html: m.html, text: m.texto, replyTo: process.env.EMAIL_CONTATO || "contato@shadiahasan.com", headers: cabecalhosDeCancelamento(d.token) };
  };
  try {
    const { data, error } = await resend.batch.send(lote.map(montar));
    if (!error && data?.data?.length === lote.length) {
      return lote.map((d, i) => ({ contatoId: d.contatoId, ok: true, resendId: data.data[i]?.id }));
    }
    if (error) console.warn("[Marketing] lote recusado, enviando um a um:", error.message);
  } catch (e) {
    console.warn("[Marketing] lote falhou, enviando um a um:", e instanceof Error ? e.message : e);
  }
  // Uma a uma: isola o endereço problemático.
  const out: ResultadoLote = [];
  for (const d of lote) {
    const m = montar(d);
    try {
      const { data, error } = await resend.emails.send(m);
      out.push(error ? { contatoId: d.contatoId, ok: false, erro: error.message } : { contatoId: d.contatoId, ok: true, resendId: data?.id });
    } catch (e) {
      out.push({ contatoId: d.contatoId, ok: false, erro: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 550));
  }
  return out;
};

const emAndamento = new Set<number>();
export const campanhaEmAndamento = (id: number) => emAndamento.has(id);

/** Prepara a fila: congela o público no momento do envio. Devolve quantos entraram. */
async function montarFila(c: Campanha): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const r = linhasDe(await d.execute(sql`
    INSERT INTO "marketingEnvios" ("campanhaId","contatoId","email")
    SELECT ${c.id}, c."id", c."email" FROM "marketingContatos" c WHERE ${filtroSegmento({ origens: c.origens, semAssinatura: c.semAssinatura })}
    ON CONFLICT ("campanhaId","contatoId") DO NOTHING RETURNING "contatoId"
  `));
  return r.length;
}

/**
 * Inicia (ou retoma) o envio. Retorna logo; o trabalho segue em segundo plano.
 * `remetente` e `pausaMs` existem para os testes.
 */
export async function iniciarEnvio(id: number, opts: { remetente?: Remetente; pausaMs?: number; aguardar?: boolean } = {}): Promise<{ ok: boolean; erro?: string; total?: number }> {
  if (!(await garantirTabelasMarketing())) return { ok: false, erro: "Banco indisponível." };
  const d = await db.getDb();
  if (!d) return { ok: false, erro: "Banco indisponível." };
  const c = await obterCampanha(id);
  if (!c) return { ok: false, erro: "Campanha não encontrada." };
  if (c.status === "concluida" || c.status === "cancelada") return { ok: false, erro: "Esta campanha já foi encerrada." };
  const erroConteudo = validarConteudo(c);
  if (erroConteudo) return { ok: false, erro: erroConteudo };
  if (emAndamento.has(id)) return { ok: false, erro: "Esta campanha já está sendo enviada." };

  let total: number;
  if (c.status === "rascunho") {
    total = await montarFila(c);
    if (total === 0) return { ok: false, erro: "Nenhum contato ativo neste público. Nada foi enviado." };
    await d.execute(sql`UPDATE "marketingCampanhas" SET "status" = 'enviando', "iniciadoEm" = now() WHERE "id" = ${id} AND "status" = 'rascunho'`);
  } else {
    // Retomada: linhas "processando" velhas (servidor caiu no meio) voltam para a fila.
    await d.execute(sql`UPDATE "marketingEnvios" SET "status" = 'pendente' WHERE "campanhaId" = ${id} AND "status" = 'processando' AND "tentadoEm" < now() - (${PROCESSANDO_EXPIRA_MIN} * interval '1 minute')`);
    total = Number(linhasDe(await d.execute(sql`SELECT COUNT(*)::int AS n FROM "marketingEnvios" WHERE "campanhaId" = ${id}`))[0].n);
  }

  emAndamento.add(id);
  const trabalho = processarFila(id, opts.remetente ?? remetenteResend, opts.pausaMs ?? PAUSA_ENTRE_LOTES_MS)
    .catch((e) => console.error("[Marketing] envio interrompido:", e))
    .finally(() => emAndamento.delete(id));
  if (opts.aguardar) await trabalho;
  return { ok: true, total };
}

async function processarFila(id: number, remetente: Remetente, pausaMs: number) {
  const d = await db.getDb();
  if (!d) return;
  for (;;) {
    const c = await obterCampanha(id);
    if (!c || c.status !== "enviando") return; // cancelada no meio
    // Pega o próximo lote e já marca como "processando". Quem cancelou a inscrição
    // desde a montagem da fila é ignorado (nunca recebe).
    const lote = linhasDe(await d.execute(sql`
      WITH pega AS (
        SELECT e."contatoId" FROM "marketingEnvios" e WHERE e."campanhaId" = ${id} AND e."status" = 'pendente'
        ORDER BY e."contatoId" LIMIT ${TAMANHO_LOTE} FOR UPDATE SKIP LOCKED
      )
      UPDATE "marketingEnvios" e SET "status" = 'processando', "tentadoEm" = now()
      FROM pega, "marketingContatos" c WHERE e."campanhaId" = ${id} AND e."contatoId" = pega."contatoId" AND c."id" = e."contatoId"
      RETURNING e."contatoId", c."email", c."nome", c."token", (c."confirmadoEm" IS NOT NULL AND c."descadastradoEm" IS NULL) AS ativo
    `));
    if (!lote.length) {
      await d.execute(sql`UPDATE "marketingCampanhas" SET "status" = 'concluida', "concluidoEm" = now() WHERE "id" = ${id} AND "status" = 'enviando'`);
      return;
    }
    const ignorados = lote.filter((l) => !l.ativo).map((l) => Number(l.contatoId));
    if (ignorados.length) {
      await d.execute(sql`UPDATE "marketingEnvios" SET "status" = 'ignorado', "erro" = 'Cancelou a inscrição antes do envio' WHERE "campanhaId" = ${id} AND "contatoId" IN (${sql.join(ignorados.map((x) => sql`${x}`), sql`, `)})`);
    }
    const destinos: Destinatario[] = lote.filter((l) => l.ativo).map((l) => ({ contatoId: Number(l.contatoId), email: l.email, nome: l.nome, token: l.token }));
    if (destinos.length) {
      let resultados: ResultadoLote;
      try {
        resultados = await remetente({ assunto: c.assunto, corpo: c.corpo, botaoTexto: c.botaoTexto, botaoUrl: c.botaoUrl }, destinos);
      } catch (e) {
        resultados = destinos.map((x) => ({ contatoId: x.contatoId, ok: false, erro: e instanceof Error ? e.message : String(e) }));
      }
      for (const r of resultados) {
        await d.execute(sql`
          UPDATE "marketingEnvios" SET "status" = ${r.ok ? "enviado" : "erro"}, "resendId" = ${r.resendId ?? null}, "erro" = ${r.ok ? null : (r.erro ?? "falha").slice(0, 500)},
            "enviadoEm" = ${r.ok ? sql`now()` : sql`NULL`}
          WHERE "campanhaId" = ${id} AND "contatoId" = ${r.contatoId}
        `);
      }
    }
    await new Promise((res) => setTimeout(res, pausaMs));
  }
}

/** Devolve à fila quem deu erro (queda de rede, por exemplo) e retoma o envio. Quem cancelou nesse meio tempo continua de fora. */
export async function reenviarErros(id: number, opts: { remetente?: Remetente; pausaMs?: number; aguardar?: boolean } = {}): Promise<{ ok: boolean; erro?: string; total?: number }> {
  if (!(await garantirTabelasMarketing())) return { ok: false, erro: "Banco indisponível." };
  const d = await db.getDb();
  if (!d) return { ok: false, erro: "Banco indisponível." };
  const c = await obterCampanha(id);
  if (!c || (c.status !== "concluida" && c.status !== "enviando")) return { ok: false, erro: "Só dá para reenviar erros de uma campanha já enviada." };
  if (emAndamento.has(id)) return { ok: false, erro: "Esta campanha já está sendo enviada." };
  const n = linhasDe(await d.execute(sql`UPDATE "marketingEnvios" SET "status" = 'pendente', "erro" = NULL WHERE "campanhaId" = ${id} AND "status" = 'erro' RETURNING "contatoId"`)).length;
  if (n === 0) return { ok: false, erro: "Não há envios com erro nesta campanha." };
  await d.execute(sql`UPDATE "marketingCampanhas" SET "status" = 'enviando', "concluidoEm" = NULL WHERE "id" = ${id}`);
  const r = await iniciarEnvio(id, opts);
  return r.ok ? { ok: true, total: n } : r;
}

/** Interrompe a campanha: o que ainda não saiu não sai. */
export async function cancelarCampanha(id: number): Promise<boolean> {
  if (!(await garantirTabelasMarketing())) return false;
  const d = await db.getDb();
  if (!d) return false;
  const r = linhasDe(await d.execute(sql`UPDATE "marketingCampanhas" SET "status" = 'cancelada', "concluidoEm" = now() WHERE "id" = ${id} AND "status" = 'enviando' RETURNING "id"`));
  return r.length > 0;
}

/** Envia UMA mensagem de teste para o admin (não grava nada, não conta no envio). */
export async function enviarTeste(c: CampanhaConteudo, para: string): Promise<{ ok: boolean; erro?: string }> {
  const erro = validarConteudo({ nome: "teste", ...c });
  if (erro) return { ok: false, erro };
  const m = montarEmailCampanha({ ...c, assunto: `[TESTE] ${c.assunto}` }, { nome: null, token: "teste".padEnd(32, "0") });
  const r = await enviarEmail({ para, assunto: m.assunto, html: m.html, texto: m.texto, departamento: "psicologa" });
  return r.success ? { ok: true } : { ok: false, erro: r.error ?? "Falha ao enviar" };
}

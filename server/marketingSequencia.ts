/**
 * Sequência automática de e-mails (boas-vindas).
 *
 * Quem confirma a inscrição entra na sequência sozinho. Cada e-mail ("passo") tem um
 * intervalo em dias contado a partir do e-mail anterior (o primeiro, a partir da confirmação).
 *
 * Regras de segurança:
 *  - Só entra na sequência quem confirmou DEPOIS de ela ter sido ativada pela primeira vez.
 *    Ativar nunca dispara e-mail para a lista que já existia.
 *  - Só envia entre 8h e 20h (Brasília); fora disso espera a manhã.
 *  - Cancelou a inscrição, sai da sequência na hora (a consulta só considera ativos).
 *  - Cada pessoa recebe cada passo no máximo uma vez (chave contato+passo na tabela).
 *  - Passo marcado "não enviar a quem já assina" é pulado (e a sequência segue).
 *  - Erro de envio é tentado de novo depois de 1 hora, até 3 vezes; depois disso a sequência
 *    daquela pessoa para (provável endereço inexistente).
 *  - Servidor reiniciado no meio: linha "processando" parada há 10 min volta a ser tentada.
 *  - A sequência nasce com 3 rascunhos escritos para a Shadia revisar e fica PAUSADA até ela ativar.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";
import { garantirTabelasMarketing, linhasDe } from "./marketing";
import { remetenteResend, temAssinatura, validarConteudo, type Destinatario, type Remetente, type ResultadoLote } from "./marketingEnvio";

export const MAX_PASSOS = 8;
export const MAX_DIAS = 60;
export const TENTATIVAS_MAX = 3;
export const JANELA_INICIO_H = 8;
export const JANELA_FIM_H = 20;
const LIMITE_POR_RODADA = 150;

// ─── Regras puras ───────────────────────────────────────────────────────────

export type PassoEntrada = {
  id?: number | null;
  diasDepois: number;
  assunto: string;
  corpo: string;
  botaoTexto?: string | null;
  botaoUrl?: string | null;
  pularSeAssina: boolean;
};

/** Hora de Brasília (0 a 23) de um instante. */
export function horaEmBrasilia(agora: Date): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(agora);
  return Number(h) % 24;
}

/** Pode enviar agora? Das 8h às 19h59, horário de Brasília. */
export function dentroDaJanelaDeEnvio(agora: Date): boolean {
  const h = horaEmBrasilia(agora);
  return h >= JANELA_INICIO_H && h < JANELA_FIM_H;
}

/** Confere a lista de passos antes de salvar. Devolve a primeira mensagem de erro. */
export function validarPassos(passos: PassoEntrada[]): string | null {
  if (passos.length < 1) return "A sequência precisa de pelo menos um e-mail.";
  if (passos.length > MAX_PASSOS) return `No máximo ${MAX_PASSOS} e-mails na sequência.`;
  for (let i = 0; i < passos.length; i++) {
    const p = passos[i];
    if (!Number.isInteger(p.diasDepois) || p.diasDepois < 0 || p.diasDepois > MAX_DIAS) return `E-mail ${i + 1}: o intervalo deve ser de 0 a ${MAX_DIAS} dias.`;
    const erro = validarConteudo({ nome: "sequencia", assunto: p.assunto, corpo: p.corpo, botaoTexto: p.botaoTexto, botaoUrl: p.botaoUrl });
    if (erro) return `E-mail ${i + 1}: ${erro}`;
  }
  return null;
}

/** Texto para a tela: quando cada e-mail sai. */
export function descreverIntervalo(ordem: number, dias: number): string {
  if (ordem === 1) return dias === 0 ? "Na hora em que a pessoa confirma a inscrição" : `${dias} ${dias === 1 ? "dia" : "dias"} depois da confirmação`;
  return dias === 0 ? "No mesmo dia do e-mail anterior" : `${dias} ${dias === 1 ? "dia" : "dias"} depois do e-mail anterior`;
}

// ─── Rascunhos iniciais (a Shadia revisa antes de ativar) ───────────────────

export const PASSOS_INICIAIS: PassoEntrada[] = [
  {
    diasDepois: 0,
    assunto: "Que bom ter você por aqui",
    corpo:
      "Sua inscrição está confirmada. Obrigada por querer acompanhar meu trabalho.\n\nDe tempos em tempos eu escrevo por aqui sobre maturidade emocional e sobre os programas da plataforma. Quando houver novidade ou condição especial, você fica sabendo primeiro.\n\nSe quiser ver o que já existe, o caminho mais curto é pelos programas.",
    botaoTexto: "Conhecer os programas",
    botaoUrl: "https://shadiahasan.com/courses",
    pularSeAssina: false,
  },
  {
    diasDepois: 3,
    assunto: "Uma forma de começar sem se comprometer",
    corpo:
      "Muita gente me pergunta por onde começar. Se você ainda não conhece meu trabalho, dá para assistir a uma aula avulsa antes de decidir por qualquer plano.\n\nÉ um jeito de sentir se o formato combina com você, no seu ritmo e sem assinatura.",
    botaoTexto: "Ver as aulas",
    botaoUrl: "https://shadiahasan.com/courses",
    pularSeAssina: true,
  },
  {
    diasDepois: 4,
    assunto: "Qual plano combina com você",
    corpo:
      "Se você já sabe que quer ir mais fundo, os planos têm níveis diferentes de acesso, e você escolhe o que cabe na sua rotina.\n\nHá garantia de 7 dias, conforme a política do site, e você pode cancelar quando quiser.\n\nQualquer dúvida, é só responder este e-mail que eu leio.",
    botaoTexto: "Ver os planos",
    botaoUrl: "https://shadiahasan.com/pricing",
    pularSeAssina: true,
  },
];

// ─── Tabelas ────────────────────────────────────────────────────────────────

let tabelasProntas: Promise<boolean> | null = null;

export function garantirTabelasSequencia(): Promise<boolean> {
  if (!tabelasProntas) {
    tabelasProntas = (async () => {
      try {
        // A sequência consulta os contatos: a tabela deles precisa existir mesmo sem nenhuma inscrição ainda.
        if (!(await garantirTabelasMarketing())) return false;
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "marketingSequencias" (
            "id" serial PRIMARY KEY,
            "nome" varchar(120) NOT NULL,
            "ativa" boolean NOT NULL DEFAULT false,
            "ativadaEm" timestamptz,
            "criadoEm" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "marketingSequenciaPassos" (
            "id" serial PRIMARY KEY,
            "sequenciaId" integer NOT NULL,
            "ordem" integer NOT NULL,
            "diasDepois" integer NOT NULL DEFAULT 0,
            "assunto" varchar(200) NOT NULL,
            "corpo" text NOT NULL,
            "botaoTexto" varchar(60),
            "botaoUrl" varchar(500),
            "pularSeAssina" boolean NOT NULL DEFAULT false
          )
        `);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "marketingSequenciaEnvios" (
            "contatoId" integer NOT NULL,
            "passoId" integer NOT NULL,
            "status" varchar(20) NOT NULL,
            "tentativas" integer NOT NULL DEFAULT 0,
            "resendId" varchar(100),
            "erro" text,
            "tentadoEm" timestamptz,
            "enviadoEm" timestamptz,
            PRIMARY KEY ("contatoId", "passoId")
          )
        `);
        // Primeira vez: cria a sequência pausada com os rascunhos. Nunca recria se já existe.
        const existe = linhasDe(await d.execute(sql`SELECT "id" FROM "marketingSequencias" LIMIT 1`));
        if (!existe.length) {
          const s = linhasDe(await d.execute(sql`INSERT INTO "marketingSequencias" ("nome") VALUES ('Boas-vindas') RETURNING "id"`))[0];
          let ordem = 1;
          for (const p of PASSOS_INICIAIS) {
            await d.execute(sql`
              INSERT INTO "marketingSequenciaPassos" ("sequenciaId","ordem","diasDepois","assunto","corpo","botaoTexto","botaoUrl","pularSeAssina")
              VALUES (${s.id}, ${ordem++}, ${p.diasDepois}, ${p.assunto}, ${p.corpo}, ${p.botaoTexto ?? null}, ${p.botaoUrl ?? null}, ${p.pularSeAssina})
            `);
          }
        }
        return true;
      } catch (e) {
        console.warn("[Sequência] tabelas indisponíveis:", e instanceof Error ? e.message : e);
        tabelasProntas = null;
        return false;
      }
    })();
  }
  return tabelasProntas;
}

// ─── Leitura e edição ───────────────────────────────────────────────────────

export type Passo = PassoEntrada & { id: number; ordem: number; botaoTexto: string | null; botaoUrl: string | null };
export type Sequencia = { id: number; nome: string; ativa: boolean; ativadaEm: Date | null; passos: Passo[] };
export type EstatisticaPasso = { passoId: number; enviados: number; erros: number; ignorados: number };

export async function obterSequencia(): Promise<Sequencia | null> {
  if (!(await garantirTabelasSequencia())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const s = linhasDe(await d.execute(sql`SELECT * FROM "marketingSequencias" ORDER BY "id" LIMIT 1`))[0];
  if (!s) return null;
  const passos = linhasDe(await d.execute(sql`SELECT * FROM "marketingSequenciaPassos" WHERE "sequenciaId" = ${s.id} ORDER BY "ordem"`));
  return {
    id: Number(s.id), nome: s.nome, ativa: !!s.ativa, ativadaEm: s.ativadaEm ? new Date(s.ativadaEm) : null,
    passos: passos.map((p) => ({
      id: Number(p.id), ordem: Number(p.ordem), diasDepois: Number(p.diasDepois), assunto: p.assunto, corpo: p.corpo,
      botaoTexto: p.botaoTexto, botaoUrl: p.botaoUrl, pularSeAssina: !!p.pularSeAssina,
    })),
  };
}

export async function estatisticasSequencia(): Promise<{ passos: EstatisticaPasso[]; naSequencia: number }> {
  const vazio = { passos: [], naSequencia: 0 };
  const seq = await obterSequencia();
  const d = await db.getDb();
  if (!seq || !d) return vazio;
  const linhas = linhasDe(await d.execute(sql`
    SELECT e."passoId",
      COUNT(*) FILTER (WHERE e."status" = 'enviado')::int AS enviados,
      COUNT(*) FILTER (WHERE e."status" IN ('erro','falhou'))::int AS erros,
      COUNT(*) FILTER (WHERE e."status" = 'ignorado')::int AS ignorados
    FROM "marketingSequenciaEnvios" e JOIN "marketingSequenciaPassos" p ON p."id" = e."passoId" WHERE p."sequenciaId" = ${seq.id} GROUP BY e."passoId"
  `));
  const mapa = new Map(linhas.map((l) => [Number(l.passoId), l]));
  const passos = seq.passos.map((p) => {
    const l = mapa.get(p.id);
    return { passoId: p.id, enviados: Number(l?.enviados ?? 0), erros: Number(l?.erros ?? 0), ignorados: Number(l?.ignorados ?? 0) };
  });
  let naSequencia = 0;
  if (seq.ativadaEm) {
    naSequencia = Number(linhasDe(await d.execute(sql`
      SELECT COUNT(*)::int AS n FROM "marketingContatos" c
      WHERE c."confirmadoEm" IS NOT NULL AND c."descadastradoEm" IS NULL AND c."confirmadoEm" >= ${seq.ativadaEm.toISOString()}::timestamptz
    `))[0].n);
  }
  return { passos, naSequencia };
}

/**
 * Salva a lista completa de passos. Passo existente (com id) é atualizado; sem id, é criado;
 * passo que sumiu da lista é removido, mas só se ninguém recebeu (histórico não se apaga).
 */
export async function salvarPassos(passos: PassoEntrada[]): Promise<void> {
  const erro = validarPassos(passos);
  if (erro) throw new Error(erro);
  const seq = await obterSequencia();
  const d = await db.getDb();
  if (!seq || !d) throw new Error("Banco indisponível.");
  const idsMantidos = new Set(passos.filter((p) => p.id).map((p) => Number(p.id)));
  for (const p of passos) if (p.id && !seq.passos.some((x) => x.id === p.id)) throw new Error("E-mail da sequência não encontrado. Recarregue a página.");
  const removidos = seq.passos.filter((p) => !idsMantidos.has(p.id));

  await d.transaction(async (tx) => {
    for (const r of removidos) {
      const usado = linhasDe(await tx.execute(sql`SELECT 1 FROM "marketingSequenciaEnvios" WHERE "passoId" = ${r.id} LIMIT 1`));
      if (usado.length) throw new Error(`O e-mail "${r.assunto}" já foi enviado para alguém e não pode ser apagado. Edite o texto no lugar dele.`);
      await tx.execute(sql`DELETE FROM "marketingSequenciaPassos" WHERE "id" = ${r.id}`);
    }
    let ordem = 1;
    for (const p of passos) {
      const bt = (p.botaoTexto ?? "").trim() || null;
      const bu = (p.botaoUrl ?? "").trim() || null;
      if (p.id) {
        await tx.execute(sql`
          UPDATE "marketingSequenciaPassos"
          SET "ordem" = ${ordem}, "diasDepois" = ${p.diasDepois}, "assunto" = ${p.assunto.trim()}, "corpo" = ${p.corpo}, "botaoTexto" = ${bt}, "botaoUrl" = ${bu}, "pularSeAssina" = ${p.pularSeAssina}
          WHERE "id" = ${p.id}
        `);
      } else {
        await tx.execute(sql`
          INSERT INTO "marketingSequenciaPassos" ("sequenciaId","ordem","diasDepois","assunto","corpo","botaoTexto","botaoUrl","pularSeAssina")
          VALUES (${seq.id}, ${ordem}, ${p.diasDepois}, ${p.assunto.trim()}, ${p.corpo}, ${bt}, ${bu}, ${p.pularSeAssina})
        `);
      }
      ordem++;
    }
  });
}

/** Ativa ou pausa. A data da PRIMEIRA ativação é guardada: só confirma depois dela entra. */
export async function definirAtiva(ativa: boolean): Promise<void> {
  const seq = await obterSequencia();
  const d = await db.getDb();
  if (!seq || !d) throw new Error("Banco indisponível.");
  if (ativa) {
    const erro = validarPassos(seq.passos);
    if (erro) throw new Error(erro);
  }
  await d.execute(sql`UPDATE "marketingSequencias" SET "ativa" = ${ativa}, "ativadaEm" = CASE WHEN ${ativa} THEN COALESCE("ativadaEm", now()) ELSE "ativadaEm" END WHERE "id" = ${seq.id}`);
}

// ─── Envio ──────────────────────────────────────────────────────────────────

export type ResultadoRodada = { enviados: number; erros: number; ignorados: number; foraDaJanela?: boolean };

/**
 * Uma rodada: acha quem está com algum e-mail da sequência vencido e envia.
 * `agora`, `remetente` e `ignorarJanela` existem para os testes.
 */
export async function processarSequencia(opts: { agora?: Date; remetente?: Remetente; ignorarJanela?: boolean; limite?: number } = {}): Promise<ResultadoRodada> {
  const res: ResultadoRodada = { enviados: 0, erros: 0, ignorados: 0 };
  const agora = opts.agora ?? new Date();
  if (!opts.ignorarJanela && !dentroDaJanelaDeEnvio(agora)) return { ...res, foraDaJanela: true };
  if (!(await garantirTabelasSequencia())) return res;
  const d = await db.getDb();
  if (!d) return res;
  const t = agora.toISOString();

  const vencidos = linhasDe(await d.execute(sql`
    SELECT c."id" AS "contatoId", c."email", c."nome", c."token", p."id" AS "passoId", p."assunto", p."corpo", p."botaoTexto", p."botaoUrl",
           (p."pularSeAssina" AND ${temAssinatura}) AS "assina"
    FROM "marketingSequencias" s
    JOIN "marketingSequenciaPassos" p ON p."sequenciaId" = s."id"
    JOIN "marketingContatos" c ON c."confirmadoEm" IS NOT NULL AND c."descadastradoEm" IS NULL AND c."confirmadoEm" >= s."ativadaEm"
    LEFT JOIN "marketingSequenciaPassos" pv ON pv."sequenciaId" = s."id" AND pv."ordem" = p."ordem" - 1
    LEFT JOIN "marketingSequenciaEnvios" pe ON pe."contatoId" = c."id" AND pe."passoId" = pv."id" AND pe."status" IN ('enviado','ignorado')
    WHERE s."ativa" AND s."ativadaEm" IS NOT NULL
      AND (pv."id" IS NULL OR pe."passoId" IS NOT NULL)
      AND COALESCE(pe."enviadoEm", c."confirmadoEm") + p."diasDepois" * interval '1 day' <= ${t}::timestamptz
      AND NOT EXISTS (
        SELECT 1 FROM "marketingSequenciaEnvios" e
        WHERE e."contatoId" = c."id" AND e."passoId" = p."id" AND (
          e."status" IN ('enviado','ignorado','falhou')
          OR (e."status" = 'erro' AND e."tentadoEm" > ${t}::timestamptz - interval '1 hour')
          OR (e."status" = 'processando' AND e."tentadoEm" > ${t}::timestamptz - interval '10 minutes')
        )
      )
    ORDER BY c."id", p."ordem" LIMIT ${opts.limite ?? LIMITE_POR_RODADA}
  `));
  if (!vencidos.length) return res;

  // Reserva cada envio (só quem conseguir a reserva envia: duas rodadas ao mesmo tempo não duplicam).
  type Reservado = Destinatario & { passoId: number; tentativas: number; assunto: string; corpo: string; botaoTexto: string | null; botaoUrl: string | null };
  const porPasso = new Map<number, Reservado[]>();
  for (const v of vencidos) {
    const r = linhasDe(await d.execute(sql`
      INSERT INTO "marketingSequenciaEnvios" ("contatoId","passoId","status","tentativas","tentadoEm")
      VALUES (${v.contatoId}, ${v.passoId}, ${v.assina ? "ignorado" : "processando"}, 1, ${t}::timestamptz)
      ON CONFLICT ("contatoId","passoId") DO UPDATE
        SET "status" = ${v.assina ? "ignorado" : "processando"}, "tentativas" = "marketingSequenciaEnvios"."tentativas" + 1, "tentadoEm" = ${t}::timestamptz
        WHERE ("marketingSequenciaEnvios"."status" = 'erro' AND "marketingSequenciaEnvios"."tentadoEm" <= ${t}::timestamptz - interval '1 hour')
           OR ("marketingSequenciaEnvios"."status" = 'processando' AND "marketingSequenciaEnvios"."tentadoEm" <= ${t}::timestamptz - interval '10 minutes')
      RETURNING "tentativas"
    `));
    if (!r.length) continue;
    if (v.assina) {
      await d.execute(sql`UPDATE "marketingSequenciaEnvios" SET "enviadoEm" = ${t}::timestamptz, "erro" = 'Já assina um plano' WHERE "contatoId" = ${v.contatoId} AND "passoId" = ${v.passoId}`);
      res.ignorados++;
      continue;
    }
    const lista = porPasso.get(Number(v.passoId)) ?? [];
    lista.push({ contatoId: Number(v.contatoId), email: v.email, nome: v.nome, token: v.token, passoId: Number(v.passoId), tentativas: Number(r[0].tentativas), assunto: v.assunto, corpo: v.corpo, botaoTexto: v.botaoTexto, botaoUrl: v.botaoUrl });
    porPasso.set(Number(v.passoId), lista);
  }

  const remetente = opts.remetente ?? remetenteResend;
  for (const [passoId, lista] of Array.from(porPasso.entries())) {
    const modelo = lista[0];
    for (let i = 0; i < lista.length; i += 50) {
      const lote = lista.slice(i, i + 50);
      let resultados: ResultadoLote;
      try {
        resultados = await remetente({ assunto: modelo.assunto, corpo: modelo.corpo, botaoTexto: modelo.botaoTexto, botaoUrl: modelo.botaoUrl }, lote);
      } catch (e) {
        resultados = lote.map((x) => ({ contatoId: x.contatoId, ok: false, erro: e instanceof Error ? e.message : String(e) }));
      }
      for (const r of resultados) {
        const item = lote.find((x) => x.contatoId === r.contatoId);
        if (r.ok) {
          await d.execute(sql`UPDATE "marketingSequenciaEnvios" SET "status" = 'enviado', "resendId" = ${r.resendId ?? null}, "erro" = NULL, "enviadoEm" = ${t}::timestamptz WHERE "contatoId" = ${r.contatoId} AND "passoId" = ${passoId}`);
          res.enviados++;
        } else {
          const status = (item?.tentativas ?? 1) >= TENTATIVAS_MAX ? "falhou" : "erro";
          await d.execute(sql`UPDATE "marketingSequenciaEnvios" SET "status" = ${status}, "erro" = ${(r.erro ?? "falha").slice(0, 500)} WHERE "contatoId" = ${r.contatoId} AND "passoId" = ${passoId}`);
          res.erros++;
        }
      }
      if (i + 50 < lista.length) await new Promise((r) => setTimeout(r, 700));
    }
  }
  return res;
}

let agendadorLigado = false;

/** Roda a cada 5 minutos. Chamado uma vez na subida do servidor. */
export function iniciarAgendadorSequencia() {
  if (agendadorLigado) return;
  agendadorLigado = true;
  let rodando = false;
  const rodar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await processarSequencia();
      if (r.enviados || r.erros || r.ignorados) console.log(`[Sequência] enviados=${r.enviados} erros=${r.erros} pulados=${r.ignorados}`);
    } catch (e) {
      console.warn("[Sequência] rodada falhou:", e instanceof Error ? e.message : e);
    } finally {
      rodando = false;
    }
  };
  setTimeout(() => {
    void rodar();
    setInterval(() => void rodar(), 5 * 60_000).unref();
  }, 90_000).unref();
}

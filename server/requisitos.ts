/**
 * Requisitos do certificado (decisão do Michel, 31/10/2026):
 *   1. assistir a aula (80% do tempo, medido no servidor: server/assistido.ts);
 *   2. responder pelo menos 3 perguntas ou exercícios sobre a aula (esta tela);
 *   3. fazer o depoimento (um por curso, vale para todas as aulas do curso), DEPOIS das respostas.
 * Só com os três o certificado da aula é liberado; o geral do Programa exige todas as aulas dele.
 *
 * As perguntas são escritas pela Shadia em /admin/perguntas. "Exercícios" são os
 * `lessonExercises` publicados da aula (respostas em `exerciseResponses`) e contam como respostas.
 * Aula com menos de 3 perguntas/exercícios publicados ainda não pode gerar certificado.
 */
import { eq, sql } from "drizzle-orm";
import * as db from "./db";
import { aulasAssistidas } from "./assistido";
import { lessons, testimonials } from "../drizzle/schema";

export const MIN_RESPOSTAS = 3;
export const MIN_CARACTERES = 30;

// ─── Regras puras ───────────────────────────────────────────────────────────

/** Resposta de verdade: tamanho mínimo, algumas palavras diferentes (barra "aaaa aaaa aaaa"). */
export function respostaValida(texto: string | null | undefined): boolean {
  const t = (texto || "").replace(/\s+/g, " ").trim();
  if (t.length < MIN_CARACTERES) return false;
  const palavras = t.toLowerCase().split(" ").filter((w) => w.length > 0);
  return palavras.length >= 4 && new Set(palavras).size >= 3;
}

export type Passos = {
  assistida: boolean;
  /** Perguntas + exercícios publicados da aula. */
  disponiveis: number;
  respondidas: number;
  /** A aula tem o mínimo de perguntas publicadas para poder liberar certificado. */
  perguntasProntas: boolean;
  perguntasOk: boolean;
  depoimento: boolean;
  liberado: boolean;
  /** Próximo passo pendente, para a tela. */
  proximo: "assistir" | "perguntas" | "depoimento" | "liberado";
};

export function calcularPassos(p: { assistida: boolean; disponiveis: number; respondidas: number; depoimento: boolean }): Passos {
  const perguntasProntas = p.disponiveis >= MIN_RESPOSTAS;
  const perguntasOk = perguntasProntas && p.respondidas >= MIN_RESPOSTAS;
  const liberado = p.assistida && perguntasOk && p.depoimento;
  const proximo = !p.assistida ? "assistir" : !perguntasOk ? "perguntas" : !p.depoimento ? "depoimento" : "liberado";
  return { assistida: p.assistida, disponiveis: p.disponiveis, respondidas: p.respondidas, perguntasProntas, perguntasOk, depoimento: p.depoimento, liberado, proximo };
}

// ─── Tabelas ────────────────────────────────────────────────────────────────

let tabelasProntas: Promise<boolean> | null = null;

const linhasDe = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

export function garantirTabelasPerguntas(): Promise<boolean> {
  if (!tabelasProntas) {
    tabelasProntas = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        const jaExistia = Boolean(linhasDe(await d.execute(sql`SELECT to_regclass('"aulaPerguntas"') AS t`))[0]?.t);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "aulaPerguntas" (
            "id" serial PRIMARY KEY,
            "lessonId" integer NOT NULL,
            "ordem" integer NOT NULL DEFAULT 0,
            "texto" varchar(500) NOT NULL,
            "publicada" integer NOT NULL DEFAULT 0,
            "criadoEm" timestamptz NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "aulaPerguntas_lesson_idx" ON "aulaPerguntas" ("lessonId")`);
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "aulaRespostas" (
            "userId" integer NOT NULL,
            "perguntaId" integer NOT NULL,
            "lessonId" integer NOT NULL,
            "texto" text NOT NULL,
            "respondidoEm" timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY ("userId", "perguntaId")
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "aulaRespostas_user_lesson_idx" ON "aulaRespostas" ("userId", "lessonId")`);
        // Primeira criação: deixa 3 rascunhos (NÃO publicados) por aula publicada, para a Shadia revisar e publicar
        if (!jaExistia) await criarRascunhos();
        return true;
      } catch (e) {
        console.warn("[Requisitos] tabelas indisponíveis:", e instanceof Error ? e.message : e);
        tabelasProntas = null;
        return false;
      }
    })();
  }
  return tabelasProntas;
}

/** Modelos de rascunho: genéricos de propósito. A Shadia ajusta ao conteúdo de cada aula antes de publicar. */
const MODELOS = [
  (t: string) => `Com suas palavras: qual foi a ideia mais importante da aula "${t}" e por que ela chamou a sua atenção?`,
  () => "Em que situação da sua vida você reconhece o que foi trabalhado nesta aula? Conte um exemplo real.",
  () => "O que você vai fazer de diferente, a partir de hoje, com o que aprendeu? Seja específico(a).",
];

/** Cria rascunhos para as aulas publicadas que ainda não têm nenhuma pergunta (ou só para `lessonId`). */
export async function criarRascunhos(lessonId?: number): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const alvo = lessonId ? sql`AND l."id" = ${lessonId}` : sql``;
  const aulas = linhasDe(await d.execute(sql`
    SELECT l."id", l."title" FROM "lessons" l
    WHERE l."isPublished" = 1 ${alvo}
      AND NOT EXISTS (SELECT 1 FROM "aulaPerguntas" p WHERE p."lessonId" = l."id")
  `));
  let n = 0;
  for (const a of aulas) {
    for (let i = 0; i < MODELOS.length; i++) {
      await d.execute(sql`INSERT INTO "aulaPerguntas" ("lessonId", "ordem", "texto", "publicada") VALUES (${Number(a.id)}, ${i + 1}, ${MODELOS[i](String(a.title)).slice(0, 500)}, 0)`);
      n++;
    }
  }
  return n;
}

// ─── Leitura para o aluno ───────────────────────────────────────────────────

export type PerguntaDoAluno = { id: number; texto: string; resposta: string | null };

export async function perguntasDaAula(userId: number, lessonId: number): Promise<PerguntaDoAluno[]> {
  if (!(await garantirTabelasPerguntas())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const r = await d.execute(sql`
    SELECT p."id", p."texto", r."texto" AS "resposta"
    FROM "aulaPerguntas" p
    LEFT JOIN "aulaRespostas" r ON r."perguntaId" = p."id" AND r."userId" = ${userId}
    WHERE p."lessonId" = ${lessonId} AND p."publicada" = 1
    ORDER BY p."ordem", p."id"
  `);
  return linhasDe(r).map((l) => ({ id: Number(l.id), texto: String(l.texto), resposta: l.resposta ?? null }));
}

/** Perguntas (publicadas) e exercícios (publicados) da aula, e quantos o aluno já respondeu. */
async function contagens(userId: number, lessonIds: number[]): Promise<Map<number, { disponiveis: number; respondidas: number }>> {
  const mapa = new Map<number, { disponiveis: number; respondidas: number }>();
  if (!lessonIds.length || !(await garantirTabelasPerguntas())) return mapa;
  const d = await db.getDb();
  if (!d) return mapa;
  const lista = sql.join(lessonIds.map((i) => sql`${i}`), sql`, `);
  const soma = (id: number, campo: "disponiveis" | "respondidas", n: number) => {
    const c = mapa.get(id) ?? { disponiveis: 0, respondidas: 0 };
    c[campo] += n;
    mapa.set(id, c);
  };
  for (const l of linhasDe(await d.execute(sql`SELECT "lessonId", count(*) AS n FROM "aulaPerguntas" WHERE "publicada" = 1 AND "lessonId" IN (${lista}) GROUP BY "lessonId"`))) soma(Number(l.lessonId), "disponiveis", Number(l.n));
  for (const l of linhasDe(await d.execute(sql`
    SELECT p."lessonId", count(*) AS n FROM "aulaRespostas" r JOIN "aulaPerguntas" p ON p."id" = r."perguntaId" AND p."publicada" = 1
    WHERE r."userId" = ${userId} AND p."lessonId" IN (${lista}) GROUP BY p."lessonId"`))) soma(Number(l.lessonId), "respondidas", Number(l.n));
  try {
    for (const l of linhasDe(await d.execute(sql`SELECT "lessonId", count(*) AS n FROM "lessonExercises" WHERE "isPublished" = 1 AND "lessonId" IN (${lista}) GROUP BY "lessonId"`))) soma(Number(l.lessonId), "disponiveis", Number(l.n));
    for (const l of linhasDe(await d.execute(sql`
      SELECT e."lessonId", count(DISTINCT e."id") AS n FROM "exerciseResponses" r JOIN "lessonExercises" e ON e."id" = r."exerciseId" AND e."isPublished" = 1
      WHERE r."userId" = ${userId} AND e."lessonId" IN (${lista}) GROUP BY e."lessonId"`))) soma(Number(l.lessonId), "respondidas", Number(l.n));
  } catch { /* tabelas de exercícios ausentes: só contam as perguntas */ }
  return mapa;
}

/** Cursos em que o aluno já fez o depoimento (qualquer status: enviado conta, moderação é outro assunto). */
async function cursosComDepoimento(userId: number): Promise<Set<number>> {
  const d = await db.getDb();
  if (!d) return new Set();
  const rows = await d.select({ courseId: testimonials.courseId }).from(testimonials).where(eq(testimonials.userId, userId));
  return new Set(rows.map((r) => r.courseId));
}

/** Passos de uma aula para o aluno (tela da aula). */
export async function passosDaAula(userId: number, lessonId: number, assistida: boolean): Promise<Passos & { courseId: number | null }> {
  const d = await db.getDb();
  const [aula] = d ? await d.select({ courseId: lessons.courseId }).from(lessons).where(eq(lessons.id, lessonId)).limit(1) : [];
  const c = (await contagens(userId, [lessonId])).get(lessonId) ?? { disponiveis: 0, respondidas: 0 };
  const dep = aula ? (await cursosComDepoimento(userId)).has(aula.courseId) : false;
  return { ...calcularPassos({ assistida, disponiveis: c.disponiveis, respondidas: c.respondidas, depoimento: dep }), courseId: aula?.courseId ?? null };
}

/**
 * Aulas com os TRÊS requisitos cumpridos (assistida + perguntas + depoimento do curso).
 * É isto, e só isto, que libera certificado. Falha de banco: conjunto vazio.
 */
export async function aulasLiberadas(userId: number): Promise<Set<number>> {
  const liberadas = new Set<number>();
  try {
    const assistidas = Array.from(await aulasAssistidas(userId));
    if (!assistidas.length) return liberadas;
    const d = await db.getDb();
    if (!d) return liberadas;
    const [cont, cursos, aulas] = await Promise.all([
      contagens(userId, assistidas),
      cursosComDepoimento(userId),
      d.select({ id: lessons.id, courseId: lessons.courseId }).from(lessons),
    ]);
    const cursoDe = new Map(aulas.map((a) => [a.id, a.courseId]));
    for (const id of assistidas) {
      const c = cont.get(id) ?? { disponiveis: 0, respondidas: 0 };
      const curso = cursoDe.get(id);
      const p = calcularPassos({ assistida: true, disponiveis: c.disponiveis, respondidas: c.respondidas, depoimento: curso != null && cursos.has(curso) });
      if (p.liberado) liberadas.add(id);
    }
  } catch (e) {
    console.warn("[Requisitos] cálculo falhou:", e instanceof Error ? e.message : e);
  }
  return liberadas;
}

// ─── Escrita do aluno ───────────────────────────────────────────────────────

/** Grava (ou corrige) a resposta. Só pergunta publicada, da aula informada. */
export async function salvarResposta(userId: number, lessonId: number, perguntaId: number, texto: string): Promise<boolean> {
  if (!(await garantirTabelasPerguntas())) return false;
  const d = await db.getDb();
  if (!d) return false;
  const limpo = texto.replace(/\s+/g, " ").trim().slice(0, 4000);
  const r = await d.execute(sql`
    INSERT INTO "aulaRespostas" ("userId", "perguntaId", "lessonId", "texto")
    SELECT ${userId}, p."id", p."lessonId", ${limpo} FROM "aulaPerguntas" p
    WHERE p."id" = ${perguntaId} AND p."lessonId" = ${lessonId} AND p."publicada" = 1
    ON CONFLICT ("userId", "perguntaId") DO UPDATE SET "texto" = EXCLUDED."texto", "respondidoEm" = now()
    RETURNING 1
  `);
  return linhasDe(r).length > 0;
}

/** Registra o depoimento do curso (entra na moderação como pendente). Idempotente por aluno e curso. */
export async function salvarDepoimento(p: { userId: number; courseId: number; nome: string; texto: string }): Promise<"criado" | "ja_existia"> {
  if (await db.getTestimonialByUserAndCourse(p.userId, p.courseId)) return "ja_existia";
  await db.createTestimonial({
    userId: p.userId, courseId: p.courseId, displayName: p.nome.slice(0, 255), text: p.texto.trim(),
    status: "pending", consentPublicDisplay: 1,
  });
  return "criado";
}

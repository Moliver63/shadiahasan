/**
 * Prova de que a aula foi assistida (base do certificado).
 *
 * Auditoria de 31/10/2026: o certificado era emitido a partir de
 * `enrollments.completedLessons`, lista que o NAVEGADOR envia (`enrollments.updateProgress`).
 * Bastava arrastar a barra do vídeo até o fim, ou chamar a API na mão, para "concluir"
 * qualquer aula a que o aluno tem acesso e ganhar o certificado sem assistir.
 *
 * Agora o servidor mede por conta própria:
 *  - o player manda, a cada ~15 s, quantos segundos do vídeo foram realmente tocados
 *    (pular a barra não conta: só avanço contínuo de reprodução);
 *  - o servidor limita cada envio pelo tempo real decorrido desde o envio anterior
 *    (até 2x de velocidade) e por um teto por envio, então mandar "3600 s" de uma vez
 *    rende no máximo alguns segundos;
 *  - a aula só conta como assistida com pelo menos 80% da duração acumulada.
 *
 * Quem decide o certificado é esta tabela, nunca a lista de aulas concluídas do navegador.
 */
import { eq, sql } from "drizzle-orm";
import * as db from "./db";
import { lessons } from "../drizzle/schema";

/** Fração mínima da aula que precisa ter sido tocada de verdade. */
export const MIN_FRACAO = 0.8;
/** Velocidade máxima aceita no player (2x) com folga. */
export const FATOR_VELOCIDADE = 2.1;
/** Teto de crédito por envio, em segundos de vídeo. */
export const MAX_POR_PULSO = 40;
/** Crédito do primeiro envio de uma aula (não há envio anterior para medir o tempo real). */
export const PRIMEIRO_PULSO = 20;
/** Sem duração cadastrada, a informada pelo player só vale dentro destes limites. */
const DURACAO_MIN = 30;
const DURACAO_MAX = 6 * 3600;

// ─── Regras puras (testáveis sem banco) ─────────────────────────────────────

/**
 * Quantos segundos de crédito um envio rende.
 * `decorrido`: segundos reais desde o envio anterior (null = primeiro envio da aula).
 */
export function creditoDoPulso(reportado: number, decorrido: number | null): number {
  const r = Number.isFinite(reportado) ? Math.max(0, reportado) : 0;
  if (decorrido == null) return Math.min(r, PRIMEIRO_PULSO);
  const d = Number.isFinite(decorrido) ? Math.max(0, decorrido) : 0;
  return Math.min(r, MAX_POR_PULSO, d * FATOR_VELOCIDADE);
}

/** Duração em que a regra se apoia: a da aula; sem ela, a que o player informou (limitada). */
export function duracaoEfetiva(duracaoAula: number | null | undefined, informada: number | null | undefined): number | null {
  if (duracaoAula && duracaoAula > 0) return duracaoAula;
  if (informada && Number.isFinite(informada) && informada > 0) return Math.min(DURACAO_MAX, Math.max(DURACAO_MIN, informada));
  return null;
}

/** A aula conta como assistida? Sem duração conhecida, nunca conta. */
export function atingiuMinimo(segundos: number, duracao: number | null): boolean {
  if (!duracao || duracao <= 0) return false;
  return segundos >= duracao * MIN_FRACAO;
}

// ─── Tabela ─────────────────────────────────────────────────────────────────

let tabelaPronta: Promise<boolean> | null = null;

export function garantirTabelaAssistido(): Promise<boolean> {
  if (!tabelaPronta) {
    tabelaPronta = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "aulaAssistida" (
            "userId" integer NOT NULL,
            "lessonId" integer NOT NULL,
            "segundos" double precision NOT NULL DEFAULT 0,
            "duracaoInformada" integer,
            "ultimoPulso" timestamptz NOT NULL DEFAULT now(),
            "criadoEm" timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY ("userId", "lessonId")
          )
        `);
        return true;
      } catch (e) {
        console.warn("[Assistido] tabela indisponível:", e instanceof Error ? e.message : e);
        tabelaPronta = null;
        return false;
      }
    })();
  }
  return tabelaPronta;
}

const linhasDe = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

// ─── Gravação e leitura ─────────────────────────────────────────────────────

export type ResultadoPulso = { segundos: number; duracao: number | null; assistida: boolean; /** Este envio foi o que fechou os 80%. */ novaConclusao: boolean };

/**
 * Soma o crédito de um envio do player. Um aluno por linha, travada durante a conta,
 * então duas abas da mesma aula não contam em dobro (a segunda chega com ~0 s decorrido).
 * O chamador já verificou que o aluno tem acesso à aula.
 */
export async function registrarPulso(p: { userId: number; lessonId: number; reportado: number; duracaoInformada?: number | null }): Promise<ResultadoPulso | null> {
  if (!(await garantirTabelaAssistido())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const [aula] = await d.select({ duration: lessons.duration }).from(lessons).where(eq(lessons.id, p.lessonId)).limit(1);
  if (!aula) return null;
  const informada = p.duracaoInformada && Number.isFinite(p.duracaoInformada) ? Math.round(p.duracaoInformada) : null;
  const duracao = duracaoEfetiva(aula.duration, informada);

  return await d.transaction(async (tx) => {
    const novo = linhasDe(await tx.execute(sql`
      INSERT INTO "aulaAssistida" ("userId", "lessonId", "segundos", "duracaoInformada")
      VALUES (${p.userId}, ${p.lessonId}, ${creditoDoPulso(p.reportado, null)}, ${informada})
      ON CONFLICT ("userId", "lessonId") DO NOTHING
      RETURNING "segundos"
    `));
    if (novo.length) {
      const s = Number(novo[0].segundos);
      const ok = atingiuMinimo(s, duracao);
      return { segundos: s, duracao, assistida: ok, novaConclusao: ok };
    }
    const atual = linhasDe(await tx.execute(sql`
      SELECT "segundos", EXTRACT(EPOCH FROM (now() - "ultimoPulso")) AS "decorrido"
      FROM "aulaAssistida" WHERE "userId" = ${p.userId} AND "lessonId" = ${p.lessonId} FOR UPDATE
    `))[0];
    const credito = creditoDoPulso(p.reportado, Number(atual.decorrido));
    // Nunca passa da duração (com folga de um envio): evita acumular além do vídeo
    const teto = duracao ? duracao + MAX_POR_PULSO : Number.MAX_SAFE_INTEGER;
    const segundos = Math.min(Number(atual.segundos) + credito, teto);
    await tx.execute(sql`
      UPDATE "aulaAssistida"
      SET "segundos" = ${segundos}, "ultimoPulso" = now(),
          "duracaoInformada" = COALESCE(${informada}, "duracaoInformada")
      WHERE "userId" = ${p.userId} AND "lessonId" = ${p.lessonId}
    `);
    const antes = atingiuMinimo(Number(atual.segundos), duracao);
    const depois = atingiuMinimo(segundos, duracao);
    return { segundos, duracao, assistida: depois, novaConclusao: depois && !antes };
  });
}

/**
 * Das aulas pedidas (ou de todas, se `ids` não vier), quais o aluno assistiu de fato.
 * Falha de banco devolve conjunto vazio: na dúvida, não emite certificado.
 */
export async function aulasAssistidas(userId: number, ids?: number[]): Promise<Set<number>> {
  const ok = new Set<number>();
  try {
    if (!(await garantirTabelaAssistido())) return ok;
    const d = await db.getDb();
    if (!d) return ok;
    if (ids && !ids.length) return ok;
    const filtro = ids ? sql`AND a."lessonId" IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})` : sql``;
    const linhas = linhasDe(await d.execute(sql`
      SELECT a."lessonId", a."segundos", a."duracaoInformada", l."duration"
      FROM "aulaAssistida" a JOIN "lessons" l ON l."id" = a."lessonId"
      WHERE a."userId" = ${userId} ${filtro}
    `));
    for (const l of linhas) {
      const dur = duracaoEfetiva(l.duration == null ? null : Number(l.duration), l.duracaoInformada == null ? null : Number(l.duracaoInformada));
      if (atingiuMinimo(Number(l.segundos), dur)) ok.add(Number(l.lessonId));
    }
  } catch (e) {
    console.warn("[Assistido] leitura falhou:", e instanceof Error ? e.message : e);
  }
  return ok;
}

/** Situação de uma aula para o aluno: quanto já foi assistido e se bateu os 80%. */
export async function statusAssistido(userId: number, lessonId: number): Promise<{ fracao: number; assistida: boolean }> {
  try {
    if (!(await garantirTabelaAssistido())) return { fracao: 0, assistida: false };
    const d = await db.getDb();
    if (!d) return { fracao: 0, assistida: false };
    const l = linhasDe(await d.execute(sql`
      SELECT a."segundos", a."duracaoInformada", l."duration"
      FROM "aulaAssistida" a JOIN "lessons" l ON l."id" = a."lessonId"
      WHERE a."userId" = ${userId} AND a."lessonId" = ${lessonId}
    `))[0];
    if (!l) return { fracao: 0, assistida: false };
    const dur = duracaoEfetiva(l.duration == null ? null : Number(l.duration), l.duracaoInformada == null ? null : Number(l.duracaoInformada));
    const seg = Number(l.segundos);
    return { fracao: dur ? Math.min(1, seg / (dur * MIN_FRACAO)) : 0, assistida: atingiuMinimo(seg, dur) };
  } catch {
    return { fracao: 0, assistida: false };
  }
}

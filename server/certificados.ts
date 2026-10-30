/**
 * Certificados do aluno: um por aula concluída e um geral por Programa.
 *
 * Pedido do Michel (30/10/2026): "pode ser um curso por aula e um geral".
 * Até então só existia a tabela `certificates` e uma mutation (`certificates.generate`)
 * que nenhuma tela chamava, sem PDF e sem página de verificação.
 *
 * Regras:
 *  - Certificado de AULA: emitido quando o aluno conclui a aula (e tem acesso a ela).
 *    Um por aluno e aula, nunca duplica.
 *  - Certificado GERAL: emitido quando o aluno conclui TODAS as aulas publicadas de
 *    um Programa ativo. Programa com menos de 2 aulas não gera o geral (seria igual
 *    ao da aula). Um por aluno e Programa.
 *  - "Concluída" é o que o aluno marcou em `enrollments.completedLessons`. O servidor
 *    só aceita a aula se ela é publicada, é do curso informado e o aluno tem acesso
 *    (assinatura, compra ou teste de 1 aula dentro da validade). Quem fosse mandar
 *    ids de aulas que não pode assistir não ganha certificado.
 *  - O número (SH-AAAA-XXXXXXXX) é aleatório: não dá para adivinhar o de outro aluno.
 *  - O nome no certificado é o do perfil NA HORA de gerar o PDF; assim o aluno corrige
 *    um nome errado e baixa de novo.
 *
 * Tabela nova `certificadosEmitidos` (criada em tempo de execução, como trialPasses),
 * em vez de alterar a antiga `certificates`, que não tinha aula nem Programa.
 */
import { randomInt } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as db from "./db";
import { contentCollectionItems, contentCollections, courses, enrollments, lessons, users } from "../drizzle/schema";

export type TipoCertificado = "aula" | "programa";

export type CertificadoEmitido = {
  id: number;
  tipo: TipoCertificado;
  userId: number;
  lessonId: number | null;
  programId: number | null;
  courseId: number | null;
  titulo: string;
  subtitulo: string | null;
  numero: string;
  emitidoEm: Date;
};

// ─── Regras puras (testáveis sem banco) ─────────────────────────────────────

export type ProgramaComAulas = { id: number; title: string; lessonIds: number[] };

/**
 * Decide o que emitir. `novasAulas` são as aulas recém concluídas e já validadas.
 * `concluidas` é tudo que o aluno concluiu (inclui as novas).
 */
export function decidirEmissoes(p: {
  novasAulas: number[];
  concluidas: Set<number>;
  programas: ProgramaComAulas[];
  jaTemAula: Set<number>;
  jaTemPrograma: Set<number>;
}): { aulas: number[]; programas: number[] } {
  const aulas = Array.from(new Set(p.novasAulas)).filter((id) => !p.jaTemAula.has(id));
  const programas = p.programas
    .filter((g) => !p.jaTemPrograma.has(g.id) && g.lessonIds.length >= 2 && g.lessonIds.every((id) => p.concluidas.has(id)))
    .map((g) => g.id);
  return { aulas, programas };
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I para ler e digitar sem erro

export function gerarNumero(agora = new Date()): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return `SH-${agora.getUTCFullYear()}-${s}`;
}

export function numeroValido(v: unknown): v is string {
  return typeof v === "string" && /^SH-\d{4}-[A-HJ-NP-Z2-9]{8}$/.test(v);
}

export function lerConcluidas(texto: string | null | undefined): number[] {
  if (!texto) return [];
  try {
    const v = JSON.parse(texto);
    return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}

// ─── Tabela ─────────────────────────────────────────────────────────────────

let tabelaPronta: Promise<boolean> | null = null;

export function garantirTabela(): Promise<boolean> {
  if (!tabelaPronta) {
    tabelaPronta = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "certificadosEmitidos" (
            "id" serial PRIMARY KEY,
            "userId" integer NOT NULL,
            "tipo" varchar(10) NOT NULL,
            "lessonId" integer,
            "programId" integer,
            "courseId" integer,
            "titulo" varchar(255) NOT NULL,
            "subtitulo" varchar(255),
            "numero" varchar(32) NOT NULL UNIQUE,
            "emitidoEm" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "certEmitidos_aula_uq" ON "certificadosEmitidos" ("userId", "lessonId") WHERE "tipo" = 'aula'`);
        await d.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "certEmitidos_programa_uq" ON "certificadosEmitidos" ("userId", "programId") WHERE "tipo" = 'programa'`);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "certEmitidos_user_idx" ON "certificadosEmitidos" ("userId")`);
        return true;
      } catch (e) {
        console.warn("[Certificados] tabela indisponível:", e instanceof Error ? e.message : e);
        tabelaPronta = null;
        return false;
      }
    })();
  }
  return tabelaPronta;
}

const linhasDe = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

function paraCertificado(l: any): CertificadoEmitido {
  return {
    id: Number(l.id), tipo: l.tipo, userId: Number(l.userId),
    lessonId: l.lessonId == null ? null : Number(l.lessonId),
    programId: l.programId == null ? null : Number(l.programId),
    courseId: l.courseId == null ? null : Number(l.courseId),
    titulo: String(l.titulo), subtitulo: l.subtitulo ?? null, numero: String(l.numero),
    emitidoEm: new Date(l.emitidoEm),
  };
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/** Gerais primeiro, depois as aulas, do mais recente para o mais antigo. */
export async function listarDoAluno(userId: number): Promise<CertificadoEmitido[]> {
  if (!(await garantirTabela())) return [];
  const d = await db.getDb();
  if (!d) return [];
  const r = await d.execute(sql`
    SELECT * FROM "certificadosEmitidos" WHERE "userId" = ${userId}
    ORDER BY CASE "tipo" WHEN 'programa' THEN 0 ELSE 1 END, "emitidoEm" DESC, "id" DESC
  `);
  return linhasDe(r).map(paraCertificado);
}

export type CertificadoComAluno = CertificadoEmitido & { nomeAluno: string | null };

export async function buscarPorNumero(numero: string): Promise<CertificadoComAluno | null> {
  if (!numeroValido(numero) || !(await garantirTabela())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const r = await d.execute(sql`
    SELECT c.*, u."name" AS "nomeAluno" FROM "certificadosEmitidos" c
    LEFT JOIN "users" u ON u."id" = c."userId"
    WHERE c."numero" = ${numero} LIMIT 1
  `);
  const l = linhasDe(r)[0];
  return l ? { ...paraCertificado(l), nomeAluno: nomeValido(l.nomeAluno ? String(l.nomeAluno) : null) } : null;
}

// ─── Emissão ────────────────────────────────────────────────────────────────

export type AulaValida = { id: number; courseId: number; title: string };

/**
 * Filtra as aulas que o aluno pode mesmo ter concluído: publicadas, do curso
 * informado (quando informado) e com acesso hoje.
 */
export async function validarAulas(userId: number, ids: number[], courseId?: number): Promise<AulaValida[]> {
  const unicos = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0))).slice(0, 500);
  if (!unicos.length) return [];
  const d = await db.getDb();
  if (!d) return [];
  const linhas = await d
    .select({ id: lessons.id, courseId: lessons.courseId, title: lessons.title, isPublished: lessons.isPublished, isAccessRestricted: lessons.isAccessRestricted })
    .from(lessons)
    .where(inArray(lessons.id, unicos));
  // import tardio: routers/videos puxa o resto do servidor
  const { checkUserHasAccess } = await import("./routers/videos");
  const validas: AulaValida[] = [];
  for (const l of linhas) {
    if (!l.isPublished) continue;
    if (courseId !== undefined && l.courseId !== courseId) continue;
    if (!(await checkUserHasAccess(userId, { isAccessRestricted: l.isAccessRestricted, courseId: l.courseId, id: l.id }))) continue;
    validas.push({ id: l.id, courseId: l.courseId, title: l.title });
  }
  return validas;
}

/** Programas ativos que contêm alguma das aulas, com todas as aulas publicadas de cada um. */
async function programasDasAulas(lessonIds: number[]): Promise<Array<ProgramaComAulas & { ordem: number }>> {
  const d = await db.getDb();
  if (!d || !lessonIds.length) return [];
  const ligados = await d
    .selectDistinct({ id: contentCollections.id })
    .from(contentCollectionItems)
    .innerJoin(contentCollections, eq(contentCollections.id, contentCollectionItems.collectionId))
    .where(and(inArray(contentCollectionItems.lessonId, lessonIds), eq(contentCollections.isActive, 1)));
  const ids = ligados.map((l) => l.id);
  if (!ids.length) return [];
  const itens = await d
    .select({ programId: contentCollections.id, title: contentCollections.title, ordem: contentCollections.order, lessonId: lessons.id })
    .from(contentCollectionItems)
    .innerJoin(contentCollections, eq(contentCollections.id, contentCollectionItems.collectionId))
    .innerJoin(lessons, eq(lessons.id, contentCollectionItems.lessonId))
    .where(and(inArray(contentCollections.id, ids), eq(lessons.isPublished, 1)));
  const mapa = new Map<number, ProgramaComAulas & { ordem: number }>();
  for (const i of itens) {
    const g = mapa.get(i.programId) ?? { id: i.programId, title: i.title, ordem: i.ordem, lessonIds: [] };
    if (!g.lessonIds.includes(i.lessonId)) g.lessonIds.push(i.lessonId);
    mapa.set(i.programId, g);
  }
  return Array.from(mapa.values());
}

async function inserir(d: NonNullable<Awaited<ReturnType<typeof db.getDb>>>, c: {
  userId: number; tipo: TipoCertificado; lessonId?: number; programId?: number; courseId?: number | null; titulo: string; subtitulo?: string | null;
}): Promise<CertificadoEmitido | null> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const numero = gerarNumero();
    try {
      const r = await d.execute(sql`
        INSERT INTO "certificadosEmitidos" ("userId", "tipo", "lessonId", "programId", "courseId", "titulo", "subtitulo", "numero")
        VALUES (${c.userId}, ${c.tipo}, ${c.lessonId ?? null}, ${c.programId ?? null}, ${c.courseId ?? null}, ${c.titulo.slice(0, 255)}, ${c.subtitulo ? c.subtitulo.slice(0, 255) : null}, ${numero})
        ON CONFLICT DO NOTHING
        RETURNING *
      `);
      const l = linhasDe(r)[0];
      if (l) return paraCertificado(l);
      // Nada devolvido: ou o aluno já tem este certificado, ou o número colidiu
      const existe = await d.execute(sql`SELECT 1 FROM "certificadosEmitidos" WHERE "userId" = ${c.userId} AND "tipo" = ${c.tipo}
        AND ${c.tipo === "aula" ? sql`"lessonId" = ${c.lessonId}` : sql`"programId" = ${c.programId}`} LIMIT 1`);
      if (linhasDe(existe).length) return null;
    } catch (e) {
      console.warn("[Certificados] falha ao gravar:", e instanceof Error ? e.message : e);
      return null;
    }
  }
  return null;
}

/**
 * Emite o que couber para estas aulas JÁ validadas (ver `validarAulas`).
 * Devolve só os certificados criados agora, para avisar o aluno.
 */
export async function emitirParaAulas(userId: number, aulas: AulaValida[]): Promise<CertificadoEmitido[]> {
  if (!aulas.length || !(await garantirTabela())) return [];
  const d = await db.getDb();
  if (!d) return [];

  const ids = aulas.map((a) => a.id);
  const programas = await programasDasAulas(ids);

  // Tudo que o aluno já concluiu, em qualquer curso, mais as aulas novas
  const matriculas = await d.select({ completedLessons: enrollments.completedLessons }).from(enrollments).where(eq(enrollments.userId, userId));
  const concluidas = new Set<number>(ids);
  for (const m of matriculas) for (const id of lerConcluidas(m.completedLessons)) concluidas.add(id);

  const existentes = await listarDoAluno(userId);
  const decisao = decidirEmissoes({
    novasAulas: ids,
    concluidas,
    programas,
    jaTemAula: new Set(existentes.filter((c) => c.tipo === "aula" && c.lessonId != null).map((c) => c.lessonId!)),
    jaTemPrograma: new Set(existentes.filter((c) => c.tipo === "programa" && c.programId != null).map((c) => c.programId!)),
  });

  const emitidos: CertificadoEmitido[] = [];

  // Subtítulo da aula: o primeiro Programa em que ela aparece; sem Programa, o curso
  const titulosCurso = new Map<number, string>();
  const cursosIds = Array.from(new Set(aulas.map((a) => a.courseId)));
  if (cursosIds.length) {
    for (const c of await d.select({ id: courses.id, title: courses.title }).from(courses).where(inArray(courses.id, cursosIds))) titulosCurso.set(c.id, c.title);
  }
  const porOrdem = [...programas].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  for (const id of decisao.aulas) {
    const aula = aulas.find((a) => a.id === id)!;
    const programa = porOrdem.find((g) => g.lessonIds.includes(id));
    const c = await inserir(d, {
      userId, tipo: "aula", lessonId: id, courseId: aula.courseId, titulo: aula.title,
      subtitulo: programa?.title ?? titulosCurso.get(aula.courseId) ?? null,
    });
    if (c) emitidos.push(c);
  }
  for (const id of decisao.programas) {
    const g = programas.find((p) => p.id === id)!;
    const c = await inserir(d, { userId, tipo: "programa", programId: id, titulo: g.title, subtitulo: null });
    if (c) emitidos.push(c);
  }
  return emitidos;
}

/** Gancho do `enrollments.updateProgress`: valida as aulas recém concluídas e emite. Nunca lança. */
export async function emitirParaAulasConcluidas(userId: number, courseId: number, ids: number[]): Promise<CertificadoEmitido[]> {
  try {
    return await emitirParaAulas(userId, await validarAulas(userId, ids, courseId));
  } catch (e) {
    console.warn("[Certificados] emissão falhou:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Para quem concluiu aulas antes de esta função existir (e para consertar qualquer
 * falha): olha tudo que o aluno marcou como concluído e emite o que faltar.
 * Idempotente. Cada aula só vale no curso em que foi marcada.
 */
export async function sincronizarDoAluno(userId: number): Promise<CertificadoEmitido[]> {
  try {
    const d = await db.getDb();
    if (!d) return [];
    const matriculas = await d.select({ courseId: enrollments.courseId, completedLessons: enrollments.completedLessons }).from(enrollments).where(eq(enrollments.userId, userId));
    const validas: AulaValida[] = [];
    for (const m of matriculas) validas.push(...(await validarAulas(userId, lerConcluidas(m.completedLessons), m.courseId)));
    const unicas = Array.from(new Map(validas.map((a) => [a.id, a])).values());
    return await emitirParaAulas(userId, unicas);
  } catch (e) {
    console.warn("[Certificados] sincronização falhou:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Nome que pode ir no certificado: vazio ou parecido com e-mail não vale. */
export function nomeValido(nome: string | null | undefined): string | null {
  const n = (nome || "").trim();
  return n && !n.includes("@") ? n : null;
}

export async function nomeDoAluno(userId: number): Promise<string | null> {
  const d = await db.getDb();
  if (!d) return null;
  const [u] = await d.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return nomeValido(u?.name);
}

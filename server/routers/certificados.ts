/**
 * Router: certificados
 * Certificados por aula e geral por Programa. Ver server/certificados.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { registrarPulso, statusAssistido } from "../assistido";
import { criarRascunhos, garantirTabelasPerguntas, MIN_CARACTERES, MIN_RESPOSTAS, passosDaAula, perguntasDaAula, respostaValida, salvarDepoimento, salvarResposta } from "../requisitos";
import { sql } from "drizzle-orm";
import { buscarPorNumero, emitirParaAulas, validarAulas, listarDoAluno, nomeDoAluno, numeroValido, salvarNomeDoAluno, sincronizarDoAluno } from "../certificados";

type Novo = { numero: string; tipo: string; titulo: string };

/** Emite se a aula já cumpriu os três requisitos (o filtro de verdade está em emitirParaAulas). */
async function tentarEmitir(userId: number, aula: { id: number; courseId: number; title: string }): Promise<Novo[]> {
  try {
    return (await emitirParaAulas(userId, [aula])).map((c) => ({ numero: c.numero, tipo: c.tipo, titulo: c.titulo }));
  } catch (e) {
    console.warn("[Certificados] emissão falhou:", e instanceof Error ? e.message : e);
    return [];
  }
}

async function aulaComAcesso(userId: number, lessonId: number) {
  const [aula] = await validarAulas(userId, [lessonId]);
  if (!aula) throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso a esta aula." });
  return aula;
}

const linhas = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

export const certificadosRouter = router({
  /**
   * Certificados do aluno logado (gerais primeiro) e o estado do nome impresso.
   * `nomeCompleto`: o perfil tem nome e sobrenome e o PDF pode sair. `nome`: como vai impresso.
   */
  meus: protectedProcedure.query(async ({ ctx }) => {
    const [lista, nome] = await Promise.all([listarDoAluno(ctx.user.id), nomeDoAluno(ctx.user.id)]);
    return { certificados: lista, nome: nome.nome, nomeCompleto: nome.completo, problemaNome: nome.problema, semNome: !nome.completo };
  }),

  /**
   * Pulso do player (a cada ~15 s): quantos segundos do vídeo foram tocados de verdade.
   * O servidor limita pelo tempo real e só libera o certificado com 80% da aula acumulados.
   * Quando este envio fecha os 80%, já emite e devolve os certificados novos.
   */
  registrarAssistido: protectedProcedure
    .input(z.object({
      lessonId: z.number().int().positive(),
      segundos: z.number().min(0).max(120),
      duracao: z.number().min(0).max(86400).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [aula] = await validarAulas(ctx.user.id, [input.lessonId]);
      if (!aula) throw new TRPCError({ code: "FORBIDDEN", message: "Sem acesso a esta aula." });
      const r = await registrarPulso({ userId: ctx.user.id, lessonId: aula.id, reportado: input.segundos, duracaoInformada: input.duracao });
      if (!r) return { assistida: false, certificadosNovos: [] as Novo[] };
      // Fechou os 80%: se o aluno já tinha respostas e depoimento do curso, o certificado sai agora
      const novos = r.novaConclusao ? await tentarEmitir(ctx.user.id, aula) : [];
      return { assistida: r.assistida, certificadosNovos: novos };
    }),

  /** Confirma ou corrige o nome que sai no certificado (grava no perfil). */
  salvarNome: protectedProcedure
    .input(z.object({ nome: z.string().max(120) }))
    .mutation(async ({ ctx, input }) => {
      const r = await salvarNomeDoAluno(ctx.user.id, input.nome);
      if (!r.completo) throw new TRPCError({ code: "BAD_REQUEST", message: r.problema ?? "Nome inválido." });
      return { nome: r.nome as string };
    }),

  /** Emite o que faltar a partir do que o aluno já concluiu. Idempotente. */
  sincronizar: protectedProcedure.mutation(async ({ ctx }) => {
    const novos = await sincronizarDoAluno(ctx.user.id);
    return { novos: novos.length };
  }),

  /** Página pública de verificação (/certificado/:numero). Não expõe e-mail nem id do aluno. */
  verificar: publicProcedure
    .input(z.object({ numero: z.string().trim().toUpperCase().max(40) }))
    .query(async ({ input }) => {
      if (!numeroValido(input.numero)) return { valido: false as const };
      const c = await buscarPorNumero(input.numero);
      if (!c) return { valido: false as const };
      return {
        valido: true as const,
        tipo: c.tipo,
        titulo: c.titulo,
        subtitulo: c.subtitulo,
        nomeAluno: c.nomeAluno,
        emitidoEm: c.emitidoEm,
        numero: c.numero,
      };
    }),

  // ─── Requisitos: assistir, responder 3 perguntas, depoimento ──────────────

  /** Passos do certificado desta aula para o aluno logado. */
  passos: protectedProcedure
    .input(z.object({ lessonId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const aula = await aulaComAcesso(ctx.user.id, input.lessonId);
      const ass = await statusAssistido(ctx.user.id, aula.id);
      const [passos, perguntas] = await Promise.all([passosDaAula(ctx.user.id, aula.id, ass.assistida), perguntasDaAula(ctx.user.id, aula.id)]);
      return { ...passos, fracaoAssistida: ass.fracao, perguntas, minimo: MIN_RESPOSTAS, minimoCaracteres: MIN_CARACTERES };
    }),

  /** Responde (ou corrige) uma pergunta da aula. Só depois de assistir. */
  responder: protectedProcedure
    .input(z.object({ lessonId: z.number().int().positive(), perguntaId: z.number().int().positive(), texto: z.string().max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const aula = await aulaComAcesso(ctx.user.id, input.lessonId);
      if (!(await statusAssistido(ctx.user.id, aula.id)).assistida) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Assista à aula antes de responder às perguntas." });
      }
      if (!respostaValida(input.texto)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Escreva com suas palavras, pelo menos ${MIN_CARACTERES} caracteres e algumas frases.` });
      }
      if (!(await salvarResposta(ctx.user.id, aula.id, input.perguntaId, input.texto))) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pergunta não encontrada." });
      }
      return { certificadosNovos: await tentarEmitir(ctx.user.id, aula) };
    }),

  /** Depoimento do curso. Só depois de assistir e responder as perguntas; libera o certificado. */
  enviarDepoimento: protectedProcedure
    .input(z.object({ lessonId: z.number().int().positive(), texto: z.string().trim().min(30).max(1200), autorizaPublicacao: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const aula = await aulaComAcesso(ctx.user.id, input.lessonId);
      const ass = await statusAssistido(ctx.user.id, aula.id);
      const passos = await passosDaAula(ctx.user.id, aula.id, ass.assistida);
      if (!passos.assistida || !passos.perguntasOk) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Assista à aula e responda às perguntas antes de enviar o depoimento." });
      }
      await salvarDepoimento({ userId: ctx.user.id, courseId: aula.courseId, nome: ctx.user.name || "Aluno(a)", texto: input.texto });
      return { certificadosNovos: await tentarEmitir(ctx.user.id, aula) };
    }),

  // ─── Admin: perguntas por aula ─────────────────────────────────────────────

  /** Aulas com a contagem de perguntas publicadas e rascunhos (e exercícios publicados). */
  adminResumo: adminProcedure.query(async () => {
    await garantirTabelasPerguntas();
    const d = await db.getDb();
    if (!d) return [];
    const r = await d.execute(sql`
      SELECT l."id", l."title", l."courseId", c."title" AS "curso",
        (SELECT count(*) FROM "aulaPerguntas" p WHERE p."lessonId" = l."id" AND p."publicada" = 1) AS "publicadas",
        (SELECT count(*) FROM "aulaPerguntas" p WHERE p."lessonId" = l."id" AND p."publicada" = 0) AS "rascunhos",
        (SELECT count(*) FROM "lessonExercises" e WHERE e."lessonId" = l."id" AND e."isPublished" = 1) AS "exercicios"
      FROM "lessons" l LEFT JOIN "courses" c ON c."id" = l."courseId"
      WHERE l."isPublished" = 1 ORDER BY c."title", l."order", l."id"
    `);
    return linhas(r).map((l) => ({
      id: Number(l.id), titulo: String(l.title), courseId: Number(l.courseId), curso: String(l.curso ?? ""),
      publicadas: Number(l.publicadas), rascunhos: Number(l.rascunhos), exercicios: Number(l.exercicios),
      prontas: Number(l.publicadas) + Number(l.exercicios) >= MIN_RESPOSTAS,
    }));
  }),

  adminPerguntas: adminProcedure
    .input(z.object({ lessonId: z.number().int().positive() }))
    .query(async ({ input }) => {
      await garantirTabelasPerguntas();
      const d = await db.getDb();
      if (!d) return [];
      const r = await d.execute(sql`SELECT "id", "texto", "ordem", "publicada" FROM "aulaPerguntas" WHERE "lessonId" = ${input.lessonId} ORDER BY "ordem", "id"`);
      return linhas(r).map((l) => ({ id: Number(l.id), texto: String(l.texto), ordem: Number(l.ordem), publicada: Number(l.publicada) === 1 }));
    }),

  adminSalvarPergunta: adminProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      lessonId: z.number().int().positive(),
      texto: z.string().trim().min(10).max(500),
      ordem: z.number().int().min(0).max(999).default(0),
      publicada: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await garantirTabelasPerguntas();
      const d = await db.getDb();
      if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const pub = input.publicada ? 1 : 0;
      if (input.id) {
        await d.execute(sql`UPDATE "aulaPerguntas" SET "texto" = ${input.texto}, "ordem" = ${input.ordem}, "publicada" = ${pub} WHERE "id" = ${input.id} AND "lessonId" = ${input.lessonId}`);
      } else {
        await d.execute(sql`INSERT INTO "aulaPerguntas" ("lessonId", "ordem", "texto", "publicada") VALUES (${input.lessonId}, ${input.ordem}, ${input.texto}, ${pub})`);
      }
      return { success: true };
    }),

  /** Exclui só pergunta que ninguém respondeu; as já respondidas devem ser despublicadas. */
  adminExcluirPergunta: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await garantirTabelasPerguntas();
      const d = await db.getDb();
      if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const usada = linhas(await d.execute(sql`SELECT 1 FROM "aulaRespostas" WHERE "perguntaId" = ${input.id} LIMIT 1`)).length > 0;
      if (usada) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta pergunta já tem respostas de alunos. Despublique em vez de excluir." });
      await d.execute(sql`DELETE FROM "aulaPerguntas" WHERE "id" = ${input.id}`);
      return { success: true };
    }),

  /** Cria os 3 rascunhos-modelo para aulas sem perguntas (todas, ou só `lessonId`). */
  adminCriarRascunhos: adminProcedure
    .input(z.object({ lessonId: z.number().int().positive().optional() }))
    .mutation(async ({ input }) => {
      await garantirTabelasPerguntas();
      return { criadas: await criarRascunhos(input.lessonId) };
    }),
});

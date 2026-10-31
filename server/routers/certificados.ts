/**
 * Router: certificados
 * Certificados por aula e geral por Programa. Ver server/certificados.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { registrarPulso } from "../assistido";
import { buscarPorNumero, emitirParaAulas, validarAulas, listarDoAluno, nomeDoAluno, numeroValido, salvarNomeDoAluno, sincronizarDoAluno } from "../certificados";

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
      if (!r) return { assistida: false, certificadosNovos: [] as Array<{ numero: string; tipo: string; titulo: string }> };
      let novos: Array<{ numero: string; tipo: string; titulo: string }> = [];
      if (r.novaConclusao) {
        try {
          novos = (await emitirParaAulas(ctx.user.id, [aula])).map((c) => ({ numero: c.numero, tipo: c.tipo, titulo: c.titulo }));
        } catch (e) {
          console.warn("[Certificados] emissão pós-pulso falhou:", e instanceof Error ? e.message : e);
        }
      }
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
});

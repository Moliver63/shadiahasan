/**
 * Router: certificados
 * Certificados por aula e geral por Programa. Ver server/certificados.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { buscarPorNumero, listarDoAluno, nomeDoAluno, numeroValido, salvarNomeDoAluno, sincronizarDoAluno } from "../certificados";

export const certificadosRouter = router({
  /**
   * Certificados do aluno logado (gerais primeiro) e o estado do nome impresso.
   * `nomeCompleto`: o perfil tem nome e sobrenome e o PDF pode sair. `nome`: como vai impresso.
   */
  meus: protectedProcedure.query(async ({ ctx }) => {
    const [lista, nome] = await Promise.all([listarDoAluno(ctx.user.id), nomeDoAluno(ctx.user.id)]);
    return { certificados: lista, nome: nome.nome, nomeCompleto: nome.completo, problemaNome: nome.problema, semNome: !nome.completo };
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

/**
 * Router: certificados
 * Certificados por aula e geral por Programa. Ver server/certificados.ts.
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { buscarPorNumero, listarDoAluno, nomeDoAluno, numeroValido, sincronizarDoAluno } from "../certificados";

export const certificadosRouter = router({
  /** Certificados do aluno logado (gerais primeiro). `semNome`: o perfil não tem nome para imprimir. */
  meus: protectedProcedure.query(async ({ ctx }) => {
    const [lista, nome] = await Promise.all([listarDoAluno(ctx.user.id), nomeDoAluno(ctx.user.id)]);
    return { certificados: lista, semNome: !nome };
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

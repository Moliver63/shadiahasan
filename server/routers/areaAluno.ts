/**
 * Router: areaAluno
 * Painel do aluno (/minha-area): acesso, cursos, compras e certificados. Ver server/areaAluno.ts.
 */
import { protectedProcedure, router } from "../_core/trpc";
import { carregarAreaAluno } from "../areaAluno";

export const areaAlunoRouter = router({
  resumo: protectedProcedure.query(({ ctx }) => carregarAreaAluno(ctx.user.id)),
});

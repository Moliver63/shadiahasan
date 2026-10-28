/**
 * Router: acessos
 * Gráfico de acessos do painel Analytics (GA4 + Meta + Clarity). Ver server/acessos.ts.
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { obterAcessos } from "../acessos";

export const acessosRouter = router({
  porDia: adminProcedure
    .input(z.object({ dias: z.number().int().min(7).max(90).default(30), forcar: z.boolean().optional() }))
    .query(({ input }) => obterAcessos(input.dias, { forcar: input.forcar })),
});

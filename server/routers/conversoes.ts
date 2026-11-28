/** Router: painel de rastreamento e vendas (admin). Ver server/conversoes.ts. */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { configuracaoDeRastreamento, painelDeVendas } from "../conversoes";

export const conversoesRouter = router({
  configuracao: adminProcedure.query(() => configuracaoDeRastreamento()),
  vendas: adminProcedure
    .input(z.object({ dias: z.number().int().min(7).max(365).default(30) }))
    .query(({ input }) => painelDeVendas(input.dias)),
});

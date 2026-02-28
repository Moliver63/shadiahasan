import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // FIX: autenticação é opcional para rotas públicas — não re-lança o erro.
    // O sdk.authenticateRequest lança ForbiddenError quando não há sessão válida,
    // o que é comportamento esperado para visitantes não autenticados.
    // Procedures protegidas devem verificar ctx.user e lançar erro elas mesmas.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

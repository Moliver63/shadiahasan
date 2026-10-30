/** Correção no banco dos planos com acento quebrado. As funções puras ficam em shared/acentos.ts. */
import { eq } from "drizzle-orm";
import * as db from "./db";
import { subscriptionPlans } from "../drizzle/schema";
import { consertarPlano, temAcentoQuebrado } from "../shared/acentos";

export { consertarAcentos, consertarPlano, temAcentoQuebrado } from "../shared/acentos";

/** Corrige de vez no banco os planos com acento quebrado. Idempotente; roda na subida do servidor. */
export async function consertarPlanosNoBanco(): Promise<number> {
  const d = await db.getDb();
  if (!d) return 0;
  const planos = await d
    .select({ id: subscriptionPlans.id, name: subscriptionPlans.name, description: subscriptionPlans.description, features: subscriptionPlans.features })
    .from(subscriptionPlans);
  let corrigidos = 0;
  for (const p of planos) {
    if (![p.name, p.description, p.features].some(temAcentoQuebrado)) continue;
    const c = consertarPlano(p);
    await d.update(subscriptionPlans).set({ name: c.name, description: c.description, features: c.features }).where(eq(subscriptionPlans.id, p.id));
    corrigidos++;
  }
  if (corrigidos) console.log(`[textoCorrigido] ${corrigidos} plano(s) com acento quebrado corrigido(s)`);
  return corrigidos;
}

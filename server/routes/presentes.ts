/**
 * GET /api/presentes/:collectionId/:arquivo — presente do Programa (ver shared/presentes.ts).
 * Só entrega para quem pode: admin, quem comprou o Programa (compra ativa) ou
 * assinante Premium/VIP ativo. Quem fez só o teste de 1 aula não recebe.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { sdk } from "../_core/sdk";
import { podeReceberPresente } from "../programaVenda";
import { presenteDoPrograma } from "../../shared/presentes";

const router = Router();

function caminhoDoArquivo(nome: string): string | null {
  const bases = [process.cwd(), path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")];
  for (const base of bases) {
    for (const rel of [`server/assets/presentes/${nome}`, `assets/presentes/${nome}`]) {
      const p = path.join(base, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

router.get("/presentes/:collectionId/:arquivo", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const collectionId = Number(req.params.collectionId);
  const presente = Number.isInteger(collectionId) ? presenteDoPrograma(collectionId) : null;
  if (!presente || presente.arquivo !== req.params.arquivo) return res.status(404).type("text/plain").send("Material não encontrado.");

  let usuario;
  try {
    usuario = await sdk.authenticateRequest(req);
  } catch {
    return res.redirect(302, `/login?next=${encodeURIComponent(`/collections/${collectionId}`)}`);
  }
  if (!(await podeReceberPresente(usuario.id, usuario.role, collectionId))) {
    return res.status(403).type("text/plain").send("Este material é um presente para quem tem o programa.");
  }
  const arquivo = caminhoDoArquivo(presente.arquivo);
  if (!arquivo) return res.status(404).type("text/plain").send("Material não encontrado.");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${presente.arquivo}"`);
  fs.createReadStream(arquivo).pipe(res);
});

export default router;

/**
 * GET /cursos: página de vendas com os quatro cursos, a aula de entrada (R$ 19,90) e os planos.
 * Página estática (server/assets/paginas/cursos.html), pública. Os botões levam à oferta da home
 * (/#experimente-uma-aula), onde acontece a compra. O prazo de acesso exibido ("7 dias") está fixo
 * no HTML (DIAS_DE_ACESSO); se TRIAL_VALID_DAYS mudar em produção, ajuste lá.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

let modelo: string | null = null;
function lerModelo(): string | null {
  if (modelo) return modelo;
  const bases = [process.cwd(), path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")];
  for (const base of bases) {
    for (const rel of ["server/assets/paginas/cursos.html", "assets/paginas/cursos.html"]) {
      const p = path.join(base, rel);
      if (fs.existsSync(p)) return (modelo = fs.readFileSync(p, "utf8"));
    }
  }
  return null;
}

router.get("/cursos", (_req, res) => {
  const html = lerModelo();
  if (!html) return res.status(404).type("text/plain").send("Página não encontrada.");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.type("html").send(html);
});

export default router;

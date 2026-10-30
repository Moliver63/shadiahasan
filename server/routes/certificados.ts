/**
 * GET /api/certificados/<numero>.pdf — baixa o PDF do certificado.
 * Só o dono (ou um admin) baixa. A página pública de verificação mostra os
 * dados, mas o PDF leva o nome completo do aluno, então exige sessão.
 */
import { Router } from "express";
import { sdk } from "../_core/sdk";
import { siteUrl } from "../_core/emailLayout";
import { buscarPorNumero, nomeValido, numeroValido } from "../certificados";
import { gerarPdfCertificado } from "../certificadoPdf";

const router = Router();

router.get("/certificados/:arquivo", async (req, res) => {
  const numero = String(req.params.arquivo || "").replace(/\.pdf$/i, "").toUpperCase();
  res.setHeader("Cache-Control", "private, no-store");
  if (!numeroValido(numero)) return res.status(404).type("text/plain").send("Certificado não encontrado.");

  let usuario;
  try {
    usuario = await sdk.authenticateRequest(req);
  } catch {
    return res.status(401).type("text/plain").send("Entre na sua conta para baixar o certificado.");
  }

  const c = await buscarPorNumero(numero);
  const admin = usuario.role === "admin" || usuario.role === "superadmin";
  if (!c || (c.userId !== usuario.id && !admin)) return res.status(404).type("text/plain").send("Certificado não encontrado.");

  const nome = nomeValido(c.nomeAluno);
  if (!nome) {
    return res.status(409).type("text/plain").send("Complete seu nome no perfil para ele aparecer no certificado e baixe de novo.");
  }

  try {
    const pdf = await gerarPdfCertificado({
      tipo: c.tipo, nomeAluno: nome, titulo: c.titulo, subtitulo: c.subtitulo, numero: c.numero,
      emitidoEm: c.emitidoEm, urlVerificacao: `${siteUrl()}/certificado/${c.numero}`,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificado-${c.numero}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error("[Certificados] PDF falhou:", e instanceof Error ? e.message : e);
    res.status(500).type("text/plain").send("Não foi possível gerar o PDF agora. Tente de novo em instantes.");
  }
});

export default router;

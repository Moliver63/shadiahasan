/**
 * Diário da Transformação online (presente de Pensamentos Automáticos).
 *
 *   GET  /diario               exercício grátis (Mapa dos pensamentos, 6 passos), público
 *   GET  /presentes/diario     diário completo, só para quem pode receber o presente
 *   POST /api/diario/mapa      manda o mapa do exercício grátis por e-mail (novidades só com consentimento)
 *   GET  /api/presentes/9/carta   carta agendada do aluno (data)
 *   POST /api/presentes/9/carta   agenda a carta para daqui a 6 meses
 *
 * As respostas do diário ficam no aparelho do aluno (localStorage). O servidor
 * só guarda a carta, por pedido explícito, até o envio.
 */
import { Router, type Request } from "express";
import fs from "node:fs";
import path from "node:path";
import { sdk } from "../_core/sdk";
import { agendarCarta, cartaAgendada, podeReceberPresente, ProgramaError } from "../programaVenda";
import { presenteDoPrograma } from "../../shared/presentes";

const PROGRAMA_DO_DIARIO = 9;
const router = Router();

let modelo: string | null = null;
function lerModelo(): string | null {
  if (modelo) return modelo;
  const bases = [process.cwd(), path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")];
  for (const base of bases) {
    for (const rel of ["server/assets/presentes/diario-online.html", "assets/presentes/diario-online.html"]) {
      const p = path.join(base, rel);
      if (fs.existsSync(p)) return (modelo = fs.readFileSync(p, "utf8"));
    }
  }
  return null;
}

function pagina(modo: "amostra" | "aluno"): string | null {
  const html = lerModelo();
  if (!html) return null;
  const voltar = modo === "aluno" ? { url: `/collections/${PROGRAMA_DO_DIARIO}`, txt: "Voltar ao programa" } : { url: "/", txt: "Ir para o site" };
  return html.replace('"__MODO__"', JSON.stringify(modo)).replace("__VOLTAR_URL__", voltar.url).replace("__VOLTAR_TXT__", voltar.txt);
}

async function usuarioDe(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

router.get("/diario", (_req, res) => {
  const html = pagina("amostra");
  if (!html) return res.status(404).send("Página não encontrada.");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.type("html").send(html);
});

router.get("/presentes/diario", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const u = await usuarioDe(req);
  if (!u) return res.redirect(302, `/login?next=${encodeURIComponent("/presentes/diario")}`);
  if (!presenteDoPrograma(PROGRAMA_DO_DIARIO) || !(await podeReceberPresente(u.id, u.role, PROGRAMA_DO_DIARIO))) {
    return res.redirect(302, `/collections/${PROGRAMA_DO_DIARIO}`);
  }
  const html = pagina("aluno");
  if (!html) return res.status(404).send("Página não encontrada.");
  res.type("html").send(html);
});

// ── Carta para a versão futura ──
router.get("/api/presentes/9/carta", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const u = await usuarioDe(req);
  if (!u) return res.status(401).json({ erro: "Entre na sua conta." });
  res.json(await cartaAgendada(u.id));
});

router.post("/api/presentes/9/carta", async (req, res) => {
  // JSON obrigatório: um formulário de outro site não consegue mandar sem CORS
  if (!req.is("application/json")) return res.status(415).json({ erro: "Formato inválido." });
  const u = await usuarioDe(req);
  if (!u) return res.status(401).json({ erro: "Entre na sua conta." });
  if (!(await podeReceberPresente(u.id, u.role, PROGRAMA_DO_DIARIO))) return res.status(403).json({ erro: "O diário é um presente de quem tem o programa." });
  try {
    res.json(await agendarCarta(u.id, String(req.body?.texto ?? "")));
  } catch (e) {
    const msg = e instanceof ProgramaError ? e.message : "Não deu para agendar agora.";
    res.status(e instanceof ProgramaError && e.code === "BAD_REQUEST" ? 400 : 500).json({ erro: msg });
  }
});

// ── Exercício grátis: mapa por e-mail ──
const envios = new Map<string, number[]>();
function dentroDoLimite(chave: string, max: number): boolean {
  const agora = Date.now();
  const lista = (envios.get(chave) ?? []).filter((t) => agora - t < 60 * 60 * 1000);
  if (lista.length >= max) return false;
  envios.set(chave, [...lista, agora]);
  if (envios.size > 5000) envios.clear();
  return true;
}

router.post("/api/diario/mapa", async (req, res) => {
  if (!req.is("application/json")) return res.status(415).json({ erro: "Formato inválido." });
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) || email.length > 254) return res.status(400).json({ erro: "Confira o e-mail digitado." });
  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0].trim();
  if (!dentroDoLimite(`ip:${ip}`, 5) || !dentroDoLimite(`email:${email}`, 3)) return res.status(429).json({ erro: "Muitos envios seguidos. Tente de novo mais tarde." });
  const mapa = Array.isArray(req.body?.mapa) ? req.body.mapa.slice(0, 6) : [];
  const linhas = mapa
    .map((m: any) => ({ titulo: String(m?.titulo ?? "").slice(0, 60), texto: String(m?.texto ?? "").slice(0, 2000) }))
    .filter((m: { titulo: string; texto: string }) => m.titulo);
  if (!linhas.length) return res.status(400).json({ erro: "O mapa está vazio." });

  try {
    const { enviarEmail } = await import("../_core/email");
    const L = await import("../_core/emailLayout");
    const tabela = linhas
      .map((m: { titulo: string; texto: string }, i: number) =>
        `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;color:#8b5fa8;font-weight:600;white-space:nowrap">0${i + 1} ${L.escapar(m.titulo)}</td><td style="padding:8px 0;color:#2b2b2b">${L.escapar(m.texto || "—").replace(/\r?\n/g, "<br>")}</td></tr>`)
      .join("");
    const html = L.layoutEmail({
      departamento: "atendimento",
      preheader: "Seu Mapa dos pensamentos automáticos, do jeito que você escreveu.",
      titulo: "Seu mapa dos pensamentos",
      corpo:
        L.p("Aqui está o mapa que você fez no exercício grátis do Diário da Transformação:") +
        `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px;line-height:1.5;margin:12px 0">${tabela}</table>` +
        L.p("Repare na virada entre a Resposta e a Outra leitura. É ali que a primeira interpretação deixa de mandar sozinha.") +
        L.p("Este exercício é a primeira página do diário que acompanha o programa Pensamentos Automáticos, da psicóloga Shadia Hasan.") +
        L.botao("Conhecer o programa", `${L.siteUrl()}/collections/${PROGRAMA_DO_DIARIO}`),
      motivo: "Você recebeu este e-mail porque pediu o seu mapa em shadiahasan.com/diario.",
    });
    const r = await enviarEmail({ departamento: "atendimento", para: email, assunto: "Seu mapa dos pensamentos automáticos", html });
    if (!r.success) return res.status(502).json({ erro: "Não deu para enviar agora. Tente de novo em instantes." });
    if (req.body?.aceitaNovidades === true) {
      const { registrarAutorizacao } = await import("../routers/marketing");
      void registrarAutorizacao({ email, nome: null, origem: "diario-gratis" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.warn("[Diário] mapa não enviado:", e instanceof Error ? e.message : e);
    res.status(500).json({ erro: "Não deu para enviar agora." });
  }
});

export default router;

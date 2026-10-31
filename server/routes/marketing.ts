/**
 * Páginas públicas do e-mail marketing: confirmar inscrição e cancelar inscrição.
 *
 * Confirmar e cancelar passam por uma tela com botão (POST). Abrir o link (GET) nunca
 * muda nada: antivírus e leitores de e-mail abrem todos os links sozinhos, e isso
 * confirmaria ou cancelaria inscrições sem a pessoa ver.
 *
 * Exceção: o cancelamento com um clique do Gmail/Apple Mail (cabeçalho List-Unsubscribe-Post)
 * chega como POST e cancela direto, como esses clientes esperam.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { confirmarContato, contatoPorToken, descadastrarContato, tokenValido } from "../marketing";
import { escapar, MARCA, siteUrl } from "../_core/emailLayout";

const router = Router();

const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Muitas tentativas. Aguarde alguns minutos.",
});

export function paginaSimples(titulo: string, corpoHtml: string): string {
  const site = siteUrl();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapar(titulo)} | Shadia Hasan</title>
<style>
body{margin:0;background:${MARCA.papel};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${MARCA.texto};}
main{max-width:480px;margin:0 auto;padding:48px 20px;}
.cartao{background:#fff;border:1px solid ${MARCA.linha};border-radius:12px;padding:32px 28px;}
h1{font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.3;color:${MARCA.azul};margin:0 0 14px;}
p{font-size:16px;line-height:1.65;margin:0 0 16px;}
button,a.botao{display:inline-block;background:${MARCA.azul};color:#fff;border:0;border-radius:8px;padding:14px 26px;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;}
a{color:${MARCA.verde};}
.logo{text-align:center;margin-bottom:22px;}
.suave{color:${MARCA.suave};font-size:14px;}
</style></head><body><main>
<div class="logo"><a href="${escapar(site)}"><img src="/logo.png" alt="Shadia Hasan" width="120" height="120" style="width:120px;height:auto;"></a></div>
<div class="cartao">${corpoHtml}</div>
<p class="suave" style="text-align:center;margin-top:18px;"><a href="${escapar(site)}">Voltar ao site</a></p>
</main></body></html>`;
}

const invalido = () =>
  paginaSimples(
    "Link inválido",
    `<h1>Este link não é válido</h1><p>Ele pode ter sido copiado incompleto ou ser um e-mail de teste. Se você quer parar de receber nossos e-mails, responda a qualquer mensagem pedindo o cancelamento e cuidamos disso.</p>`,
  );

function tokenDe(req: Request): string {
  const t = (req.query.t ?? (req.body && (req.body as any).t)) as unknown;
  return tokenValido(t) ? t : "";
}

// ── Cancelar ────────────────────────────────────────────────────────────────
router.get("/marketing/sair", limite, async (req: Request, res: Response) => {
  const token = tokenDe(req);
  const c = token ? await contatoPorToken(token) : null;
  if (!c) return res.status(404).type("html").send(invalido());
  if (c.descadastrado) {
    return res.type("html").send(paginaSimples("Inscrição cancelada", `<h1>Sua inscrição já foi cancelada</h1><p>O endereço <strong>${escapar(c.email)}</strong> não recebe mais novidades e ofertas.</p>`));
  }
  res.type("html").send(
    paginaSimples(
      "Cancelar inscrição",
      `<h1>Cancelar inscrição?</h1><p>Você deixará de receber novidades e ofertas em <strong>${escapar(c.email)}</strong>. E-mails sobre sua conta e seus pagamentos continuam chegando normalmente.</p>
<form method="post" action="/api/marketing/sair?t=${encodeURIComponent(token)}"><button type="submit">Sim, cancelar inscrição</button></form>`,
    ),
  );
});

router.post("/marketing/sair", limite, async (req: Request, res: Response) => {
  const token = tokenDe(req);
  const ok = token ? await descadastrarContato(token) : false;
  // Cliente de e-mail (um clique) só quer o status; navegador recebe a página.
  if (req.is("application/x-www-form-urlencoded") && (req.body as any)?.["List-Unsubscribe"] === "One-Click") {
    return res.status(ok ? 200 : 404).send(ok ? "ok" : "link inválido");
  }
  if (!ok) return res.status(404).type("html").send(invalido());
  res.type("html").send(paginaSimples("Inscrição cancelada", `<h1>Pronto, inscrição cancelada</h1><p>Você não receberá mais novidades e ofertas. Se mudar de ideia, é só se inscrever de novo pelo site.</p>`));
});

// ── Confirmar ───────────────────────────────────────────────────────────────
router.get("/marketing/confirmar", limite, async (req: Request, res: Response) => {
  const token = tokenDe(req);
  const c = token ? await contatoPorToken(token) : null;
  if (!c) return res.status(404).type("html").send(invalido());
  if (c.confirmado && !c.descadastrado) {
    return res.type("html").send(paginaSimples("Inscrição confirmada", `<h1>Sua inscrição já está confirmada</h1><p>O endereço <strong>${escapar(c.email)}</strong> vai receber as novidades da Shadia.</p>`));
  }
  res.type("html").send(
    paginaSimples(
      "Confirmar inscrição",
      `<h1>Confirmar inscrição</h1><p>Confirme para receber novidades, conteúdos e ofertas da Shadia Hasan em <strong>${escapar(c.email)}</strong>. Você pode cancelar quando quiser, por um link em cada e-mail.</p>
<form method="post" action="/api/marketing/confirmar?t=${encodeURIComponent(token)}"><button type="submit">Confirmar minha inscrição</button></form>`,
    ),
  );
});

router.post("/marketing/confirmar", limite, async (req: Request, res: Response) => {
  const token = tokenDe(req);
  const ok = token ? await confirmarContato(token) : false;
  if (!ok) return res.status(404).type("html").send(invalido());
  res.type("html").send(paginaSimples("Inscrição confirmada", `<h1>Inscrição confirmada</h1><p>Obrigada! A partir de agora você recebe as novidades da Shadia por e-mail.</p>`));
});

export default router;

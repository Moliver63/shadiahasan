/**
 * routes.ts — Rotas de autenticação OAuth (Google e Apple)
 * Localização: server/auth/routes.ts
 *
 * Apple Sign In: desativado temporariamente — responde com mensagem amigável
 * Google Sign In: ativo e funcionando
 */

import { Router, Request, Response, NextFunction } from 'express';
import passport from './passport.js';
import { COOKIE_NAME, ONE_YEAR_MS } from '@shared/const';
import { getSessionCookieOptions } from '../_core/cookies.js';
import { assinarSessao, lerSessao, sessaoValidaPara } from '../_core/sessionCookie.js';
import { ehHostTecnico, emitirPasseDeLogin, hostCanonico, lerPasseDeLogin } from '../_core/canonicalHost.js';
import { getDb, getUserById } from '../db.js';
import { destinoSeguro, usarLinkDeAcesso } from '../linkDeAcesso.js';

const router = Router();

// ============ GOOGLE OAUTH ============

router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  console.log('[Google OAuth] Step 1: Iniciando fluxo OAuth');
  // ?next=/lesson/12 volta para a aula depois do login. Vai no `state` do
  // OAuth porque o callback cai no domínio técnico do Render, que não lê
  // cookie do domínio do site. Só caminho interno (destinoSeguro).
  const destino = typeof req.query.next === 'string' ? destinoSeguro(req.query.next) : null;
  passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email'],
    ...(destino && destino !== '/minha-area' ? { state: destino } : {}),
  } as any)(req, res, next);
});

router.get(
  '/google/callback',

  (req: Request, res: Response, next: NextFunction) => {
    console.log('[Google OAuth] Step 2: Callback recebido do Google');
    console.log('[Google OAuth] Query params:', {
      code: req.query.code ? 'presente' : 'ausente',
      scope: req.query.scope,
      error: req.query.error,
    });

    if (req.query.error) {
      console.error('[Google OAuth] Erro retornado pelo Google:', req.query.error);
      return res.redirect(`/login?error=google_${req.query.error}`);
    }

    next();
  },

  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'google',
      { session: false },
      (err: Error | null, user: any, info: any) => {
        if (err) {
          console.error('[Google OAuth] Erro no Passport:', err.message);
          return res.redirect('/login?error=passport_error');
        }
        if (!user) {
          console.error('[Google OAuth] Sem usuário retornado. Info:', info);
          return res.redirect('/login?error=google_auth_failed');
        }

        console.log('[Google OAuth] Step 3: Autenticado:', {
          id: user.id,
          email: user.email,
          role: user.role,
        });

        req.user = user;
        next();
      }
    )(req, res, next);
  },

  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (!user) {
        console.error('[Google OAuth] req.user vazio no handler final');
        return res.redirect('/login?error=no_user');
      }

      const userData = {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role,
      };

      const pedido = typeof req.query.state === 'string' && req.query.state.startsWith('/') ? destinoSeguro(req.query.state) : null;
      const redirectUrl = pedido ?? (user.role === 'admin' || user.role === 'superadmin' ? '/admin' : '/minha-area');

      // Google devolve no domínio técnico do Render (GOOGLE_CALLBACK_URL). A
      // sessão tem que nascer no domínio do site, senão o aluno fica logado
      // num endereço e deslogado no outro. Ver _core/canonicalHost.ts.
      const canonico = hostCanonico();
      if (ehHostTecnico(req.headers.host, canonico)) {
        const passe = await emitirPasseDeLogin(user.id, redirectUrl);
        console.log('[Google OAuth] Step 4: passe de login emitido para o domínio', canonico);
        return res.redirect(`https://${canonico}/api/auth/handoff?t=${encodeURIComponent(passe)}`);
      }

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, await assinarSessao({ id: user.id, email: user.email }), {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log('[Google OAuth] Step 4: Cookie definido para:', userData.email);

      console.log('[Google OAuth] Step 5: Redirecionando para:', redirectUrl);
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('[Google OAuth] Erro no handler final:', error);
      res.redirect('/login?error=auth_error');
    }
  }
);

// ============ APPLE SIGN IN — TEMPORARIAMENTE INDISPONÍVEL ============
// Requer conta Apple Developer ($99/ano): https://developer.apple.com
// Quando disponível, configure no .env:
//   APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY

router.get('/apple', (_req: Request, res: Response) => {
  console.log('[Apple OAuth] Tentativa de login — Apple Sign In ainda nao disponivel');
  // Redireciona para login com mensagem amigável ao usuário
  res.redirect('/login?error=apple_coming_soon');
});

router.post('/apple/callback', (_req: Request, res: Response) => {
  console.log('[Apple OAuth] Callback recebido — Apple Sign In ainda nao disponivel');
  res.redirect('/login?error=apple_coming_soon');
});

// ============ PASSE DE LOGIN ENTRE DOMÍNIOS ============
// Recebe o passe de 2 minutos emitido no callback do Google (domínio técnico)
// e cria a sessão aqui, no domínio do site. Cada passe vale uma vez.
const passesUsados = new Map<string, number>();
router.get('/handoff', async (req: Request, res: Response) => {
  const token = typeof req.query.t === 'string' ? req.query.t : undefined;
  const passe = await lerPasseDeLogin(token);
  const agora = Date.now();
  passesUsados.forEach((exp, k) => { if (exp < agora) passesUsados.delete(k); });
  if (!passe || !token || passesUsados.has(token)) return res.redirect('/login?error=google_auth_failed');
  passesUsados.set(token, agora + 5 * 60_000);
  const user = await getUserById(passe.userId);
  if (!user?.email) return res.redirect('/login?error=no_user');
  res.cookie(COOKIE_NAME, await assinarSessao({ id: user.id, email: user.email }), {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(passe.destino);
});

// ============ LINK DE ACESSO (entrar pelo e-mail) ============
// GET só mostra um botão; quem entra é o POST. Assim, antivírus de e-mail que
// "abrem" os links para conferir (Outlook/Defender fazem isso) não gastam o
// link de uso único antes da pessoa. Ver server/linkDeAcesso.ts.
router.get('/link', (req: Request, res: Response) => {
  const t = typeof req.query.t === 'string' ? req.query.t : '';
  const seguro = t.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Entrar - Shadia Hasan</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F5F2EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#24303A;padding:24px;box-sizing:border-box}
main{background:transparent;max-width:380px;width:100%;padding:32px 28px;text-align:center}
img{width:150px;height:auto}h1{font-family:Georgia,serif;font-weight:normal;color:#0B3354;font-size:24px;margin:18px 0 8px}p{color:#5B6770;line-height:1.5;margin:0 0 24px}
button{width:100%;height:56px;border:0;border-radius:8px;background:#0B3354;color:#fff;font-size:18px;font-weight:600;cursor:pointer}</style></head>
<body><main><img src="/email/logo-email.png" alt="Shadia Hasan"><h1>Entrar na sua conta</h1><p>Toque no botão para entrar e assistir.</p>
<form method="post" action="/api/auth/link"><input type="hidden" name="t" value="${seguro}"><button type="submit">Entrar e assistir</button></form></main></body></html>`);
});

router.post('/link', async (req: Request, res: Response) => {
  const t = typeof req.body?.t === 'string' ? req.body.t : '';
  try {
    const r = await usarLinkDeAcesso(t);
    if (!r) return res.redirect(303, '/login?error=link_invalido');
    // Sessão normal (não provisória): o link provou que o e-mail é da pessoa
    res.cookie(COOKIE_NAME, await assinarSessao({ id: r.userId, email: r.email }), {
      ...getSessionCookieOptions(req),
      maxAge: ONE_YEAR_MS,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(303, r.destino);
  } catch (e) {
    console.error('[LinkDeAcesso] falha:', e instanceof Error ? e.message : e);
    return res.redirect(303, '/login?error=link_invalido');
  }
});

// Pedido de link pela tela de entrar. Responde sempre igual (não revela se o
// e-mail tem conta) e limita tentativas por IP e por e-mail.
const pedidosDeLink = new Map<string, number[]>();
function permitirPedido(chave: string, limite: number, janelaMs: number) {
  const agora = Date.now();
  const lista = (pedidosDeLink.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (lista.length >= limite) { pedidosDeLink.set(chave, lista); return false; }
  lista.push(agora);
  pedidosDeLink.set(chave, lista);
  if (pedidosDeLink.size > 5000) pedidosDeLink.clear();
  return true;
}

router.post('/enviar-link', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
  const destino = destinoSeguro(typeof req.body?.next === 'string' ? req.body.next : '/minha-area');
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '?').split(',')[0].trim();
  const resposta = { ok: true, mensagem: 'Se este e-mail tiver conta, o link chega em instantes. Confira também o spam.' };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ ok: false, mensagem: 'E-mail inválido.' });
  if (!permitirPedido(`ip:${ip}`, 10, 60 * 60_000) || !permitirPedido(`email:${email}`, 3, 60 * 60_000)) {
    return res.status(429).json({ ok: false, mensagem: 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.' });
  }
  try {
    const d = await getDb();
    if (d) {
      const { encontrarContaPorEmail } = await import('../emailConta.js');
      const conta = await encontrarContaPorEmail(d, email);
      if (conta) {
        const { enviarLinkDeAcesso } = await import('../trialGuestEmail.js');
        await enviarLinkDeAcesso({ userId: conta.id, destino });
      }
    }
  } catch (e) {
    console.error('[LinkDeAcesso] pedido falhou:', e instanceof Error ? e.message : e);
  }
  return res.json(resposta);
});

// ============ STATUS E LOGOUT ============

router.get('/me', async (req: Request, res: Response) => {
  try {
    const sessao = await lerSessao(req.cookies?.[COOKIE_NAME]);
    if (!sessao) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await getUserById(sessao.userId);
    if (!user || !sessaoValidaPara(sessao, user)) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (error) {
    res.status(401).json({ error: 'Invalid session' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ success: true });
});

export default router;

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

const router = Router();

// ============ GOOGLE OAUTH ============

router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  console.log('[Google OAuth] Step 1: Iniciando fluxo OAuth');
  passport.authenticate('google', {
    session: false,
    scope: ['profile', 'email'],
  })(req, res, next);
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

  (req: Request, res: Response) => {
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

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, JSON.stringify(userData), {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log('[Google OAuth] Step 4: Cookie definido para:', userData.email);

      const redirectUrl = user.role === 'admin' ? '/admin' : '/courses';
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

// ============ STATUS E LOGOUT ============

router.get('/me', (req: Request, res: Response) => {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = JSON.parse(raw);
    if (!user?.id || !user?.email) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    res.json(user);
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

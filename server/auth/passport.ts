/**
 * passport.ts — Configuração das estratégias OAuth (Google e Apple)
 * Localização: server/auth/passport.ts
 *
 * CORREÇÕES:
 * 1. dotenv.config() chamado localmente — garante que process.env esteja
 *    populado mesmo com ESM hoisting (imports executados antes do código)
 * 2. proxy: true — necessário atrás de Nginx/reverse proxy em produção
 */

import { config } from 'dotenv';
config(); // Garante .env carregado antes de ler process.env abaixo

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// @ts-ignore
import { Strategy as AppleStrategy } from 'passport-apple';
import { findOrCreateUserByProvider } from '../db.js';

// ============ DIAGNÓSTICO ============

console.log('[Passport] Verificando credenciais Google OAuth:', {
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
});

// ============ GOOGLE OAUTH ============

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('[Passport] Registrando estratégia Google OAuth...');

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email'],
        proxy: true, // necessário atrás de Nginx em produção
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('[Google OAuth] Troca de token bem-sucedida');
          console.log('[Google OAuth] Profile ID:', profile.id);
          console.log('[Google OAuth] displayName:', profile.displayName);

          const email = profile.emails?.[0]?.value;
          if (!email) {
            console.error('[Google OAuth] Email não encontrado no perfil');
            return done(new Error('No email found in Google profile'));
          }

          console.log('[Google OAuth] Email:', email);
          console.log('[Google OAuth] Buscando/criando usuário no banco...');

          const user = await findOrCreateUserByProvider({
            provider: 'google',
            providerId: profile.id,
            email,
            name: profile.displayName || email.split('@')[0],
          });

          console.log('[Google OAuth] Usuário pronto:', {
            id: user.id,
            email: user.email,
            role: user.role,
          });

          return done(null, user);
        } catch (error: any) {
          console.error('[Google OAuth] Erro na estratégia:', {
            message: error.message,
            code: error.code,
          });
          return done(error as Error);
        }
      }
    )
  );

  console.log('[Passport] Estratégia Google OAuth registrada com sucesso');
} else {
  console.warn('[Passport] Google OAuth NAO configurado — verifique GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env');
}

// ============ APPLE SIGN IN ============

if (
  process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY
) {
  console.log('[Passport] Registrando estratégia Apple Sign In...');

  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        callbackURL: process.env.APPLE_CALLBACK_URL || '/api/auth/apple/callback',
        scope: ['name', 'email'],
        passReqToCallback: false,
      },
      async (accessToken: string, refreshToken: any, idToken: any, profile: any, done: any) => {
        try {
          const email = profile.email;
          if (!email) return done(new Error('No email found in Apple profile'));

          const name = profile.name
            ? `${profile.name.firstName || ''} ${profile.name.lastName || ''}`.trim()
            : email.split('@')[0];

          const user = await findOrCreateUserByProvider({
            provider: 'apple',
            providerId: profile.sub,
            email,
            name,
          });

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  console.log('[Passport] Estratégia Apple Sign In registrada');
} else {
  console.log('[Passport] Apple Sign In nao configurado (opcional)');
}

// ============ SERIALIZAÇÃO (obrigatório mesmo sem session) ============

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser((id: number, done) => {
  done(null, { id }); // Não usado — autenticação via cookie JSON
});

export default passport;

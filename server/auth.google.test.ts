import { describe, it, expect } from 'vitest';
import passport from './auth/passport.js';

describe('Google OAuth Configuration', () => {
  it('should have Google strategy configured', () => {
    // Verificar se a estratégia Google foi registrada
    const strategies = (passport as any)._strategies;
    expect(strategies).toBeDefined();
    expect(strategies.google).toBeDefined();
  });

  it('should have required environment variables', () => {
    expect(process.env.GOOGLE_CLIENT_ID).toBeDefined();
    expect(process.env.GOOGLE_CLIENT_SECRET).toBeDefined();
    expect(process.env.GOOGLE_CALLBACK_URL).toBeDefined();
    
    // Verificar formato do Client ID
    expect(process.env.GOOGLE_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it('should have valid callback URL', () => {
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    expect(callbackUrl).toMatch(/^https:\/\//);
    expect(callbackUrl).toContain('/api/auth/google/callback');
  });
});

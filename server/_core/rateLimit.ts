import rateLimit from 'express-rate-limit';

/**
 * Rate limiter para endpoints de autenticação (login)
 * Limita a 5 tentativas a cada 15 minutos
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: 'Muitas tentativas de login. Por favor, tente novamente em 15 minutos.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Rate limiter para recuperação de senha
 * Limita a 3 tentativas a cada hora
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 tentativas
  message: 'Muitas solicitações de recuperação de senha. Por favor, tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter geral para API tRPC
 * Limita a 100 requisições por minuto por IP
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições
  message: 'Muitas requisições. Por favor, aguarde um momento.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para formulário de contato
 * Limita a 3 envios a cada hora
 */
export const contactFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 envios
  message: 'Muitos envios de formulário. Por favor, tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para criação de conta
 * Limita a 3 cadastros por hora por IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 cadastros
  message: 'Muitas tentativas de cadastro. Por favor, tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

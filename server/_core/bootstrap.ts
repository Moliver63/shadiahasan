/**
 * bootstrap.ts
 * DEVE SER O PRIMEIRO IMPORT em index.ts
 * Carrega variáveis de ambiente ANTES de qualquer outro módulo ser importado.
 *
 * Motivo: Em ESModules, todos os `import` são hoisted (içados) antes do código
 * ser executado. Isso significa que `import "dotenv/config"` no topo do index.ts
 * NÃO garante que o .env seja carregado antes dos outros módulos (como passport.ts)
 * serem inicializados. Este arquivo resolve isso usando require() síncrono.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

console.log('[Bootstrap] Environment variables loaded');
console.log('[Bootstrap] NODE_ENV:', process.env.NODE_ENV);
console.log('[Bootstrap] GOOGLE_CLIENT_ID present:', !!process.env.GOOGLE_CLIENT_ID);
console.log('[Bootstrap] GOOGLE_CLIENT_SECRET present:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('[Bootstrap] GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);

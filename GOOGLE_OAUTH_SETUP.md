# Google OAuth Setup Guide

## Variáveis de Ambiente Necessárias

As seguintes variáveis já estão configuradas automaticamente pelo sistema Manus:

### ✅ Configuradas Automaticamente
- `GOOGLE_CLIENT_ID` - ID do cliente Google OAuth
- `GOOGLE_CLIENT_SECRET` - Secret do cliente Google OAuth  
- `GOOGLE_CALLBACK_URL` - URL de callback (https://shadiahasan.club/api/auth/google/callback)
- `JWT_SECRET` - Secret para assinatura de tokens JWT
- `DATABASE_URL` - String de conexão com o banco de dados
- `SITE_URL` - URL base do site (https://shadiahasan.club)
- `NODE_ENV` - Ambiente (production/development)

## Configuração no Google Cloud Console

### 1. Criar Projeto no Google Cloud Console
1. Acesse https://console.cloud.google.com/
2. Crie um novo projeto ou selecione um existente
3. Ative a API "Google+ API" ou "Google Identity"

### 2. Configurar OAuth Consent Screen
1. Vá em "APIs & Services" → "OAuth consent screen"
2. Escolha "External" (para usuários públicos)
3. Preencha:
   - App name: **Shadia Hasan Platform**
   - User support email: seu email
   - Developer contact: seu email
4. Adicione scopes: `email`, `profile`, `openid`
5. Salve e continue

### 3. Criar Credenciais OAuth 2.0
1. Vá em "APIs & Services" → "Credentials"
2. Clique em "Create Credentials" → "OAuth client ID"
3. Escolha "Web application"
4. Preencha:
   - Name: **Shadia Hasan Web Client**
   - Authorized JavaScript origins:
     - `https://shadiahasan.club`
     - `https://www.shadiahasan.club` (se usar www)
   - Authorized redirect URIs:
     - `https://shadiahasan.club/api/auth/google/callback`
     - `https://www.shadiahasan.club/api/auth/google/callback` (se usar www)
5. Clique em "Create"
6. Copie o **Client ID** e **Client Secret**

### 4. Configurar no Manus
1. Acesse o painel de Settings do projeto Manus
2. Vá em "Secrets" ou "Environment Variables"
3. Atualize:
   - `GOOGLE_CLIENT_ID` = seu Client ID
   - `GOOGLE_CLIENT_SECRET` = seu Client Secret

## Fluxo de Autenticação

```
1. Usuário clica "Entrar com Google" → /api/auth/google
2. Redireciona para Google OAuth
3. Google autentica usuário
4. Google redireciona para → /api/auth/google/callback?code=...
5. Backend troca code por tokens (access_token)
6. Backend busca perfil do usuário (email, nome)
7. Backend cria/atualiza usuário no banco (UPSERT)
8. Backend gera JWT e seta cookie (auth_token)
9. Backend redireciona para /courses (ou /admin se admin)
```

## Logs de Debugging

O sistema agora possui logs detalhados em cada etapa:

```
[Google OAuth] Step 1: Token exchange successful
[Google OAuth] Step 2: Fetching user profile...
[Google OAuth] Step 3: Email extracted: user@example.com
[Google OAuth] Step 4: Finding or creating user in database...
[OAuth] findOrCreateUserByProvider - Start
[OAuth] Checking if user exists by email...
[OAuth] Creating new user... (ou) Returning existing user
[Google OAuth] Step 5: User ready
[OAuth Callback] Step 6: Received callback from Google
[OAuth Callback] Step 7: Passport authentication completed
[OAuth Callback] Step 8: Generating JWT token...
[OAuth Callback] Step 9: JWT token generated successfully
[OAuth Callback] Step 10: Cookie set with options
[OAuth Callback] Step 11: Redirecting to: /courses
```

## Checklist de Teste

### Desenvolvimento (localhost:3000)
- [ ] Criar credenciais OAuth separadas para desenvolvimento
- [ ] Adicionar `http://localhost:3000/api/auth/google/callback` nas redirect URIs
- [ ] Testar login com Google
- [ ] Verificar cookie `auth_token` no DevTools
- [ ] Verificar redirecionamento para /courses

### Produção (shadiahasan.club)
- [ ] Verificar que `GOOGLE_CALLBACK_URL=https://shadiahasan.club/api/auth/google/callback`
- [ ] Verificar que redirect URI no Google Console bate EXATAMENTE
- [ ] Testar login com Google em produção
- [ ] Verificar logs do servidor para erros
- [ ] Verificar cookie `auth_token` (secure=true, httpOnly=true, domain=.shadiahasan.club)
- [ ] Verificar que `trust proxy` está ativado (logs mostram "[Express] Trust proxy enabled")
- [ ] Testar com usuário novo (criar conta)
- [ ] Testar com usuário existente (login)
- [ ] Testar logout e re-login

## Troubleshooting

### Erro: "redirect_uri_mismatch"
- **Causa**: URL de callback não bate com Google Console
- **Solução**: Verifique que `https://shadiahasan.club/api/auth/google/callback` está EXATAMENTE nas redirect URIs

### Erro 500 no callback
- **Causa**: Erro no banco de dados ou JWT
- **Solução**: Verifique logs do servidor, procure por `[OAuth Callback] ERROR`

### Cookie não persiste
- **Causa**: `secure: true` em HTTP ou `trust proxy` não configurado
- **Solução**: Verifique que `NODE_ENV=production` e `trust proxy` está ativado

### Email duplicado
- **Causa**: Email já existe no banco
- **Solução**: Sistema agora normaliza email (lowercase) e faz UPSERT automático

## Correções Implementadas

✅ **Trust proxy** ativado para HTTPS em produção  
✅ **Logs detalhados** em todas as etapas do OAuth  
✅ **Normalização de email** (lowercase + trim)  
✅ **UPSERT automático** (find-or-create)  
✅ **Cookie domain** configurado (`.shadiahasan.club`)  
✅ **Tratamento de erros** com redirect para /login?error=...  
✅ **Stacktrace** completo nos logs (sem expor tokens)  

# OAuth Setup Guide - Google & Apple

Este guia explica como configurar autenticação OAuth com Google e Apple para a plataforma Shadia Hasan.

## 📋 Visão Geral

A plataforma agora suporta três métodos de autenticação:
1. **Email/Senha** (existente)
2. **Google OAuth 2.0** (novo)
3. **Sign in with Apple** (novo)

### Account Linking
O sistema implementa **account linking automático**: se um usuário fizer login com Google/Apple usando o mesmo email de uma conta existente, as contas serão vinculadas automaticamente.

---

## 🔧 Configuração Local

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no painel de **Settings → Secrets** do Manus:

#### Google OAuth
```
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

#### Apple Sign In
```
APPLE_CLIENT_ID=com.shadiahasan.service
APPLE_TEAM_ID=SEU_TEAM_ID
APPLE_KEY_ID=SEU_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA\n-----END PRIVATE KEY-----
APPLE_CALLBACK_URL=http://localhost:3000/api/auth/apple/callback
```

---

## 🌐 Google Cloud Console Setup

### Passo 1: Criar Projeto
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google+ API**

### Passo 2: Configurar OAuth Consent Screen
1. Vá em **APIs & Services → OAuth consent screen**
2. Escolha **External** (para usuários públicos)
3. Preencha:
   - **App name**: Shadia Hasan - Psicologia & Desenvolvimento Humano
   - **User support email**: seu-email@shadiahasan.club
   - **Developer contact**: seu-email@shadiahasan.club
4. Adicione escopos:
   - `userinfo.email`
   - `userinfo.profile`
5. Salve e continue

### Passo 3: Criar Credenciais OAuth
1. Vá em **APIs & Services → Credentials**
2. Clique em **Create Credentials → OAuth 2.0 Client ID**
3. Escolha **Web application**
4. Configure:
   - **Name**: Shadia Hasan Web App
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (desenvolvimento)
     - `https://shadiahasan.club` (produção)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/google/callback` (desenvolvimento)
     - `https://shadiahasan.club/api/auth/google/callback` (produção)
5. Copie o **Client ID** e **Client Secret**

### Passo 4: Publicar App (Opcional)
- Para remover a tela de "App não verificado", solicite verificação do Google
- Enquanto isso, adicione emails de teste em **OAuth consent screen → Test users**

---

## 🍎 Apple Developer Setup

### Passo 1: Criar App ID
1. Acesse [Apple Developer](https://developer.apple.com/account/)
2. Vá em **Certificates, Identifiers & Profiles**
3. Clique em **Identifiers → App IDs**
4. Crie um novo App ID:
   - **Description**: Shadia Hasan Platform
   - **Bundle ID**: `com.shadiahasan.web`
   - Habilite **Sign in with Apple**

### Passo 2: Criar Service ID
1. Vá em **Identifiers → Services IDs**
2. Crie um novo Service ID:
   - **Description**: Shadia Hasan Web Service
   - **Identifier**: `com.shadiahasan.service` (use este como `APPLE_CLIENT_ID`)
   - Habilite **Sign in with Apple**
3. Configure:
   - **Primary App ID**: selecione o App ID criado acima
   - **Domains and Subdomains**:
     - `shadiahasan.club`
     - `localhost` (para desenvolvimento)
   - **Return URLs**:
     - `https://shadiahasan.club/api/auth/apple/callback`
     - `http://localhost:3000/api/auth/apple/callback`

### Passo 3: Criar Private Key
1. Vá em **Keys**
2. Clique em **Create a key**
3. Configure:
   - **Key Name**: Shadia Hasan Sign in with Apple Key
   - Habilite **Sign in with Apple**
   - Configure: selecione o Primary App ID
4. Baixe o arquivo `.p8` (você só pode baixar uma vez!)
5. Anote o **Key ID** (10 caracteres)

### Passo 4: Obter Team ID
1. No canto superior direito do Apple Developer, clique no seu nome
2. Copie o **Team ID** (10 caracteres alfanuméricos)

### Passo 5: Preparar Private Key
Abra o arquivo `.p8` baixado e copie todo o conteúdo, incluindo as linhas `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`.

**Importante**: Para usar em variáveis de ambiente, substitua quebras de linha por `\n`:
```
-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----
```

---

## 🚀 Deploy no Render

### Passo 1: Configurar Variáveis de Ambiente
No painel do Render, adicione todas as variáveis de ambiente listadas acima, **substituindo** as URLs de callback:

```
GOOGLE_CALLBACK_URL=https://shadiahasan.onrender.com/api/auth/google/callback
APPLE_CALLBACK_URL=https://shadiahasan.onrender.com/api/auth/apple/callback
```

### Passo 2: Atualizar URLs Autorizadas
- **Google Cloud Console**: Adicione `https://shadiahasan.onrender.com/api/auth/google/callback` nas Authorized redirect URIs
- **Apple Developer**: Adicione `https://shadiahasan.onrender.com/api/auth/apple/callback` nas Return URLs

### Passo 3: CORS e Cookies
O sistema já está configurado para:
- ✅ Cookies `httpOnly`, `Secure` (produção), `SameSite=Lax`
- ✅ CORS com `credentials: true`
- ✅ Proteção contra CSRF via state/nonce OAuth

---

## 🔒 Segurança

### Implementado
- ✅ Cookies httpOnly (não acessíveis via JavaScript)
- ✅ Cookies Secure em produção (apenas HTTPS)
- ✅ SameSite=Lax (proteção CSRF)
- ✅ Validação de state/nonce no OAuth
- ✅ Tokens JWT com expiração (7 dias)
- ✅ Sanitização de inputs
- ✅ Account linking seguro (por email)

### Recomendações
- 🔐 Mantenha `JWT_SECRET` forte e secreto
- 🔐 Nunca commite chaves privadas no Git
- 🔐 Use HTTPS em produção
- 🔐 Rotacione chaves periodicamente
- 🔐 Monitore logs de autenticação

---

## 🧪 Testes

### Desenvolvimento Local
1. Configure variáveis de ambiente
2. Inicie o servidor: `pnpm dev`
3. Acesse `http://localhost:3000/login`
4. Clique em "Continuar com Google" ou "Continuar com Apple"
5. Complete o fluxo OAuth
6. Verifique redirecionamento para `/courses` ou `/admin`

### Produção
1. Acesse `https://shadiahasan.club/login`
2. Teste ambos os provedores
3. Verifique que cookies estão sendo setados
4. Teste account linking (login com email, depois com OAuth)

---

## 🐛 Troubleshooting

### Erro: "redirect_uri_mismatch" (Google)
**Causa**: URL de callback não autorizada
**Solução**: Verifique que a URL exata está em **Authorized redirect URIs** no Google Cloud Console

### Erro: "invalid_client" (Apple)
**Causa**: Client ID ou Team ID incorretos
**Solução**: Verifique `APPLE_CLIENT_ID` e `APPLE_TEAM_ID`

### Erro: "invalid_grant" (Apple)
**Causa**: Private key inválida ou expirada
**Solução**: Gere nova chave no Apple Developer e atualize `APPLE_PRIVATE_KEY`

### Cookies não persistem
**Causa**: Domínio/SameSite incompatível
**Solução**: 
- Desenvolvimento: use `localhost` (não `127.0.0.1`)
- Produção: certifique-se que front e back estão no mesmo domínio

### Erro: "state mismatch"
**Causa**: Sessão expirou ou cookies bloqueados
**Solução**: 
- Verifique que cookies estão habilitados no navegador
- Não use modo anônimo/privado em navegadores que bloqueiam cookies de terceiros

---

## 📊 Fluxo de Autenticação

```
┌─────────┐                ┌──────────┐                ┌──────────┐
│ Cliente │                │  Server  │                │ Provider │
└────┬────┘                └────┬─────┘                └────┬─────┘
     │                          │                           │
     │  1. Clica "Login Google" │                           │
     ├─────────────────────────>│                           │
     │                          │  2. Redirect para Google  │
     │                          ├──────────────────────────>│
     │                          │                           │
     │  3. Usuário autentica    │                           │
     │<─────────────────────────┼───────────────────────────┤
     │                          │                           │
     │  4. Callback com code    │                           │
     ├─────────────────────────>│                           │
     │                          │  5. Troca code por token  │
     │                          ├──────────────────────────>│
     │                          │<──────────────────────────┤
     │                          │  6. Retorna perfil        │
     │                          │                           │
     │  7. Cria/atualiza user   │                           │
     │     Gera JWT             │                           │
     │     Seta cookie          │                           │
     │  8. Redirect /courses    │                           │
     │<─────────────────────────┤                           │
     │                          │                           │
```

---

## 📚 Recursos

- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Sign in with Apple Docs](https://developer.apple.com/sign-in-with-apple/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## ✅ Checklist de Implementação

- [x] Instalar dependências (passport, passport-google-oauth20, passport-apple)
- [x] Configurar Passport.js com estratégias
- [x] Criar rotas OAuth (/api/auth/google, /api/auth/apple)
- [x] Implementar callbacks com JWT
- [x] Adicionar botões OAuth na página de login
- [x] Implementar account linking
- [x] Configurar cookies httpOnly
- [x] Adicionar proteção CSRF (state/nonce)
- [ ] Configurar Google Cloud Console
- [ ] Configurar Apple Developer
- [ ] Testar fluxo completo local
- [ ] Testar fluxo completo produção
- [ ] Documentar troubleshooting

---

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verifique este guia de troubleshooting
2. Consulte os logs do servidor em `.manus-logs/devserver.log`
3. Verifique configurações no Google Cloud Console / Apple Developer
4. Entre em contato com o suporte técnico

---

**Última atualização**: 2026-02-16
**Versão**: 1.0.0

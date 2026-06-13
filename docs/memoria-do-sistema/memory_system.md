# Shadia Hasan — Memory System (Manutenção)

> Documento canônico de referência para manutenção humana e por IA.
> Última atualização: 2026-06-13.

---

## 1. Visão geral do projeto

- **Repositório**: <https://github.com/Moliver63/shadiahasan>
- **Produção**: <https://shadiahasan-2ngl.onrender.com>
- **Frontend**: React 19 + Vite 7 + TypeScript + TailwindCSS (`client/`)
- **Backend**: Express + tRPC 11 (`server/`)
- **ORM/DB**: Drizzle ORM + PostgreSQL (Render Postgres)
- **Deploy**: Render.com, build via `pnpm run build`

### Arquivos-fonte principais

```text
drizzle/schema.ts
server/routers.ts
server/routers/videos.ts
server/routers/subscriptions.ts
server/cloudflare-stream.ts
server/db.ts
client/src/components/DashboardLayout.tsx
client/src/pages/AdminCourseLessons.tsx
client/src/pages/AdminCourses.tsx
client/src/pages/AdminManageSubscriptions.tsx
client/src/pages/AdminUsers.tsx
client/src/pages/LessonView.tsx
VIDEO_UPLOAD_TROUBLESHOOTING.md
```

---

## 2. Banco de dados — pontos relevantes

### Tabela `lessons`

| Campo | Uso |
|---|---|
| `videoProvider` | provedor (`youtube`, `cloudflare`, etc.) |
| `videoAssetId` | UID do vídeo no Cloudflare Stream |
| `videoPlaybackUrl` | URL real de reprodução (YouTube ou manifest HLS) |
| `duration` | duração em segundos |
| `isAccessRestricted` | `0` grátis / `1` premium-avulso |
| `isPublished` | `0` rascunho / `1` publicado |

### Tabela `subscriptions`

| Campo | Uso |
|---|---|
| `userId` | usuário dono da assinatura |
| `plan` | `free`, `basic`, `premium`, `vip` |
| `status` | `active`, `paused`, `cancelled`, `expired`, `trial` |
| `startDate` | início da vigência |
| `endDate` | expiração/cancelamento efetivo |
| `trialEndDate` | fim do trial |
| `autoRenew` | renovação automática |
| `notes` | observações internas do admin |

### Observação importante

A listagem administrativa de assinaturas foi ajustada para vir de **todos os usuários**, com `leftJoin` em `subscriptions`, para permitir gerenciar também usuários **sem registro prévio de assinatura**. Isso é essencial para que o admin consiga ativar assinatura para qualquer usuário.

---

## 3. Vídeo — estado atual da implementação

## Upload de vídeo (Cloudflare Stream)

Fluxo atual:

1. Admin cria a aula em `client/src/pages/AdminCourseLessons.tsx`.
2. O frontend chama `videos.admin.createUploadUrl`.
3. Para arquivos grandes, o upload usa **TUS resumable upload** com `tus-js-client`.
4. Após upload, roda polling em `videos.admin.checkUploadStatus`.
5. Quando o vídeo fica pronto, a aplicação grava `videoPlaybackUrl` e `duration`.
6. Ao abrir a tela administrativa de aulas, `videos.admin.syncPendingVideos` faz reconciliação automática de vídeos pendentes.

### Correções aplicadas recentemente

- **`26d640f`** — sincronização de status do vídeo e exibição correta de duração
- **`6923e0a`** — uso da URL real de manifest do Cloudflare para playback
- **`c91eaf8`** — troca para **TUS** em uploads grandes do Cloudflare Stream
- **`4b3a0f7`** — mensagem amigável para frontend desatualizado pedindo refresh da página

### Playback / tela preta

Causa histórica do problema de tela preta:

- o player recebia uma URL HLS incorreta gerada localmente, o que resultava em `404 video.m3u8`;
- correção: priorizar `videoPlaybackUrl` real ou buscar o manifest correto via API Cloudflare;
- se `CLOUDFLARE_SIGNING_KEY_ID` e `CLOUDFLARE_SIGNING_KEY_PEM` não estiverem configurados, o sistema faz fallback para manifest público.

### Duração do vídeo

A duração é armazenada em `lessons.duration` em **segundos** e exibida no frontend com formatação completa (minutos/segundos, e horas quando necessário).

---

## 4. Assinaturas — regra de negócio atual

### Planos conhecidos

| Slug | Preço/mês | maxCourses | VR |
|---|---:|---:|---|
| `free` | R$0 | 1 | não |
| `basic` | R$49,90 | 3 | sim |
| `premium` | R$99,90 | ilimitado | sim |
| `vip` | R$299,90 | ilimitado | sim |

### Controle de acesso em vídeo premium

Regra principal em `server/routers/videos.ts` → `checkUserHasAccess`:

1. aula grátis (`isAccessRestricted = 0`) libera para todos;
2. compra avulsa concluída libera sempre;
3. assinatura ativa válida libera conforme plano;
4. assinatura expirada/cancelada/sem plano não libera conteúdo premium.

### Regra administrativa implementada

Agora o admin pode **ativar ou desativar assinatura de qualquer usuário** por dois caminhos:

1. **Tela dedicada**: `client/src/pages/AdminManageSubscriptions.tsx`
2. **Tela de usuários**: `client/src/pages/AdminUsers.tsx`

### Commits dessa entrega administrativa

- **`bd35af8`** — backend e listagem para ativar/desativar assinatura de qualquer usuário
- **`20ebb6f`** — alinhamento visual e operacional do frontend admin

---

## 5. Frontend admin — estado atual

### Sidebar / navegação

`client/src/components/DashboardLayout.tsx` foi alinhado para expor claramente:

- Dashboard
- Cursos
- Aulas
- Usuários
- Assinaturas
- Financeiro
- Planos
- Alunos
- Moderação
- Configurações

### Tela `AdminManageSubscriptions`

Estado atual:

- usa `DashboardLayout`
- segue o padrão visual de cards/tabela do admin
- lista usuários com e sem assinatura
- permite filtrar por plano/status
- permite **Ativar**, **Desativar**, **Editar** e ver **Pagamentos**

### Tela `AdminUsers`

Estado atual:

- exibe role, status do usuário, plano e status da assinatura
- permite ativar/desativar assinatura diretamente pelo menu de ações
- mantém ações de promover admin, remover admin, suspender e reativar usuário

---

## 6. Variáveis de ambiente críticas

### Cloudflare Stream

```env
CLOUDFLARE_ACCOUNT_ID=<account_id>
CLOUDFLARE_API_TOKEN=<token>
```

### Opcionais para signed URLs

```env
CLOUDFLARE_SIGNING_KEY_ID=<key_id>
CLOUDFLARE_SIGNING_KEY_PEM=<private_key_pem>
```

Se não configuradas, o sistema hoje usa fallback público para playback onde aplicável.

### Banco local / Drizzle

```env
DATABASE_URL=<render_external_database_url>?sslmode=require
```

---

## 7. Segurança e operação

### Regras obrigatórias

- nunca commitar tokens, senhas, JWTs ou arquivos de acesso operacional;
- qualquer token exposto deve ser revogado e regenerado;
- usar sempre a **External Database URL** do Render com `sslmode=require`;
- manter `.env` local para `pnpm db:push` e rotinas do Drizzle;
- não reverter a proteção que remove `videoPlaybackUrl` de respostas públicas quando o usuário não tem acesso.

### Alerta conhecido

Logs de ausência de `CLOUDFLARE_SIGNING_KEY_ID` / `PEM` não significam, por si só, quebra de playback se o fallback público estiver sendo usado corretamente. Ainda assim, para hardening de produção, configurar signed URLs continua recomendado.

---

## 8. Pendências atuais

### Já concluído

- [x] ativar/desativar assinatura para qualquer usuário no admin
- [x] alinhar frontend do admin para usuários/assinaturas
- [x] corrigir manifest HLS do Cloudflare
- [x] migrar upload grande para TUS
- [x] corrigir sincronização de duração e vídeos pendentes

### Ainda pendente

- [ ] UI no admin para `courses.allowIndividualPurchase`
- [ ] campo visual para preço avulso por curso
- [ ] checkout Stripe one-time para compra avulsa
- [ ] revisar aula 1 com `videoProvider` inconsistente (`cloudflare` vs YouTube)
- [ ] remover scripts de debug soltos na raiz (`*.py`, `*.mjs`)
- [ ] remover arquivos sensíveis do git (`chaveJWT.txt`, `SENHA_RENDER-ARQUIVOS.txt`)
- [ ] atualizar README principal (referências antigas a MySQL / Manus OAuth)
- [ ] validar finance/admin usando o mesmo padrão do backend de assinaturas recém-ajustado

---

## 9. Ordem recomendada para próximas manutenções

1. consolidar compra avulsa no admin + checkout;
2. revisar financeiro/admin para usar a mesma fonte de verdade de assinaturas;
3. revisar README e limpeza de arquivos sensíveis/debug;
4. configurar signed URLs do Cloudflare em produção;
5. auditoria final de UX do restante do admin (cursos, aulas, financeiro, moderação).

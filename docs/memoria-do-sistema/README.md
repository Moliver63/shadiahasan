# Shadia Hasan — Memória do Sistema (Manutenção)

> Documento de referência para manutenções futuras (humanas ou IA).  
> Última atualização: 2026-06-13.

-----

## 1. Stack e arquitetura

- **Frontend**: React 19 + Vite 7 + TypeScript + TailwindCSS (`client/`)
- **Backend**: Express + tRPC 11 (`server/`)
- **ORM/DB**: Drizzle ORM + PostgreSQL (Render Postgres)
- **Deploy**: Render.com (Web Service), build via `pnpm run build`
- **Repo**: <https://github.com/Moliver63/shadiahasan>
- **URL produção**: <https://shadiahasan-2ngl.onrender.com>

### Estrutura relevante

```text
drizzle/schema.ts           -- schema do banco (Drizzle)
server/routers.ts           -- router tRPC principal (appRouter)
server/routers/videos.ts    -- vídeos (Cloudflare/YouTube) + controle de acesso
server/routers/subscriptions.ts
server/cloudflare-stream.ts -- integração Cloudflare Stream
server/db.ts                -- getDb() async, helpers de query
client/src/pages/AdminCourseLessons.tsx -- admin: aulas + upload de vídeo
client/src/pages/AdminCourses.tsx       -- admin: cursos + capa
client/src/pages/LessonView.tsx         -- página da aula (player)
VIDEO_UPLOAD_TROUBLESHOOTING.md        -- runbook de upload de vídeo
```

-----

## 2. Sistema de Vídeo (YouTube + Cloudflare Stream)

### Campos da tabela `lessons` relevantes

| Campo | Significado |
|------|------|
| `videoProvider` | `"youtube"` \| `"cloudflare"` \| `"hls"` \| `"other"` |
| `videoAssetId` | UID do vídeo no Cloudflare Stream (quando `provider=cloudflare`) |
| `videoPlaybackUrl` | URL final de reprodução (YouTube URL ou HLS `.m3u8` do Cloudflare) |
| `duration` | duração em segundos |
| `isAccessRestricted` | `0` = grátis, `1` = exige assinatura/compra avulsa |
| `isPublished` | `0` = rascunho, `1` = visível no catálogo |

### Fluxo de upload (Cloudflare)

1. Admin seleciona arquivo → `videos.admin.createUploadUrl` gera URL de upload direto (sem passar pelo servidor).
2. Upload via `XMLHttpRequest` (`multipart/form-data`) direto para o Cloudflare.
3. Polling a cada 5s (`videos.admin.checkUploadStatus`) até `readyToStream=true`, preenchendo `videoPlaybackUrl`/`duration`.
4. **Self-healing**: ao abrir `/admin/courses/:id/lessons`, `videos.admin.syncPendingVideos` roda automaticamente e corrige qualquer aula com `videoAssetId` preenchido mas `videoPlaybackUrl` vazio (vídeos que ficaram “pendentes”).
5. Botão **“Sincronizar vídeos pendentes”** força isso manualmente.

Ver `VIDEO_UPLOAD_TROUBLESHOOTING.md` para diagnóstico SQL/curl.

### Variáveis de ambiente (Render)

```env
CLOUDFLARE_ACCOUNT_ID=<account_id>
CLOUDFLARE_API_TOKEN=<token com permissão "Edit Cloudflare Stream">
```

Cloudflare Stream precisa estar **ativado** na conta (Stream → Plans → “Images & Stream”, $0/mês base).

> ⚠️ **Segurança:** nunca registrar IDs sensíveis, emails operacionais, tokens ou segredos reais neste documento. Se qualquer token for exposto durante o desenvolvimento, revogue e gere outro imediatamente.

-----

## 3. Sistema de Assinaturas e Controle de Acesso

### Planos (`subscription_plans`, já populados)

| Slug | Preço/mês | maxCourses | hasVRAccess | Stripe Price ID (env) |
|------|------:|------:|------|------|
| `free` | R$0 | 1 | não | — |
| `basic` | R$49,90 | 3 | sim | `STRIPE_PRICE_BASICO` |
| `premium` | R$99,90 | ilimitado | sim | `STRIPE_PRICE_PREMIUM` |
| `vip` | R$299,90 | ilimitado | sim | `STRIPE_PRICE_VIP` |

### Regra de acesso (`server/routers/videos.ts` → `checkUserHasAccess`)

```text
isAccessRestricted = 0  → todos acessam (grátis)
isAccessRestricted = 1  → verifica em ordem:
  1. coursePurchases (compra avulsa, status=completed) → libera SEMPRE
  2. Plano ativo (subscriptions OU userSubscriptions+subscription_plans):
     - premium/vip → libera TUDO (cria enrollment automaticamente)
     - basic       → libera até `maxCourses` cursos PAGOS simultâneos
                      (matrícula automática via `enrollments`;
                       cursos gratuitos NÃO contam na cota)
     - free/sem plano → sem acesso (só avulso)
```

### Preço de compra avulsa (campo `courses.price`, em centavos)

Fórmula padrão sugerida: `Avulso = round(plano Básico × 0.6)` → R$29,90.  
Admin pode sobrescrever por curso. Campo `courses.allowIndividualPurchase` (0/1) liga/desliga a opção de compra avulsa por curso — **ainda sem UI no admin** (pendente).

### ⚠️ Segurança — NUNCA reverter

`lessons.listByCourse` e `lessons.getById` (rotas **públicas**) verificam `checkUserHasAccess` no servidor e **removem** `videoPlaybackUrl`/`videoAssetId` da resposta se o usuário não tiver acesso. Isso evita que a URL real do vídeo seja exposta via API antes da verificação de pagamento. Não usar mais `enrollments.checkEnrollment` como gate de acesso — usar `videos.hasAccess`.

-----

## 4. Pendências conhecidas / próximos passos

- [ ] UI no admin para `courses.allowIndividualPurchase` + `price` avulso
- [ ] Checkout Stripe one-time payment para compra avulsa de curso
- [ ] Corrigir `videoProvider` da aula 1 (está `cloudflare` mas URL é YouTube)
- [ ] Limpar scripts de debug na raiz do repo (`*.py`, `*.mjs` soltos)
- [ ] Verificar/remover `chaveJWT.txt` e `SENHA_RENDER-ARQUIVOS.txt` do git
- [ ] README desatualizado (menciona MySQL/Manus OAuth; real = Postgres/Google OAuth)

-----

## 5. Credenciais e segurança — regras gerais

- **Nunca** colar tokens/senhas reais em conversas; se isso acontecer, revogar e gerar novos.
- Conexão direta ao banco (`psql`) usa a **External Database URL** do Render com `?sslmode=require`.
- `drizzle.config.ts` precisa do `.env` local com `DATABASE_URL` para rodar `pnpm db:push`.
- Evitar versionar arquivos com credenciais, chaves JWT, senhas operacionais ou dumps sensíveis.

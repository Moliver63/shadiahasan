# Shadia Hasan — Memória do Sistema (Manutenção)

> Resumo para manutenções futuras (humanas ou IA).
> Última atualização: 2026-10-23.
> **Arquivo canônico: [`memory_system.md`](./memory_system.md)** (detalhes, tabelas e decisões). Em caso de divergência, vale ele.

---

## 1. Stack e arquitetura

- **Frontend**: React 19 + Vite 7 + TypeScript + TailwindCSS (`client/`)
- **Backend**: Express + tRPC 11 (`server/`)
- **ORM/DB**: Drizzle ORM + PostgreSQL (Render Postgres)
- **Deploy**: Render.com (Web Service), build via `pnpm run build`
- **Repo**: <https://github.com/Moliver63/shadiahasan>
- **URL produção**: <https://shadiahasan-2ngl.onrender.com>
- `pnpm check` roda o `tsc`; o build usa Vite + esbuild, então erro de tipo não barra o deploy.

```text
drizzle/schema.ts                    -- schema do banco
server/routers.ts                    -- appRouter
server/db.ts                         -- helpers de query
server/routers/videos.ts             -- vídeo + checkUserHasAccess
server/routers/groups.ts             -- Grupos (módulos dentro de um curso)
server/routers/collections.ts        -- Programas (entre cursos)
server/asaas.ts + routes/asaas-webhook.ts   -- pagamento Asaas
server/trial.ts + routers/trial.ts       -- teste pago de 1 aula (R$ 19,90)
server/routes/stripe-webhook.ts      -- webhook Stripe
shared/stripe-config.ts, shared/br-document.ts
client/src/pages/AdminCourses.tsx / AdminCourseLessons.tsx / AdminCourseGroups.tsx / AdminCollections.tsx
client/src/pages/Pricing.tsx / LessonView.tsx / CourseDetail.tsx
VIDEO_UPLOAD_TROUBLESHOOTING.md      -- runbook de upload de vídeo
```

---

## 2. Vídeo (YouTube + Cloudflare Stream)

Campos de `lessons`: `videoProvider`, `videoAssetId`, `videoPlaybackUrl`, `duration` (segundos), `isAccessRestricted` (0 grátis, 1 exige plano ou compra avulsa), `isPublished` (0 rascunho, 1 visível).

Upload: `videos.admin.createUploadUrl` → upload direto ao Cloudflare (TUS para arquivos grandes) → polling em `checkUploadStatus` até `readyToStream` → grava `videoPlaybackUrl`/`duration`. Ao abrir `/admin/courses/:id/lessons`, `syncPendingVideos` corrige aulas com `videoAssetId` e sem URL. Diagnóstico em `VIDEO_UPLOAD_TROUBLESHOOTING.md`.

Variáveis: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (permissão "Edit Cloudflare Stream"). Opcionais para signed URLs: `CLOUDFLARE_SIGNING_KEY_ID`, `CLOUDFLARE_SIGNING_KEY_PEM`.

---

## 3. Cursos, aulas e agrupamento

- **Ordem**: `courses.order` e `lessons.order`. Admin reordena por arrastar (Sortable.js) ou pelos botões ↑↓; o aluno vê a mesma ordem.
- **Duplicar** curso (copia aulas e grupos, nasce rascunho, reaproveita os vídeos) e aula (vai para o fim, rascunho, entra nos mesmos grupos). **Ações em lote** para cursos e aulas.
- **Excluir** curso ou aula limpa também os vínculos de grupos e programas.
- **Grupos** (`courseGroups`): módulos dentro de **um** curso. Só aceitam aulas do próprio curso.
- **Programas** (`contentCollections`): trilhas com aulas de **cursos diferentes** (`/collections/:id`, aba "Programas" em `/courses`).
- `course_modules` / `lessons.moduleId`: legado, sem uso.
- `collections.getById` é público e **nunca** devolve `videoPlaybackUrl`.

---

## 4. Assinaturas e controle de acesso

| Slug | Preço/mês | maxCourses | Stripe Price ID (env) |
|------|------:|------:|------|
| `free` | R$0 | 1 | — |
| `basic` | R$49,90 | 3 | `STRIPE_PRICE_BASICO` |
| `premium` | R$99,90 | ilimitado | `STRIPE_PRICE_PREMIUM` |
| `vip` | R$299,90 | ilimitado | `STRIPE_PRICE_VIP` |

```text
isAccessRestricted = 0  → todos acessam
isAccessRestricted = 1  → em ordem:
  1. coursePurchases (compra avulsa, completed) → libera sempre
  2. subscriptions com status 'active':
     premium/vip → tudo | basic → até maxCourses cursos pagos | free/sem plano → nada
```

Só `status = 'active'` libera.

### ⚠️ Segurança — NUNCA reverter

`lessons.listByCourse` e `lessons.getById` (públicas) removem `videoPlaybackUrl`/`videoAssetId` de quem não tem acesso. Vale também para qualquer rota nova que liste aulas. Usar `videos.hasAccess` como porta de acesso, não `enrollments.checkEnrollment`.

---

## 5. Pagamentos

- **Stripe (cartão)**: `subscriptions.createCheckout` + webhook `POST /api/stripe/webhook`.
- **Asaas (PIX, boleto, cartão)**: `subscriptions.createAsaasCheckout` + webhook `POST /api/webhooks/asaas`. Só aparece em `/pricing` se `ASAAS_API_KEY` estiver configurada. O acesso é liberado **só pelo webhook** (`PAYMENT_CONFIRMED`/`RECEIVED`), pausado em `PAYMENT_OVERDUE` e revogado em estorno, chargeback e cancelamento da assinatura. Eventos são idempotentes pelo `id`.
- **Teste de 1 aula (R$ 19,90, pagamento único no Asaas)**: libera só a aula de entrada de cada curso por 7 dias (`TRIAL_PRICE_CENTS`, `TRIAL_VALID_DAYS`). Cobrança com `externalReference = trial:<userId>:<lessonId>`, liberada só pelo webhook. A faixa `TrialOfferSection` fica na home e **todos a veem**; sem `ASAAS_API_KEY` ou sem aula de entrada o botão leva a `/courses` e só administradores veem um aviso do que falta. Rotina de carência, lembretes por e-mail e cancelamento pelo aluno: seção 7 do `memory_system.md`.

```env
ASAAS_API_KEY=<chave>               # só no Render, nunca no código
ASAAS_WEBHOOK_TOKEN=<aleatório>     # igual ao token do webhook no Asaas
ASAAS_BASE_URL=https://api.asaas.com/v3   # sandbox: https://api-sandbox.asaas.com/v3
ASAAS_GRACE_DAYS=3                  # opcional: dias de carência no atraso
TRIAL_PRICE_CENTS=1990              # opcional: preço do teste (500 a 20000)
TRIAL_VALID_DAYS=7                  # opcional: validade do teste (1 a 60)
```

Detalhes (eventos, decisões, cadastro do webhook): seção 7 do `memory_system.md`.

---

## 6. Problemas conhecidos e pendências

- [x] Webhook do Stripe corrigido em 2026-10-23: a rota `/api/stripe/webhook` é montada **antes** do `express.json()` (precisa do corpo cru). Não mover de volta.
- [ ] Webhook do Stripe grava `amount: 0` na ativação e divide por 100 duas vezes na falha.
- [ ] `pnpm check` com 17 erros de tipo no `main`.
- [ ] Capas cinza no desktop em produção: confirmar após publicar o `Courses.tsx` atualizado.
- [ ] Quedas do Render ~60s após a subida: falta o stack trace.
- [ ] UI no admin para `courses.allowIndividualPurchase` + preço avulso; checkout de pagamento único.
- [ ] Corrigir `videoProvider` da aula 1 (`cloudflare` mas URL é YouTube).
- [ ] Limpar scripts de debug na raiz (`*.py`, `*.mjs`) e remover do git `chaveJWT.txt` e `SENHA_RENDER-ARQUIVOS.txt`.
- [ ] README principal desatualizado (cita MySQL/Manus OAuth; real = Postgres/Google OAuth).

---

## 7. Segurança e operação

- Nunca colar nem commitar tokens, senhas, JWTs ou chaves neste repositório ou em documentos.
- Conexão ao banco (`psql`, `pnpm db:push`) usa a **External Database URL** do Render com `?sslmode=require`, em `.env` local.
- Evitar versionar arquivos com credenciais, dumps ou chaves.

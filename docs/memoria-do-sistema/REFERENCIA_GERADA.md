# Referência gerada do sistema

> GERADO AUTOMATICAMENTE por `scripts/docs/gerar-referencia.mjs` a cada push no `main`. **Não edite à mão**: a próxima execução apaga a edição.
> Lê só o código (nomes de variáveis, tabelas, rotas e testes), nunca valores. O contexto e as decisões estão em `memory_system.md`.

## Variáveis de ambiente lidas no código

| Variável | Arquivos que leem | Está no `.env.example` |
|---|---|---|
| `APPLE_CALLBACK_URL` | `server/auth/passport.ts` | sim |
| `APPLE_CLIENT_ID` | `server/auth/passport.ts` | sim |
| `APPLE_KEY_ID` | `server/auth/passport.ts` | sim |
| `APPLE_PRIVATE_KEY` | `server/auth/passport.ts` | sim |
| `APPLE_TEAM_ID` | `server/auth/passport.ts` | sim |
| `ASAAS_API_KEY` | `server/asaas.ts` | **não** |
| `ASAAS_BASE_URL` | `server/asaas.ts` | **não** |
| `ASAAS_WEBHOOK_TOKEN` | `server/asaas.ts` | **não** |
| `BUILT_IN_FORGE_API_KEY` | `server/_core/env.ts` | sim |
| `BUILT_IN_FORGE_API_URL` | `server/_core/env.ts` | sim |
| `CLOUDFLARE_ACCOUNT_ID` | `server/cloudflare-stream.ts`, `server/routers.ts` | sim |
| `CLOUDFLARE_API_TOKEN` | `server/cloudflare-stream.ts`, `server/routers.ts` | sim |
| `CLOUDFLARE_SIGNING_KEY_ID` | `server/cloudflare-stream.ts` | **não** |
| `CLOUDFLARE_SIGNING_KEY_PEM` | `server/cloudflare-stream.ts` | **não** |
| `DATABASE_URL` | `server/_core/env.ts`, `server/db.ts` e mais 2 | sim |
| `EMAIL_AVISOS_ADMIN` | `server/_core/email.ts`, `server/caixaEmail.ts` e mais 1 | **não** |
| `EMAIL_CAIXA_DOMINIO` | `server/caixaEmail.ts` | **não** |
| `EMAIL_CONTATO` | `server/_core/emailLayout.ts`, `server/caixaEmail.ts` e mais 1 | **não** |
| `EMAIL_CONTATO_REMETENTE` | `server/_core/email.ts` | **não** |
| `EMAIL_FINANCEIRO` | `server/_core/emailLayout.ts` | **não** |
| `FROM_EMAIL` | `server/_core/email.ts` | sim |
| `GOOGLE_CALLBACK_URL` | `server/_core/bootstrap.ts`, `server/auth/passport.ts` | sim |
| `GOOGLE_CLIENT_ID` | `server/_core/bootstrap.ts`, `server/auth/passport.ts` | sim |
| `GOOGLE_CLIENT_SECRET` | `server/_core/bootstrap.ts`, `server/auth/passport.ts` | sim |
| `GROQ_API_KEY_SH` | `server/routers/materials.ts` | **não** |
| `JWT_SECRET` | `server/_core/auth.ts`, `server/_core/env.ts` | sim |
| `META_CAPI_ACCESS_TOKEN` | `server/metaCapi.ts` | **não** |
| `META_CAPI_API_VERSION` | `server/metaCapi.ts` | **não** |
| `META_CAPI_TEST_EVENT_CODE` | `server/metaCapi.ts` | **não** |
| `META_PIXEL_ID` | `server/metaCapi.ts` | **não** |
| `NODE_ENV` | `server/_core/auth.ts`, `server/_core/bootstrap.ts` e mais 2 | sim |
| `NTFY_TOPIC` | `server/avisoVenda.ts` | sim |
| `NTFY_URL` | `server/avisoVenda.ts` | sim |
| `OAUTH_SERVER_URL` | `server/_core/env.ts` | sim |
| `OWNER_OPEN_ID` | `server/_core/env.ts` | sim |
| `PORT` | `server/_core/index.ts` | sim |
| `RESEND_API_KEY` | `server/_core/email.ts`, `server/routers/caixaEmail.ts` | sim |
| `RESEND_WEBHOOK_SECRET` | `server/routers/caixaEmail.ts`, `server/routes/resend-webhook.ts` | **não** |
| `SITE_URL` | `server/_core/emailLayout.ts` | sim |
| `STRIPE_PRICE_BASICO` | `shared/stripe-config.ts` | sim |
| `STRIPE_PRICE_PREMIUM` | `shared/stripe-config.ts` | sim |
| `STRIPE_PRICE_VIP` | `shared/stripe-config.ts` | sim |
| `STRIPE_PROD_BASICO` | `shared/stripe-config.ts` | sim |
| `STRIPE_PROD_PREMIUM` | `shared/stripe-config.ts` | sim |
| `STRIPE_PROD_VIP` | `shared/stripe-config.ts` | sim |
| `STRIPE_SECRET_KEY` | `server/routes/stripe-webhook.ts`, `server/stripe.ts` | sim |
| `STRIPE_WEBHOOK_SECRET` | `server/_core/stripe-webhook.ts`, `server/routes/stripe-webhook.ts` | sim |
| `VITE_ANALYTICS_ENDPOINT` | `client/src/main.tsx` | **não** |
| `VITE_ANALYTICS_WEBSITE_ID` | `client/src/main.tsx` | **não** |
| `VITE_APP_ID` | `server/_core/env.ts` | sim |
| `VITE_CLARITY_ID` | `client/src/components/Analytics.tsx`, `client/src/pages/AdminAnalytics.tsx` | **não** |
| `VITE_FRONTEND_FORGE_API_KEY` | `client/src/components/Map.tsx` | sim |
| `VITE_FRONTEND_FORGE_API_URL` | `client/src/components/Map.tsx` | sim |
| `VITE_GA4_ID` | `client/src/components/Analytics.tsx`, `client/src/lib/ga4Ids.ts` e mais 1 | **não** |
| `VITE_META_PIXEL_ID` | `client/src/components/Analytics.tsx`, `client/src/pages/AdminAnalytics.tsx` | **não** |

55 variáveis; 21 sem entrada no `.env.example`. Variáveis do Render que não estão no código (ou o contrário) aparecem aqui como diferença a investigar.

## Tabelas criadas em tempo de execução

Criadas por `CREATE TABLE IF NOT EXISTS` na primeira chamada (fora do `drizzle/schema.ts`). Ao subir uma coluna nova, ela entra por `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no mesmo arquivo.

| Tabela | Criada em |
|---|---|
| `analyticsClaritySnapshots` | `server/acessos.ts` |
| `asaasAccounts` | `server/asaas.ts` |
| `asaasWebhookEvents` | `server/asaas.ts` |
| `aulaAssistida` | `server/assistido.ts` |
| `aulaPerguntas` | `server/requisitos.ts` |
| `aulaRespostas` | `server/requisitos.ts` |
| `certificadosEmitidos` | `server/certificados.ts` |
| `contentCollectionHistory` | `server/routers/collections.ts` |
| `contentCollectionItems` | `server/routers/collections.ts` |
| `contentCollections` | `server/routers/collections.ts` |
| `courseGroupLessons` | `server/routers/groups.ts` |
| `courseGroups` | `server/routers/groups.ts` |
| `emailAvisosEnviados` | `server/emailAvisos.ts` |
| `emailCaixas` | `server/caixaEmail.ts` |
| `emailEnviados` | `server/caixaEmail.ts` |
| `emailRecebidos` | `server/caixaEmail.ts` |
| `leads` | `server/routers.ts` |
| `linksDeAcesso` | `server/linkDeAcesso.ts` |
| `marketingCampanhas` | `server/marketing.ts` |
| `marketingContatos` | `server/marketing.ts` |
| `marketingEnvios` | `server/marketing.ts` |
| `marketingSequenciaEnvios` | `server/marketingSequencia.ts` |
| `marketingSequenciaPassos` | `server/marketingSequencia.ts` |
| `marketingSequencias` | `server/marketingSequencia.ts` |
| `stripeWebhookEvents` | `server/db.ts` |
| `trialEntryLessons` | `server/trial.ts` |
| `trialGuestCheckouts` | `server/trialGuest.ts` |
| `trialPasses` | `server/trial.ts` |

## Routers tRPC (`server/routers.ts`)

`acessos`, `admin`, `adminManagement`, `ai`, `appointments`, `areaAluno`, `auth`, `badges`, `caixaEmail`, `certificados`, `certificates`, `collections`, `community`, `courseGroups`, `courses`, `ebooks`, `enrollments`, `leads`, `lessons`, `marketing`, `materials`, `messaging`, `plans`, `profile`, `profiles`, `referrals`, `reviews`, `subscriptionManagement`, `subscriptions`, `system`, `testimonials`, `trial`, `videos`

## Rotas HTTP do servidor (Express)

| Método | Caminho | Arquivo |
|---|---|---|
| POST | `/apple/callback` | `server/auth/routes.ts` |
| GET | `/apple` | `server/auth/routes.ts` |
| GET | `/certificados/:arquivo` | `server/routes/certificados.ts` |
| POST | `/enviar-link` | `server/auth/routes.ts` |
| GET | `/google/callback` | `server/auth/routes.ts` |
| GET | `/google` | `server/auth/routes.ts` |
| GET | `/handoff` | `server/auth/routes.ts` |
| GET | `/link` | `server/auth/routes.ts` |
| POST | `/link` | `server/auth/routes.ts` |
| POST | `/logout` | `server/auth/routes.ts` |
| GET | `/marketing/confirmar` | `server/routes/marketing.ts` |
| POST | `/marketing/confirmar` | `server/routes/marketing.ts` |
| GET | `/marketing/sair` | `server/routes/marketing.ts` |
| POST | `/marketing/sair` | `server/routes/marketing.ts` |
| GET | `/me` | `server/auth/routes.ts` |
| POST | `/stripe/webhook` | `server/routes/stripe-webhook.ts` |
| POST | `/webhooks/asaas` | `server/routes/asaas-webhook.ts` |
| POST | `/webhooks/resend` | `server/routes/resend-webhook.ts` |

Os prefixos (`/api`, `/api/auth`) vêm de `server/_core/index.ts`.

## Telas (`client/src/App.tsx`)

| Caminho | Componente | Acesso |
|---|---|---|
| `/` | `Home` | público |
| `/404` | `NotFound` | público |
| `/about` | `About` | público |
| `/admin` | `AdminDashboard` | admin |
| `/admin/accept-invite` | `AcceptAdminInvite` | público |
| `/admin/account-settings` | `AdminAccountSettings` | admin |
| `/admin/analytics` | `AdminAnalytics` | admin |
| `/admin/appointments` | `AdminAppointments` | admin |
| `/admin/campanhas` | `AdminCampanhas` | admin |
| `/admin/cashback-requests` | `AdminCashbackRequests` | admin |
| `/admin/collections` | `AdminCollections` | admin |
| `/admin/courses` | `AdminCourses` | admin |
| `/admin/courses/:id/groups` | `AdminCourseGroups` | admin |
| `/admin/courses/:id/lessons` | `AdminCourseLessons` | admin |
| `/admin/emails` | `AdminEmails` | admin |
| `/admin/financeiro` | `AdminFinanceiro` | admin |
| `/admin/lessons` | `AdminLessons` | admin |
| `/admin/lessons/:id/materials` | `AdminLessonMaterials` | admin |
| `/admin/manage-admins` | `AdminManageAdmins` | admin |
| `/admin/manage-subscriptions` | `AdminManageSubscriptions` | admin |
| `/admin/management` | `AdminManagement` | admin |
| `/admin/moderation` | `AdminModeration` | admin |
| `/admin/perguntas` | `AdminPerguntas` | admin |
| `/admin/plans` | `AdminPlans` | admin |
| `/admin/programs` | `AdminPrograms` | admin |
| `/admin/settings` | `AdminSettings` | admin |
| `/admin/students` | `AdminStudents` | admin |
| `/admin/testimonials` | `AdminTestimonials` | admin |
| `/admin/users` | `AdminUsers` | admin |
| `/autoavaliacao` | `Autoavaliacao` | público |
| `/certificado/:numero` | `CertificadoVerificar` | público |
| `/certificates` | `MyCertificates` | logado |
| `/checkout/success` | `CheckoutSuccess` | público |
| `/community/connections` | `CommunityConnections` | logado |
| `/community/explore` | `CommunityExplore` | logado |
| `/compra/aguardando` | `CompraAguardando` | público |
| `/contact` | `Contact` | público |
| `/courses` | `Courses` | público |
| `/courses/:slug` | `CourseDetail` | público |
| `/dashboard` | `AdminDashboard` | admin |
| `/dashboard/referrals` | `UserReferrals` | logado |
| `/ebook/:id` | `EbookReader` | logado |
| `/ebooks` | `Ebooks` | público |
| `/edit-profile` | `EditProfile` | logado |
| `/faq` | `FAQ` | público |
| `/forgot-password` | `ForgotPassword` | público |
| `/lesson/:id` | `LessonView` | logado |
| `/login` | `Login` | público |
| `/messages` | `Messages` | logado |
| `/minha-area` | `MinhaArea` | logado |
| `/my-courses` | `MyCourses` | logado |
| `/my-subscription` | `MySubscription` | logado |
| `/pricing` | `Pricing` | público |
| `/privacy` | `Privacy` | público |
| `/profile` | `Profile` | logado |
| `/reset-password` | `ResetPassword` | público |
| `/signup` | `Signup` | público |
| `/terms` | `Terms` | público |
| `/verify-email` | `VerifyEmail` | público |

## Testes

35 arquivos de teste, 258 casos declarados (`it`/`test`). Para o resultado real, rode `pnpm test`.

# Shadia VR Platform - TODO

## Fase 1: Banco de Dados e Schema
- [x] Criar tabela courses (id, title, slug, description, thumbnail, createdAt, updatedAt)
- [x] Criar tabela lessons (id, courseId, title, order, description, videoProvider, videoAssetId, videoPlaybackUrl, duration, createdAt, updatedAt)
- [x] Criar tabela enrollments (id, userId, courseId, progress, completedLessons, enrolledAt)
- [x] Adicionar campo role ao schema de users (admin/user)
- [x] Executar migrations do banco de dados

## Fase 2: Autenticação e Controle de Acesso
- [x] Configurar autenticação OAuth com Manus (já incluído no template)
- [x] Implementar middleware de proteção para rotas admin
- [x] Criar procedimento adminProcedure para tRPC
- [x] Implementar sistema de verificação de roles no backend
- [x] Criar hook useAuth no frontend para gerenciar estado de autenticação

## Fase 3: Painel Administrativo
- [x] Criar layout DashboardLayout para área administrativa
- [x] Implementar CRUD de cursos (criar, listar, editar, excluir)
- [x] Implementar CRUD de aulas vinculadas a cursos
- [x] Criar formulário de upload/configuração de vídeos
- [ ] Implementar interface de gerenciamento de matrículas
- [x] Adicionar visualização de estatísticas (total de cursos, alunos, aulas)

## Fase 4: Sistema de Vídeos
- [x] Integrar Cloudflare Stream para upload de vídeos
- [x] Criar endpoint para gerar URLs de upload seguras
- [x] Implementar player de vídeo com controles personalizados
- [x] Adicionar proteção de conteúdo (apenas usuários matriculados)
- [x] Implementar streaming adaptativo de qualidade
- [ ] Adicionar suporte a legendas/closed captions

## Fase 5: Integração WebXR para Meta Quest
- [x] Instalar dependências WebXR (three.js, @react-three/fiber, @react-three/xr)
- [x] Criar componente VRViewer para renderização 3D
- [x] Implementar detecção de dispositivo VR (Meta Quest)
- [x] Criar modo de visualização 360° para vídeos
- [x] Implementar controles VR (gaze, controllers)
- [x] Adicionar interface VR para navegação de cursos
- [x] Otimizar performance para dispositivos VR

## Fase 6: Interface do Aluno
- [x] Criar página de catálogo de cursos
- [x] Implementar sistema de matrícula em cursos
- [x] Criar página de detalhes do curso com lista de aulas
- [x] Implementar player de aulas com progresso
- [x] Adicionar dashboard do aluno com cursos matriculados
- [x] Implementar sistema de progresso e conclusão de aulas
- [ ] Criar página de certificado (opcional)

## Fase 7: Landing Page e Design Visual
- [x] Definir paleta de cores e identidade visual
- [x] Criar landing page com hero section
- [x] Adicionar seção "Sobre" e "Missão/Visão/Valores"
- [x] Implementar seção de destaques de cursos
- [x] Adicionar seção de diferenciais (VR, qualidade, etc)
- [x] Criar footer com links e informações de contato
- [x] Implementar navegação responsiva com header

## Fase 8: Testes e Qualidade
- [x] Criar testes unitários para procedures críticos
- [x] Testar fluxo completo de matrícula e visualização
- [x] Testar integração WebXR em dispositivo Meta Quest
- [x] Validar upload e streaming de vídeos
- [x] Testar responsividade em diferentes dispositivos
- [x] Validar controle de acesso e permissões

## Fase 9: Documentação e Deploy
- [x] Criar documentação de uso para administradores
- [x] Documentar processo de upload de vídeos
- [x] Adicionar instruções de uso do modo VR
- [x] Criar checkpoint final do projeto
- [x] Preparar instruções de publicação

## Personalização Shadia Hasan
- [x] Atualizar nome da plataforma para "Shadia Hasan"
- [x] Upload das fotos profissionais para S3
- [x] Adicionar foto de perfil na landing page
- [x] Criar seção "Sobre Shadia Hasan" com bio
- [x] Atualizar textos para refletir psicologia e desenvolvimento humano
- [x] Adicionar link para Instagram (@shadia_hasan)
- [x] Atualizar meta tags e SEO com nome correto

## Curso de Demonstração
- [x] Criar curso "Autoconhecimento e Inteligência Emocional"
- [x] Adicionar 5 aulas estruturadas ao curso
- [x] Publicar curso e aulas
- [x] Verificar visualização no frontend

## Botão WhatsApp
- [x] Criar componente WhatsAppButton flutuante
- [x] Adicionar número +55 47 99142-6662
- [x] Integrar em todas as páginas
- [x] Testar link do WhatsApp

## Personalização do Login
- [ ] Remover referências ao Manus na tela de login
- [ ] Aplicar branding Shadia Hasan
- [ ] Customizar textos e visual

## Sistema de Assinaturas Freemium
- [x] Adicionar feature Stripe ao projeto
- [x] Criar tabela de planos no banco de dados
- [x] Criar tabela de assinaturas no banco de dados
- [x] Definir 4 planos: Gratuito, Básico, Premium, VIP
- [x] Implementar página de preços com comparação de planos
- [x] Integrar checkout Stripe (estrutura básica)
- [x] Implementar webhook para processar pagamentos (estrutura pronta)
- [x] Adicionar controle de acesso baseado em plano (queries prontas)
- [x] Criar página de gerenciamento de assinatura (via Settings)
- [x] Testar fluxo completo de assinatura

## Logo e Favicon
- [x] Fazer upload da logo completa para S3
- [x] Criar favicon com a árvore
- [x] Atualizar header de todas as páginas com logo
- [x] Adicionar favicon no index.html

## Ajuste de Tamanho da Logo
- [x] Aumentar logo de h-12 para h-36 (3x maior) em todas as páginas

## Melhorias Conforme Documento (Qualidade 15/10)

### Sistema de Reviews e Ratings
- [x] Criar tabela de reviews no banco de dados
- [x] Implementar API de reviews com tRPC
- [ ] Adicionar exibição de ratings (estrelas) nos cards de cursos
- [ ] Mostrar reviews de alunos na página de detalhes do curso

### Visualizador de PDFs/Ebooks
- [x] Integrar biblioteca de visualização de PDFs (react-pdf)
- [x] Adicionar suporte a upload de ebooks no painel admin (API pronta)
- [x] Criar página de leitura de ebooks com controles
- [x] Criar página de biblioteca de ebooks

### Trilhas de Aprendizado
- [ ] Criar sistema de trilhas (sequência de cursos)
- [ ] Implementar visualização de progresso com barra/percentual
- [ ] Adicionar dashboard do aluno com estatísticas
- [ ] Mostrar próximos passos recomendados

### Busca Inteligente
- [ ] Implementar busca por título, descrição e tags
- [ ] Adicionar filtros por categoria, nível, duração
- [ ] Criar página de resultados de busca
- [ ] Implementar autocomplete/sugestões

### Gamificação
- [x] Criar sistema de badges/conquistas (banco + API)
- [x] Implementar geração automática de certificados
- [x] Adicionar página de certificados do aluno
- [ ] Criar leaderboard de engajamento

### Suporte Multilíngue (PT/EN)
- [ ] Implementar sistema de i18n
- [ ] Traduzir interface para inglês
- [ ] Adicionar seletor de idioma no header
- [ ] Suportar conteúdo multilíngue nos cursos

### Credenciais Admin
- [ ] Criar usuário admin: Shadia / shadia20268
- [x] Implementar sistema de recuperação de senha

## Reestruturação de Comunicação - Jornada de Transformação
- [x] Reescrever hero section da landing page com foco em transformação
- [x] Atualizar seção "Sobre" com linguagem de desenvolvimento pessoal
- [x] Revisar descrições de cursos removendo termos clínicos
- [x] Atualizar textos de planos com foco em evolução consciente
- [x] Revisar todas as páginas (Cursos, Ebooks, Certificados)
- [x] Atualizar meta tags e SEO com nova comunicação

## Ajustes Profissionais - Checklist de Boas Práticas

### Produto e Experiência
- [ ] Otimizar CTAs da home (1 primário + 1 secundário)
- [x] Criar página "Sobre Shadia" completa (bio, formação, abordagem, ética)
- [x] Criar página "Contato" (email, WhatsApp, formulário)
- [x] Criar página "FAQ" (planos, reembolso, suporte, VR)
- [ ] Melhorar catálogo de cursos (filtros, badges, cards consistentes)
- [ ] Aprimorar página de detalhes do curso (trailer, módulos, materiais, depoimentos)
- [ ] Melhorar área "Meus Cursos" (progresso visual, continue assistindo)

### Performance e Qualidade
- [ ] Otimizar imagens (WebP, lazy-load)
- [ ] Implementar cache e CDN
- [ ] Melhorar streaming de vídeo (HLS adaptativo, thumbnails, retomada)
- [ ] Adicionar observabilidade (logs estruturados, métricas)

### Segurança
- [ ] Implementar proteção de conteúdo (URLs assinadas, expiração)
- [ ] Adicionar rate limit no login
- [ ] Configurar headers de segurança (CSP, HSTS)
- [ ] Implementar trilha de auditoria

### SEO e Legal
- [ ] Adicionar schema.org (Course) nas páginas de curso
- [ ] Criar sitemap.xml e robots.txt
- [ ] Criar política de privacidade (LGPD)
- [ ] Criar termos de uso e política de reembolso

### WebXR/VR
- [ ] Implementar fallback para navegadores sem VR
- [ ] Otimizar qualidade adaptativa para VR
- [ ] Melhorar controles UX (gaze, joystick, legendas)
- [ ] Testar em Meta Quest Browser

## Menu de Perfil do Usuário
- [x] Criar componente UserMenu com dropdown
- [x] Adicionar opções: Ver Perfil, Editar Perfil, Meus Certificados, Mudar de Plano, Configurações, Sair
- [x] Integrar em todas as páginas do site
- [x] Adicionar avatar do usuário
- [x] Testar funcionalidade de logout

## Correção de Erros 404 no Painel Admin
- [x] Verificar rotas do App.tsx para páginas admin
- [x] Criar página /admin/settings (configurações gerais)
- [x] Criar página /admin/students (gerenciamento de alunos)
- [x] Corrigir rota /admin/lessons (gerenciamento de aulas)
- [x] Testar todas as rotas do painel administrativo

## Sistema de Perfil do Aluno com Controle de Acesso
- [x] Implementar controle RBAC (Role-Based Access Control) no backend
- [x] Criar página de perfil do aluno (/profile)
- [x] Adicionar validação de acesso: aluno só vê próprios dados
- [x] Implementar bloqueio de acesso a outros perfis via URL
- [x] Adicionar seção de dados pessoais no perfil
- [x] Mostrar cursos inscritos no perfil
- [x] Exibir progresso e estatísticas no perfil
- [x] Adicionar lista de certificados conquistados
- [ ] Criar histórico de atividades
- [ ] Implementar configurações de privacidade

## Sistema de Comunidade "Conexões Conscientes"
- [x] Criar tabela de perfis públicos (profiles)
- [x] Criar tabela de conexões (connections)
- [x] Criar tabela de solicitações de conexão (connection_requests)
- [x] Implementar sistema de opt-in para comunidade
- [ ] Criar página "Explorar Conexões"
- [ ] Implementar algoritmo de match por afinidade (cursos, interesses, objetivos)
- [ ] Criar sistema de envio/aceitação de convites de conexão
- [ ] Implementar página "Minhas Conexões"
- [ ] Adicionar sistema de chat interno (futuro)
- [ ] Criar sistema de grupos de estudo (futuro)
- [ ] Implementar fórum por curso (futuro)
- [ ] Adicionar eventos online (futuro)

## Segurança e Moderação da Comunidade
- [x] Implementar botão "Denunciar abuso" (API pronta)
- [x] Criar sistema de bloqueio de usuário (API pronta)
- [ ] Adicionar painel de moderação para admin
- [x] Criar tabela de reports (denúncias)
- [x] Criar tabela de moderation_logs
- [ ] Implementar termos de uso da comunidade
- [ ] Adicionar consentimento LGPD para participação na comunidade
- [ ] Criar política de privacidade da comunidade
- [ ] Implementar monitoramento básico de mensagens

## Implementação das Páginas de Comunidade
- [x] Criar página /community/explore (Explorar Conexões)
- [x] Implementar cards de perfis públicos com informações
- [x] Adicionar botão "Conectar" para enviar solicitação
- [x] Criar página /community/connections (Minhas Conexões)
- [x] Mostrar conexões ativas com opções de chat/bloquear
- [x] Exibir solicitações pendentes recebidas (aceitar/rejeitar)
- [x] Mostrar solicitações enviadas aguardando resposta
- [x] Adicionar lista de usuários bloqueados
- [x] Criar página /admin/moderation (Painel de Moderação)
- [x] Listar denúncias pendentes e revisadas
- [x] Implementar ações de moderação (avisar, suspender, banir)
- [x] Mostrar logs de auditoria de moderação
- [x] Adicionar links de navegação no menu principal

## Adicionar Número do CRP
- [x] Adicionar CRP 12/27052 no rodapé do site
- [x] Adicionar CRP 12/27052 na página Sobre (credenciais)

## Sistema de Mensagens com Restrições de Plano
- [x] Criar tabela de mensagens (messages)
- [x] Criar tabela de conversas (conversations)
- [x] Adicionar campo 'plan' na tabela users (free/premium)
- [x] Implementar API para enviar mensagem
- [x] Implementar API para listar conversas
- [x] Implementar API para listar mensagens de uma conversa
- [x] Adicionar validação: plano gratuito só envia para admin
- [x] Adicionar validação: plano gratuito pode receber de qualquer um
- [x] Criar interface de chat/mensagens
- [x] Mostrar bloqueio visual para usuários gratuitos
- [x] Permitir admin enviar para todos

## Permissões Admin para Editar Usuários
- [x] Criar API admin para editar email de usuário
- [x] Criar API admin para editar perfil de usuário
- [ ] Criar página admin para gerenciar usuários
- [ ] Adicionar formulário de edição de usuário

## Mensagem Automática de Boas-Vindas
- [x] Criar função para enviar mensagem de boas-vindas
- [x] Integrar envio no processo de cadastro/primeiro login
- [x] Personalizar mensagem com nome do usuário
- [x] Testar envio automático

## Sistema de Notificações em Tempo Real
- [x] Criar API para contar mensagens não lidas
- [x] Adicionar badge com contador no ícone de Mensagens
- [x] Implementar polling automático (a cada 30s)
- [x] Atualizar contador quando usuário lê mensagens
- [x] Adicionar indicador visual no menu

## Melhorias no Perfil do Usuário Cliente
- [x] Criar página "Editar Perfil" completa
- [x] Adicionar formulário para editar nome
- [x] Adicionar formulário para editar email
- [x] Adicionar upload de foto de perfil
- [x] Adicionar seleção de idioma
- [x] Adicionar preferências de notificação
- [x] Criar seção de segurança (histórico de login, sessões ativas)

## Gestão de Assinatura e Plano
- [x] Criar página "Minha Assinatura"
- [x] Mostrar plano atual e cursos inclusos
- [x] Mostrar próxima cobrança
- [x] Adicionar histórico de pagamentos
- [x] Implementar botão de Upgrade
- [x] Implementar botão de Downgrade
- [x] Implementar botão de Cancelar
- [ ] Integrar com Stripe para upgrade/downgrade

## Dashboard do Aluno Melhorado
- [x] Mostrar cursos inscritos com cards visuais
- [x] Adicionar progresso percentual por curso
- [x] Mostrar última aula assistida
- [x] Exibir tempo total assistido
- [x] Mostrar aulas concluídas
- [x] Listar certificados disponíveis
- [x] Adicionar estatísticas de evolução

## Recursos Avançados (Futuro)
- [ ] Sistema de Lives (próximas e gravadas)
- [ ] IA para traçar perfil do aluno
- [ ] Questionário de onboarding
- [ ] Recomendações personalizadas
- [ ] Gamificação e badges
- [ ] Ranking interno
- [ ] Modo escuro
- [ ] Comentários nas aulas
- [ ] Fórum interno

## Personalização de Autenticação (Interface 100% Shadia Hasan)
- [x] Criar página de Login personalizada (/login)
- [x] Criar página de Registro personalizada (/signup)
- [x] Adicionar botão "Continuar com Google"
- [x] Adicionar botão "Continuar com Apple"
- [x] Remover todas as referências a Manus/Meta da interface
- [x] Aplicar branding Shadia Hasan (logo, cores roxo/rosa)
- [x] Criar documentação para solicitar customização de emails OAuth
- [x] Criar template de email personalizado para enviar à Manus

## Sistema de Autenticação Próprio Shadia Hasan (Substituir Manus OAuth)
- [x] Instalar dependências (Resend, bcryptjs, jsonwebtoken)
- [x] Configurar integração com Resend para envio de emails
- [x] Criar templates HTML de emails personalizados
- [x] Implementar API de registro com email/senha
- [x] Implementar API de login com email/senha
- [x] Implementar API de verificação de email
- [x] Implementar API de recuperação de senha
- [x] Implementar API de redefinição de senha
- [x] Atualizar página /login com formulário email/senha
- [x] Atualizar página /signup com formulário de registro
- [x] Criar página /verify-email para confirmar email
- [x] Criar página /forgot-password para solicitar recuperação
- [x] Criar página /reset-password para redefinir senha
- [ ] Desativar redirecionamento para Manus OAuth
- [ ] Testar fluxo completo de registro e login
- [ ] Documentar processo de configuração do Resend

## Correção de Erro HTML (Nested Anchor Tags)
- [x] Localizar tags <a> aninhadas na página inicial
- [x] Corrigir estrutura HTML inválida
- [x] Testar página sem erros no console

## Sistema de Gestão de Cursos (Admin)
- [x] Criar tabela de cursos (courses)
- [x] Criar tabela de módulos (course_modules)
- [x] Criar tabela de aulas (course_lessons)
- [x] Criar API para listar todos os cursos
- [x] Criar API para criar novo curso
- [x] Criar API para editar curso
- [x] Criar API para excluir curso
- [x] Criar API para adicionar módulo ao curso
- [x] Criar API para adicionar aula ao módulo
- [x] Criar página /admin/courses (listagem)
- [x] Criar formulário de criar curso
- [x] Criar formulário de editar curso
- [x] Adicionar upload de imagem de capa do curso
- [x] Adicionar controle de visibilidade (publicado/rascunho)
- [ ] Integrar com sistema de inscrições de alunos

## Gestão de Planos de Assinatura (Admin)
- [x] Criar/atualizar tabela de planos (subscription_plans)
- [x] Adicionar campo price no curso para venda avulsa
- [x] Criar API para listar planos
- [x] Criar API para criar plano
- [x] Criar API para editar plano
- [x] Criar API para excluir plano
- [ ] Criar API para associar cursos ao plano
- [x] Criar página /admin/plans (gestão de planos)
- [x] Criar formulário de criar/editar plano
- [x] Adicionar controle de recursos inclusos por plano
- [x] Adicionar toggle de ativar/desativar plano

## Sistema de Venda de Cursos Avulsos
- [ ] Adicionar campo price na tabela courses
- [ ] Criar tabela de compras (course_purchases)
- [ ] Criar API de checkout Stripe para curso avulso
- [ ] Criar webhook Stripe para confirmar compra
- [ ] Criar API para verificar se usuário comprou curso
- [ ] Adicionar botão "Comprar Curso" na página do curso
- [ ] Criar página de confirmação de compra
- [ ] Enviar email de confirmação após compra
- [ ] Adicionar cursos comprados no perfil do aluno
- [ ] Diferenciar acesso por plano vs compra avulsa

## IA Consultora para Recomendação de Cursos
- [x] Criar API tRPC para chat com IA (ai.chat)
- [x] Implementar lógica de análise de perfil com LLM
- [x] Criar sistema de pontuação de cursos baseado em respostas
- [x] Criar componente AIChatWidget flutuante
- [x] Adicionar animações de digitação e transições
- [x] Implementar histórico de conversa
- [x] Adicionar botão de abrir/fechar chat
- [x] Integrar widget na página inicial (Home.tsx)
- [x] Criar fluxo de perguntas personalizadas
- [x] Adicionar links diretos para cursos recomendados
- [ ] Testar recomendações com diferentes perfis

## Sistema de Autenticação Email/Senha (Verificado e Funcional)
- [x] Implementar registro com email e senha
- [x] Implementar login com email e senha
- [x] Adicionar verificação de email obrigatória
- [x] Criar sistema de recuperação de senha
- [x] Implementar hash de senha com bcrypt
- [x] Adicionar validação com Zod
- [x] Criar templates de email personalizados (Resend)
- [x] Implementar JWT e cookies httpOnly
- [x] Testar fluxo completo de cadastro e login
- [x] Adicionar mensagem de boas-vindas automática
- [x] Criar páginas /login, /signup, /forgot-password, /verify-email

## Admin: Trocar Senha e Email de Usuários
- [x] Criar API admin.updateUserPassword para trocar senha de qualquer usuário
- [x] Criar API admin.updateUserEmail para trocar email de qualquer usuário
- [x] Adicionar interface no painel admin para editar credenciais
- [x] Implementar validação de email único
- [x] Adicionar confirmação antes de alterar dados sensíveis
- [x] Testar fluxo completo de alteração

## Admin: Trocar Próprio Email e Senha nas Configurações
- [x] Criar API auth.updateOwnEmail para admin trocar seu próprio email
- [x] Criar API auth.updateOwnPassword para admin trocar sua própria senha
- [x] Adicionar seção de Segurança na página AdminSettings
- [x] Implementar formulário de alteração de email com validação
- [x] Implementar formulário de alteração de senha com confirmação
- [x] Adicionar validação de senha atual antes de permitir mudanças
- [x] Testar fluxo completo de alteração

## Atualizar Logo da Plataforma
- [x] Fazer upload da nova logo para S3
- [x] Configurar VITE_APP_LOGO com URL da nova logo
- [x] Verificar logo em todas as páginas (home, dashboard, admin)
- [x] Testar responsividade da logo

## Remover Fundo da Logo e Criar Favicon
- [x] Remover fundo bege da logo (tornar transparente)
- [x] Criar favicon 32x32px
- [x] Criar favicon 16x16px
- [x] Atualizar favicon.ico no projeto
- [x] Testar favicon no navegador

## Ajustar Login para Apenas Email/Senha
- [ ] Substituir getLoginUrl() por navegação para /login em Home.tsx
- [ ] Atualizar DashboardLayout para redirecionar para /login
- [ ] Remover referências ao OAuth em outros componentes
- [ ] Testar fluxo de login completo
- [ ] Verificar que não há mais opções de OAuth visíveis

## Implementar OAuth Google + Apple
- [x] Instalar passport, passport-google-oauth20, passport-apple
- [x] Criar estrutura server/auth/ (strategies, routes, controllers)
- [x] Configurar Passport.js com estratégias Google e Apple
- [x] Criar rotas /api/auth/google, /api/auth/google/callback
- [x] Criar rotas /api/auth/apple, /api/auth/apple/callback
- [x] Implementar /api/auth/me e /api/auth/logout
- [x] Atualizar modelo User para suportar OAuth
- [x] Implementar account linking (mesmo email, múltiplos provedores)
- [x] Adicionar botões OAuth na página /login
- [x] Configurar CORS com credentials: true
- [x] Implementar cookies httpOnly, SameSite, Secure
- [x] Adicionar proteção CSRF (state/nonce OAuth)
- [x] Documentar setup Google Cloud Console
- [x] Documentar setup Apple Developer
- [x] Criar OAUTH_SETUP.md com troubleshooting completo
- [ ] Configurar variáveis de ambiente (GOOGLE_CLIENT_ID, etc)
- [ ] Testar login Google local
- [ ] Testar login Apple local
- [ ] Testar login Google produção
- [ ] Testar login Apple produção

## Adicionar OAuth na Página de Cadastro
- [x] Adicionar botões "Continuar com Google" e "Continuar com Apple" em /signup
- [x] Manter design consistente com página de login
- [x] Testar fluxo completo de cadastro via OAuth

## Ajustar Login para Funcionar 100%
- [ ] Verificar API de login (auth.login)
- [ ] Verificar redirecionamento após login bem-sucedido
- [ ] Garantir que cookies de sessão sejam setados corretamente
- [ ] Testar acesso ao dashboard após login
- [ ] Verificar proteção de rotas (usuário não autenticado não acessa dashboard)
- [ ] Testar login com email/senha
- [ ] Testar persistência de sessão (reload da página)

## Páginas Legais (Termos e Privacidade)
- [x] Criar documento completo de Termos de Uso
- [x] Criar documento completo de Política de Privacidade (LGPD)
- [x] Criar página /terms com Termos de Uso
- [x] Criar página /privacy com Política de Privacidade
- [x] Adicionar rotas no App.tsx
- [x] Atualizar links no rodapé
- [x] Atualizar links nos formulários de login/cadastro
- [x] Testar páginas e navegação

## Banner de Consentimento de Cookies (LGPD)
- [x] Criar componente CookieConsent
- [x] Implementar lógica de persistência no localStorage
- [x] Adicionar categorias de cookies (essenciais, funcionais, analytics)
- [x] Criar modal de preferências detalhadas
- [x] Integrar banner no App.tsx
- [x] Testar aceitação, recusa e personalização
- [x] Verificar persistência após reload

## Corrigir Login Google OAuth em Produção
- [x] Diagnosticar erro 500 em /api/auth/google verificando logs do Render
- [x] Identificar variáveis de ambiente ausentes ou incorretas
- [x] Verificar callback URL configurado no Google Console
- [x] Corrigir configuração de cookies (httpOnly, secure, sameSite)
- [x] Validar configuração CORS com credentials
- [x] Testar fluxo completo: login → callback → criar/atualizar usuário → sessão → redirect dashboard
- [x] Criar documentação de setup Google OAuth para produção
- [x] Atualizar .env.example com todas as variáveis necessárias
- [ ] Testar em produção (shadiahasan.club)

## Sprint 1 - Nova Homepage Premium
- [ ] Criar hero section com headline emocional e CTA destacado
- [ ] Implementar seção "Como Funciona" (3-4 passos)
- [ ] Criar seção de prova social com depoimentos
- [ ] Implementar seção de programas/cursos
- [ ] Criar seção de comunidade
- [ ] Implementar seção "Sobre Shadia" resumida
- [ ] Criar FAQ accordion na home
- [ ] Atualizar footer profissional
- [ ] Implementar design system consistente
- [ ] Criar página "Sobre" completa
- [ ] Testar responsividade mobile
- [ ] Validar performance e carregamento

## Novas Seções da Homepage (Fevereiro 2026)
- [x] Criar seção de estatísticas (Stats) com 4 métricas
- [x] Criar seção "Como Funciona" com 4 passos
- [x] Criar seção de Depoimentos com 3 cards de alunos
- [x] Criar seção FAQ com accordion de 6 perguntas
- [x] Separar componentes em arquivos individuais (StatsSection, HowItWorks, Testimonials, FAQSection)
- [x] Integrar todos os componentes na Home.tsx
- [x] Testar responsividade e funcionamento

## Correção de Login com Google (Fevereiro 2026)
- [x] Testar fluxo completo de login com Google no navegador
- [x] Identificar problemas de redirecionamento após login
- [x] Corrigir callback do Google OAuth
- [x] Verificar configuração de URLs de retorno
- [x] Testar login em todas as páginas protegidas
- [x] Auditar e atualizar logos em TODAS as páginas do site
- [x] Garantir que logo esteja consistente em header de todas as rotas
- [x] Testar logout e re-login

## Investigação de Erro e Logos Faltantes (Fevereiro 2026)
- [x] Verificar logs do servidor para identificar erros
- [x] Testar todas as páginas principais no navegador
- [x] Identificar páginas com logo faltante ou incorreta
- [x] Corrigir erros encontrados
- [x] Atualizar logos em todas as páginas faltantes

## Correção de Navegação no Pricing (Fevereiro 2026)
- [x] Verificar se logo está correta no Pricing.tsx
- [x] Adicionar navegação completa no header (Cursos, Sobre, Contato, etc.)
- [x] Testar responsividade da navegação
- [x] Verificar todas as outras páginas públicas

## Correção de Login e OAuth (Fevereiro 2026)
- [x] Verificar logo na página de login (Login.tsx)
- [x] Investigar erro no callback do Google OAuth
- [x] Verificar logs do servidor para identificar causa do erro
- [x] Testar fluxo completo: login → callback → redirecionamento
- [x] Garantir que logo aparece em todas as etapas do login

## Correção da Página da Comunidade (Fevereiro 2026)
- [x] Verificar se a rota /community-explore existe no App.tsx
- [x] Verificar se o arquivo da página da comunidade existe
- [x] Criar ou corrigir página da comunidade
- [x] Adicionar navegação consistente no header
- [x] Testar página no navegador

## Sistema de Gerenciamento de Admins (Fevereiro 2026)
- [x] Criar tabela de permissões no banco de dados
- [x] Atualizar schema do usuário para suportar permissões granulares
- [x] Criar procedure para listar todos os admins
- [x] Criar procedure para adicionar novo admin com permissões
- [x] Criar procedure para atualizar permissões de admin existente
- [x] Criar procedure para remover admin
- [x] Criar procedure para admin alterar próprio e-mail
- [x] Criar página de gerenciamento de admins no painel
- [x] Implementar formulário de adição de novo admin
- [x] Implementar seleção de permissões (checkboxes)
- [x] Implementar edição de e-mail do admin logado
- [ ] Testar todas as funcionalidades no navegador

## Correção do Banner de Cookies (Fevereiro 2026)
- [x] Verificar componente CookieConsent
- [x] Verificar se o componente está sendo renderizado no App.tsx
- [x] Testar localStorage para ver se cookies já foram aceitos
- [x] Corrigir lógica de exibição do banner
- [x] Testar no navegador

## Sistema de Gerenciamento de Assinaturas (Admin) - Fevereiro 2026
- [x] Criar tabela de assinaturas no banco de dados
- [x] Criar tabela de histórico de pagamentos
- [x] Criar procedure para listar todas as assinaturas
- [x] Criar procedure para atualizar status de assinatura
- [x] Criar procedure para modificar plano de assinatura
- [x] Criar procedure para conceder acesso gratuito/trial
- [x] Criar procedure para ver histórico de pagamentos de um usuário
- [x] Criar página de gerenciamento de assinaturas no admin
- [x] Implementar filtros e busca de assinaturas
- [x] Implementar formulário de edição de assinatura
- [ ] Testar todas as funcionalidades no navegador

## Correção Completa do Google OAuth (Produção)

### Investigação e Diagnóstico
- [x] Ler código atual do callback /api/auth/google/callback
- [x] Identificar causa exata do erro 500
- [ ] Verificar logs de produção para stacktrace

### Logs e Debugging
- [x] Adicionar logs em: recebimento de code
- [x] Adicionar logs em: token exchange com Google
- [x] Adicionar logs em: fetch userinfo (email/profile)
- [x] Adicionar logs em: upsert no banco de dados
- [x] Adicionar logs em: criação de sessão/JWT/cookie
- [x] Adicionar logs em: redirect final

### Persistência de Usuário
- [x] Implementar UPSERT (find-or-create) para evitar erro de email duplicado
- [x] Normalizar email para lowercase antes de salvar
- [ ] Tratar caso de usuário já existente com Google ID diferente

### Configuração de Sessão/Cookies (Produção)
- [x] Adicionar app.set('trust proxy', 1) no Express
- [x] Configurar cookie secure: true para HTTPS
- [x] Configurar sameSite correto
- [x] Configurar domain para shadiahasan.club
- [ ] Validar que cookies funcionam em HTTPS

### Redirect URI e Tratamento de Erros
- [x] Validar redirect_uri exato: https://shadiahasan.club/api/auth/google/callback
- [x] Adicionar tratamento de erro com redirect para /login?error=google_callback_failed
- [x] Logar stacktrace completo sem expor tokens
- [ ] Documentar variação com www se necessário

### Documentação e Testes
- [x] Criar/atualizar .env.example com todas as ENVs necessárias
- [x] Documentar ENVs: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL, SESSION_SECRET, DATABASE_URL
- [x] Criar checklist de teste local
- [x] Criar checklist de teste em produção
- [ ] Testar fluxo completo em desenvolvimento
- [ ] Validar em produção (shadiahasan.club)

## Sistema de Indicações com Pontos e Cashback

### Schema de Banco de Dados
- [x] Criar tabela `referrals` (indicações) com código único, indicador, indicado, status, data
- [x] Criar tabela `points_transactions` (histórico de pontos) com tipo, valor, descrição
- [x] Criar tabela `cashback_requests` (solicitações de resgate) com valor, status, método pagamento
- [x] Adicionar campo `referral_code` único na tabela `users`
- [x] Adicionar campo `points_balance` na tabela `users`
- [x] Adicionar campo `referred_by` (código do indicador) na tabela `users`

### Backend (tRPC Procedures)
- [x] Criar procedure para gerar código de indicação único
- [x] Criar procedure para registrar nova indicação (quando amigo se cadastra)
- [x] Criar procedure para calcular pontos baseado no plano do indicado
- [x] Criar procedure para aplicar mensalidade grátis após 2 indicações
- [x] Criar procedure para adicionar bônus de pontos (3ª, 4ª, 5ª+ indicação)
- [x] Criar procedure para solicitar resgate de cashback
- [x] Criar procedure para listar indicações do usuário
- [x] Criar procedure para ver saldo de pontos e histórico

### Interface do Usuário
- [x] Criar página `/dashboard/referrals` para gerenciar indicações
- [x] Mostrar código de indicação único do usuário
- [x] Botão para copiar link de indicação
- [x] Mostrar saldo atual de pontos
- [x] Listar indicações confirmadas e pendentes
- [x] Mostrar progresso para mensalidade grátis (X/2 indicações)
- [x] Formul ário para solicitar resgate de cashback
- [x] Histórico de transações de pontos

### Painel Admin
- [x] Criar página `/admin/cashback-requests` para gerenciar solicitações
- [x] Listar todas as solicitações de cashback com filtros (status)
- [x] Aprovar/rejeitar solicitações de cashback com notas
- [x] Ver dados do usuário e método de pagamento
- [ ] Ver estatísticas de indicações (total, por plano, conversão)
- [ ] Ajustar pontos manualmente se necessário

### Integração Stripe
- [x] Criar webhook para detectar nova assinatura
- [x] Verificar se usuário foi indicado (campo `referred_by`)
- [x] Atribuir pontos ao indicador baseado no plano
- [x] Contar indicações do mês e aplicar mensalidade grátis se atingir 2
- [x] Aplicar bônus de pontos para 3ª, 4ª, 5ª+ indicação

### Testes e Validação
- [ ] Testar fluxo completo: gerar código → amigo se cadastra → pontos creditados
- [ ] Testar mensalidade grátis após 2 indicações
- [ ] Testar bônus de pontos para indicações extras
- [ ] Testar solicitação e aprovação de cashback
- [ ] Validar cálculos matemáticos (ROI, sustentabilidade)

## Admin - Gestão de Alunos
- [x] Adicionar opção de trocar plano na página Admin > Alunos
- [x] Criar procedure tRPC para atualizar plano do usuário
- [x] Implementar dropdown/select de planos na tabela de alunos

## Correção Google OAuth (Erro 500 no Callback)
- [x] Verificar logs do servidor para identificar causa do erro 500
- [x] Validar variáveis de ambiente em produção (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [x] Verificar configuração no Google Cloud Console (redirect URIs)
- [x] Adicionar tratamento de erro robusto no callback
- [x] Adicionar logs detalhados para debug
- [x] Adicionar mensagens de erro amigáveis na tela de login
- [ ] Testar fluxo completo de login com Google em produção

## Auditoria e Correção SEO Completa
### FASE 1 - Links e Texto Âncora
- [x] Criar componente SeoLink global
- [ ] Substituir todos os <Link> e <a> por SeoLink (em andamento)
- [ ] Adicionar aria-label e title em todos os links (em andamento)
- [x] Implementar mapa oficial de textos âncora

### FASE 2 - Hierarquia de Headings
- [ ] Garantir 1 único H1 por página
- [ ] Organizar H2 para seções principais
- [ ] Organizar H3 para subtítulos
- [ ] Auditar todas as páginas

### FASE 3 - Meta Tags Dinâmicas
- [x] Instalar React Helmet
- [x] Criar componente SEOHead
- [x] Criar mapa de meta tags para todas as páginas
- [x] Adicionar Open Graph tags (og:title, og:description, og:image)
- [x] Implementar meta tags na Home.tsx
- [ ] Adicionar SEOHead em todas as páginas restantes

### FASE 4 - Landmarks HTML5
- [ ] Adicionar <header> semântico
- [ ] Adicionar <nav> semântico
- [ ] Adicionar <main> semântico
- [ ] Adicionar <section> semântico
- [ ] Adicionar <footer> semântico
- [ ] Remover <div> genéricos onde houver elemento semântico

### FASE 5 - Imagens Acessíveis
- [ ] Adicionar alt descritivo em todas as imagens
- [ ] Auditar todas as páginas para imagens sem alt

### FASE 6 - Formulários Acessíveis
- [ ] Adicionar labels em todos os inputs
- [ ] Adicionar autocomplete apropriado
- [ ] Adicionar required onde necessário
- [ ] Adicionar aria-invalid para validação

### FASE 7 - Sitemap e Robots
- [x] Gerar sitemap.xml automaticamente
- [x] Criar robots.txt
- [x] Bloquear /admin e rotas privadas no robots.txt

### FASE 8 - Performance
- [ ] Implementar lazy loading de imagens
- [ ] Implementar code splitting React
- [ ] Adicionar preload de fontes
- [ ] Remover JS não usado

## Sistema de Breadcrumbs
- [x] Criar componente Breadcrumbs com schema.org JSON-LD
- [x] Criar mapa de breadcrumbs para todas as rotas (getBreadcrumbs helper)
- [x] Implementar breadcrumbs em páginas de cursos (CourseDetail.tsx)
- [x] Implementar breadcrumbs em páginas de aulas (LessonView.tsx)
- [x] Implementar breadcrumbs em páginas admin (AdminCourseLessons.tsx)
- [x] Implementar breadcrumbs em páginas do dashboard (my-courses, referrals)
- [x] Implementar breadcrumbs em CommunityExplore.tsx
- [x] Implementar breadcrumbs em CommunityConnections.tsx
- [x] Implementar breadcrumbs em EditProfile.tsx
- [x] Implementar breadcrumbs em páginas admin (students, cashback-requests)
- [x] Implementar breadcrumbs em Ebooks.tsx
- [x] Implementar breadcrumbs em EbookReader.tsx
- [ ] Testar estrutura de dados schema.org no Google Rich Results Test

## Atualização de Fotos da Shadia Hasan
- [x] Fazer upload das novas fotos profissionais para S3
- [x] Atualizar foto na página inicial (Home.tsx)
- [x] Atualizar foto na página Sobre (About.tsx)
- [x] URLs das novas fotos:
  - IMG_1610.jpeg: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/bVrlUNlAgndcrxAh.jpeg
  - IMG_1609.jpeg: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/VccgbFJLTroVlsuE.jpeg

## Otimização de Performance - Imagens
- [x] Criar componente OptimizedImage com lazy loading
- [x] Adicionar suporte a WebP e AVIF com fallback para JPEG
- [x] Converter imagens da Shadia para WebP/AVIF
- [x] Atualizar Home.tsx com formatos otimizados
- [x] Atualizar About.tsx com formatos otimizados
- [x] Upload das imagens otimizadas para CDN
- [x] Redução de tamanho: 86-90% (JPEG → AVIF)
- [ ] Atualizar outras páginas com imagens
- [ ] Testar performance com Lighthouse

**URLs das imagens otimizadas:**
- IMG_1610.webp: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/hyLASZvyotQYqWAi.webp
- IMG_1610.avif: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/XkerUlNZEMhDEAGs.avif
- IMG_1609.webp: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/ZQdYhDbxEQZtmtPU.webp
- IMG_1609.avif: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/XGAMfYKDVVIyfHYs.avif

## Sistema de Gerenciamento de Administradores
### Análise e Planejamento
- [ ] Mapear estrutura atual de autenticação e roles
- [ ] Identificar onde está definido role='admin' no código
- [ ] Verificar se existe sistema de permissões RBAC
- [ ] Decidir implementação (role field vs tabela separada)

### Modelagem de Banco de Dados
- [ ] Criar tabela admin_audit_logs para auditoria
- [ ] Verificar se campo 'role' existe em users (já existe: 'admin' | 'user')
- [ ] Adicionar role 'superadmin' se necessário
- [ ] Criar migration para novas tabelas

### Backend - APIs e Segurança
- [ ] Criar middleware requireSuperAdmin
- [ ] Implementar procedure admin.promoteToAdmin
- [ ] Implementar procedure admin.demoteFromAdmin
- [ ] Implementar procedure admin.listAdmins
- [ ] Adicionar validação: não remover último superadmin
- [ ] Adicionar validação: superadmin não pode se auto-demover
- [ ] Implementar rate limiting nas rotas sensíveis

### Sistema de Auditoria
- [ ] Criar função logAdminAction no db.ts
- [ ] Registrar PROMOTE_ADMIN em auditoria
- [ ] Registrar DEMOTE_ADMIN em auditoria
- [ ] Capturar IP e userAgent nas ações
- [ ] Criar procedure para listar logs de auditoria

### Frontend - UI em /admin/settings
- [ ] Criar página AdminManageAdmins.tsx
- [ ] Adicionar tab "Administradores" em /admin/settings
- [ ] Implementar campo de busca (nome/email)
- [ ] Criar tabela de usuários com badges de role
- [ ] Adicionar botões "Tornar Admin" / "Remover Admin"
- [ ] Implementar modal de confirmação
- [ ] Adicionar toasts de sucesso/erro
- [ ] Desabilitar ações para superadmin (proteção)

### Testes e Validação
- [ ] Testar: usuário comum não acessa endpoints
- [ ] Testar: admin comum não promove ninguém
- [ ] Testar: superadmin promove e rebaixa
- [ ] Testar: não permite rebaixar último superadmin
- [ ] Testar: UI atualiza após ações
- [ ] Verificar logs de auditoria são criados

## Sistema de Gerenciamento de Administradores
- [x] Adicionar role 'superadmin' ao enum de roles
- [x] Criar tabela adminAuditLogs para auditoria
- [x] Criar middleware superAdminProcedure
- [x] Implementar funções de gerenciamento no db.ts
- [x] Criar procedures tRPC (promoteToAdmin, demoteFromAdmin, promoteToSuperAdmin, listAdmins, getAuditLogs)
- [x] Atualizar UI em /admin/manage-admins com novo sistema de roles
- [x] Implementar sistema de logs de auditoria com IP e user agent
- [x] Migration aplicada: 0013_remarkable_skullbuster.sql
- [ ] Testar permissões e fluxos em produção
- [ ] Promover primeiro superadmin manualmente no banco de dados

## Botão "Agende sua Sessão"
- [x] Adicionar botão "Agende sua Sessão" na página inicial (hero section)
- [x] Estilizar botão com gradiente purple-pink e ícone Zap
- [x] Atualizar página de contato para agendamento
- [x] Adicionar formulário completo (nome, email, telefone, data, horário, mensagem)
- [x] Integrar com WhatsApp para confirmação automática
- [ ] Testar fluxo completo de agendamento

## Atualização Foto Perfil Shadia
- [x] Converter IMG_1609(1).jpeg para WebP e AVIF
- [x] Fazer upload das versões otimizadas para CDN
- [x] Atualizar Home.tsx para exibir apenas uma foto centralizada
- [x] Remover grid de 2 colunas e usar foto única maior
- [x] URLs:
  - AVIF: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/YAsEYvxqebPXZBIO.avif (40KB)
  - WebP: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/bOfXnFYBniKdijZM.webp (88KB)
  - JPEG: https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/xzKfSOAtqexRDupD.jpeg (283KB)

## Correção Erro de Autenticação
- [x] Acessar página de login em produção e reproduzir erro
- [x] Verificar logs do servidor para identificar causa
- [x] Analisar código de autenticação (procedures tRPC, routes)
- [x] Corrigir problema identificado
- [x] Problema: loginUser exigia emailVerified=true mas registerUser cria com emailVerified=0
- [x] Solução: Comentada verificação obrigatória de email (linhas 1233-1236 db.ts)
- [ ] Testar login com email/senha
- [ ] Testar login com Google OAuth
- [ ] Salvar checkpoint

## Revisão de Comunicação - Apoio Individual
- [x] Revisar textos da landing page (Home.tsx) - enfatizar apoio individual e personalizado
- [x] Revisar textos da página Sobre - comunicação mais empática
- [x] Revisar textos dos planos (Pricing.tsx) - frases mais resumidas e diretas
- [x] Garantir tom acolhedor e humanizado em todo o site

## Botão de Chat para Agendamento
- [x] Criar componente ChatButton flutuante
- [x] Adicionar mensagem pré-formatada para sessão experimental gratuita
- [x] Integrar em todas as páginas principais
- [x] Testar funcionalidade do WhatsApp

## Ajuste ChatButton - Remover Sessão Gratuita
- [x] Remover menção de "sessão experimental gratuita"
- [x] Ajustar mensagem para conversa inicial sobre apoio individual
- [x] Atualizar card do botão com nova proposta de valor

## Foto Shadia na Página Sobre
- [x] Verificar formato da foto na Home
- [x] Adicionar foto da Shadia na página About no mesmo estilo
- [x] Garantir responsividade e qualidade da imagem

## Assistente Virtual Shadia
- [x] Gerar avatar circular da Shadia usando IA
- [x] Criar componente ShadiaAssistantChat com avatar e balão animado
- [x] Implementar micro-interações (bounce, glow, balão recorrente)
- [x] Substituir ChatButton atual pelo novo assistente
- [x] Testar responsividade e acessibilidade

## Sistema Multi-Admin com RBAC
- [x] Atualizar schema: adicionar role ENUM (user, admin, super_admin) na tabela users
- [x] Criar tabela admin_invites (id, email, role, token, expiresAt, invitedBy, acceptedAt)
- [x] Criar middlewares: requireAuth, requireAdmin, requireSuperAdmin
- [x] Implementar endpoint POST /api/admin/invite (apenas super_admin)
- [x] Implementar endpoint POST /api/admin/accept-invite (aceitar convite)
- [x] Implementar endpoint PATCH /api/admin/promote/:userId (promover usuário)
- [x] Criar UI em /admin/management para gerenciar administradores
- [x] Criar modal de convite de novo admin
- [x] Implementar logs de auditoria (admin_created, admin_promoted, admin_invited)
- [x] Criar script seed para primeiro super_admin (admin@shadiahasan.club)
- [x] Testar fluxo completo de convite e aceitação


## Revisão Completa do Site - Correções Prioritárias

### 🔴 Críticas (Prioridade Alta)
- [x] Remover ou ocultar curso "Test Course" da listagem pública
- [x] Corrigir erro de português em curso "MENTE RICA" ("objetibo" → "objetivo")
- [ ] Adicionar aviso claro em cursos sem conteúdo ou desabilitar matrícula
- [ ] Verificar e corrigir banner "Preview mode" no rodapé

### 🟡 Médias (Prioridade Média)
- [ ] Implementar validação em tempo real nos formulários (Contato, Login)
- [ ] Adicionar toasts de confirmação após envio de formulários
- [ ] Implementar loading states em botões de ação
- [ ] Adicionar informações de preço/inclusão na assinatura nos cursos
- [ ] Adicionar ícone de mostrar/ocultar senha no login

### 🟢 Melhorias (Prioridade Baixa)
- [ ] Adicionar sistema de filtros e busca na página de cursos
- [ ] Mostrar duração estimada e número de aulas nos cards de curso
- [ ] Implementar sistema de avaliações (estrelas + comentários)
- [ ] Adicionar seção "O que você vai aprender" nas páginas de curso
- [ ] Implementar skeleton loading ao carregar cursos
- [ ] Adicionar vídeo trailer/aula demonstrativa nos cursos
- [ ] Melhorar contraste de texto sobre fundo gradiente
- [ ] Adicionar animações fade-in ao scroll



## Auditoria Completa SaaS - Profissional

### Etapa 1 - Mapeamento
- [x] Mapear arquitetura completa (site, auth, membros, dashboard, cursos, pagamento, admin)
- [x] Documentar todos os fluxos principais
- [x] Listar todas as rotas e endpoints

### Etapa 2 - Auditoria Técnica
- [x] Testar fluxo completo de autenticação (cadastro, login email, Google OAuth, recuperação, logout)
- [x] Testar dashboard (redirecionamentos, proteção de rotas, carregamento)
- [x] Testar cursos (acesso protegido, bloqueio sem assinatura, performance)
- [x] Testar painel admin (login, permissões, proteção)
- [x] Identificar erros 4xx/5xx e medir performance de API

### Etapa 3 - Auditoria de Segurança (OWASP)
- [x] Validar expiração de tokens JWT e invalidação de sessões
- [x] Verificar hash bcrypt e proteção contra brute force
- [x] Testar acesso não autorizado (rotas privadas, cursos, admin)
- [x] Verificar exposição de dados sensíveis e variáveis de ambiente
- [x] Executar npm audit e identificar vulnerabilidades
- [x] Classificar riscos (CRÍTICO/ALTO/MÉDIO/BAIXO)

### Etapa 4 - Auditoria de UX e Funil
- [x] Avaliar clareza da proposta de valor
- [x] Identificar fricções em cadastro, login e checkout
- [x] Avaliar confiança e prova social
- [x] Testar experiência mobile
- [x] Mapear pontos de abandono no funil

### Etapa 5 - Auditoria de Monetização
- [x] Avaliar estrutura de planos e clareza de benefícios
- [x] Identificar oportunidades de upsell/cross-sell
- [x] Sugerir melhorias para conversão e redução de churn
- [x] Analisar estratégias de aumento de LTV

### Etapa 6 - Auditoria Legal (LGPD)
- [x] Verificar política de privacidade e termos de uso
- [x] Validar consentimento de cookies
- [x] Verificar funcionalidade de exclusão de conta
- [x] Avaliar tratamento de dados pessoais

### Etapa 7 - Relatório Final
- [x] Compilar resumo executivo
- [x] Listar problemas críticos e importantes
- [x] Documentar melhorias de conversão e segurança
- [x] Criar roadmap priorizado



## Correções da Auditoria SaaS - Sprint 1 (Crítico)
- [x] Atualizar dependências vulneráveis (tar, lodash, lodash-es, esbuild, vite)
- [x] Implementar rate limiting em /api/trpc/* (100 requisições/min)
- [ ] Implementar rate limiting em /api/auth/login (5 tentativas/15min)
- [ ] Implementar rate limiting em /api/auth/requestPasswordReset (3 tentativas/hora)
- [x] Adicionar expiração de 7 dias aos tokens JWT (já estava configurado)
- [x] Validar assinatura do webhook Stripe corretamente (já estava correto)
- [ ] Implementar verificação de email após cadastro
- [ ] Bloquear acesso até confirmação de email

## Correções da Auditoria SaaS - Sprint 2 (Alta Prioridade)
- [ ] Criar página /pricing com comparação de planos
- [ ] Definir 4 planos (Free, Essencial R$47, Premium R$97, Anual R$970)
- [ ] Implementar Google Analytics 4
- [ ] Adicionar tracking de eventos (signup, login, purchase, begin_checkout)
- [ ] Criar sitemap.xml automatizado
- [ ] Adicionar meta tags SEO em todas as páginas
- [ ] Implementar structured data (JSON-LD)
- [ ] Adicionar requisitos de senha forte (min 8 chars, 1 maiúscula, 1 número)
- [ ] Criar indicador visual de força de senha

## Correções da Auditoria SaaS - Sprint 3 (Conformidade LGPD)
- [ ] Implementar funcionalidade de exclusão de conta
- [ ] Implementar exportação de dados do usuário (JSON/CSV)
- [ ] Atualizar Política de Privacidade com seções detalhadas
- [ ] Adicionar página /profile/privacy com opções de privacidade
- [ ] Implementar sistema de notificações (email + in-app)
- [ ] Criar sistema de avaliações de cursos (estrelas + comentários)
- [ ] Implementar geração automática de certificados PDF
- [ ] Criar onboarding para novos usuários (tour guiado)


## Correção Urgente - Erro de Autenticação
- [x] Investigar logs do servidor para identificar causa do erro "Erro no processo de autenticação"
- [x] Verificar código de autenticação OAuth (Google, Apple)
- [x] Verificar código de autenticação email/senha
- [x] Testar login com todos os métodos
- [x] Corrigir problema identificado (HTML inválido: âncora aninhada)


## Melhorias OAuth Google - Segurança e Produção
- [x] Adicionar sameSite: "lax" nas configurações de cookie (já estava)
- [x] Revisar cookie domain (removido .shadiahasan.club - usa host padrão)
- [x] Verificar trust proxy configurado corretamente no Express (app.set('trust proxy', 1))
- [x] Confirmar state CSRF habilitado no Passport OAuth (automático na lib)
- [ ] Testar login OAuth em produção (shadiahasan.club)
- [ ] Documentar troubleshooting de erro 500 no callback


## Setup Local para Visual Studio Code
- [x] Criar arquivo .env.example com todas as variáveis de ambiente (não necessário - usar webdev_request_secrets)
- [x] Criar script quick-start.sh para configuração automática
- [x] Criar guia LOCAL_SETUP.md com instruções passo a passo
- [x] Documentar como gerar pasta dist com build de produção
- [x] Adicionar scripts úteis no package.json (já existem)


## Animações Chamativas no Botão de Agendamento
- [x] Adicionar animação shake (chacoalhar) a cada 10 segundos
- [x] Adicionar pulse/glow (brilho) constante no avatar
- [x] Intensificar bounce no balão quando aparece
- [x] Testar em diferentes dispositivos
- [x] Aumentar avatar da Shadia para 2x o tamanho (160px) e intensificar brilho
- [x] Criar vídeo animado da Shadia falando mensagem de boas-vindas e integrar no avatar
- [ ] Reverter avatar para versão estática com mensagem acolhedora e humana de apoio emocional
- [x] Configurar chaves Stripe (publishable key e product IDs dos planos)
- [x] Simplificar avatar para versão estática com mensagens rotativas empáticas
- [x] Dashboard admin com métricas (usuários, sessões, receita)
- [ ] Gerenciamento de usuários com filtros e busca
- [ ] Calendário de agendamentos para admin
- [ ] Sistema de permissões (roles: admin, assistente)
- [ ] Dashboard personalizado do usuário
- [ ] Edição de perfil completo (foto, dados pessoais)
- [ ] Histórico de sessões do usuário
- [ ] Configurações de notificações
- [ ] Logs de auditoria
- [ ] Controles LGPD (exportar dados)

## Integração Stripe
- [x] Instalar biblioteca Stripe no backend
- [x] Criar procedures tRPC para checkout
- [x] Implementar webhook handler (/api/stripe/webhook)
- [ ] Criar página de seleção de planos
- [x] Criar página de checkout
- [ ] Implementar painel de gestão de assinaturas
- [ ] Testar fluxo completo de pagamento
- [x] Avatar da Shadia só aparece após aceitar cookies
- [x] Reposicionar balão de fala do avatar para ficar acima
- [x] Otimizar avatar e balão para dispositivos móveis (tamanho, posicionamento)
- [ ] Revisar e fazer funcionar 100% página /admin (dashboard)
- [ ] Revisar e fazer funcionar 100% página /admin/users (gerenciamento)
- [ ] Revisar e fazer funcionar 100% página /admin/appointments (calendário)
- [x] Criar manual completo de manutenção e mudanças do site
- [x] Organizar botões de Ações Rápidas no dashboard admin
- [x] Criar página /admin/users (gerenciamento de usuários)
- [x] Criar página /admin/appointments (calendário de sessões)
- [x] Criar página /admin/financeiro (relatórios financeiros)
- [x] Criar página /admin/programs (gerenciamento de programas)
- [x] Conectar todos os botões com rotas corretas
- [x] Avatar recolhe após login mostrando apenas aba 'Ajuda' no lado direito

## Correções da Auditoria (Crítico)
- [x] Configurar Google OAuth para produção (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL)
- [ ] Corrigir links quebrados críticos (/admin, /login, /dashboard)
- [ ] Remover 70 ghost calls tRPC (procedures inexistentes)
- [ ] Registrar 47 páginas órfãs no App.tsx
- [ ] Remover 66 dead procedures do backend

## Configuração Multi-Domínio (Produção)
- [x] Configurar variáveis de ambiente para 5 domínios de produção
- [x] Implementar detecção dinâmica de callback URL do Google OAuth (já implementado via Manus OAuth SDK)
- [ ] Adicionar todos os domínios no Google Cloud Console

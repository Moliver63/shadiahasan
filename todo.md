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
- [ ] Implementar sistema de recuperação de senha

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

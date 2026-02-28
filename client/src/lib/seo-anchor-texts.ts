/**
 * Mapa oficial de textos âncora para SEO
 * 
 * Define textos descritivos e otimizados para todos os links do site
 * Garante consistência e melhora o SEO interno
 */

export const ANCHOR_TEXTS = {
  // Páginas públicas
  '/': 'Página inicial',
  '/contact': 'Fale conosco',
  '/about': 'Sobre a Shadia Hasan',
  '/signup': 'Criar conta gratuita',
  '/login': 'Entrar na plataforma',
  '/faq': 'Perguntas frequentes',
  '/programs': 'Programas e cursos',
  
  // Comunidade
  '/community': 'Comunidade',
  '/community/explore': 'Explorar comunidade',
  '/community/connections': 'Minhas conexões',
  '/messages': 'Mensagens',
  
  // Área do aluno
  '/dashboard': 'Painel do aluno',
  '/courses': 'Cursos disponíveis',
  '/my-courses': 'Meus cursos',
  '/my-subscription': 'Minha assinatura',
  '/profile': 'Meu perfil',
  '/edit-profile': 'Editar perfil',
  '/certificados': 'Meus certificados',
  '/dashboard/referrals': 'Indicar amigos',
  
  // Autenticação
  '/reset-password': 'Redefinir senha',
  '/verify-email': 'Verificar email',
  
  // Admin
  '/admin': 'Painel administrativo',
  '/admin/courses': 'Gerenciar cursos',
  '/admin/lessons': 'Gerenciar aulas',
  '/admin/students': 'Gerenciar alunos',
  '/admin/plans': 'Gerenciar planos',
  '/admin/manage-subscriptions': 'Assinaturas',
  '/admin/cashback-requests': 'Solicitações de cashback',
  '/admin/settings': 'Configurações da plataforma',
  '/admin/manage-admins': 'Administradores',
  '/admin/moderation': 'Moderação da comunidade',
} as const;

/**
 * Obtém o texto âncora oficial para uma rota
 * @param path - Caminho da rota
 * @returns Texto âncora descritivo
 */
export function getAnchorText(path: string): string {
  return ANCHOR_TEXTS[path as keyof typeof ANCHOR_TEXTS] || path;
}

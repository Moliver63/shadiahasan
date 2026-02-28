/**
 * Mapa de meta tags SEO para todas as páginas do site
 * 
 * Define títulos, descrições e palavras-chave otimizados para SEO
 */

export interface PageSEO {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
}

export const SEO_META_TAGS: Record<string, PageSEO> = {
  '/': {
    title: 'Psicologia e Desenvolvimento Humano em Realidade Virtual',
    description: 'Transforme sua vida através de experiências imersivas em VR. Cursos de psicologia, maturidade emocional e desenvolvimento pessoal com Shadia Hasan.',
    keywords: 'psicologia, desenvolvimento pessoal, realidade virtual, VR, maturidade emocional, transformação interior, Shadia Hasan',
  },
  
  '/about': {
    title: 'Sobre Shadia Hasan',
    description: 'Conheça a trajetória da psicóloga e mentora Shadia Hasan e sua abordagem de maturidade emocional e transformação pessoal através da realidade virtual.',
    keywords: 'Shadia Hasan, psicóloga, mentora, biografia, trajetória profissional',
  },
  
  '/contact': {
    title: 'Fale Conosco',
    description: 'Entre em contato com Shadia Hasan para dúvidas, suporte ou informações sobre os programas de desenvolvimento pessoal em realidade virtual.',
    keywords: 'contato, suporte, atendimento, fale conosco',
  },
  
  '/courses': {
    title: 'Programas e Cursos Online',
    description: 'Explore nossos programas de desenvolvimento pessoal e psicologia em realidade virtual. Experiências imersivas para transformação interior.',
    keywords: 'cursos online, programas VR, desenvolvimento pessoal, psicologia online, cursos de psicologia',
  },
  
  '/faq': {
    title: 'Perguntas Frequentes',
    description: 'Tire suas dúvidas sobre os programas, plataforma VR, pagamentos e suporte técnico. Respostas para as perguntas mais comuns.',
    keywords: 'FAQ, perguntas frequentes, dúvidas, ajuda, suporte',
  },
  
  '/login': {
    title: 'Entrar na Plataforma',
    description: 'Acesse sua conta na plataforma Shadia Hasan e continue sua jornada de transformação interior.',
    keywords: 'login, entrar, acessar conta, área do aluno',
  },
  
  '/signup': {
    title: 'Criar Conta Gratuita',
    description: 'Crie sua conta gratuita e comece sua jornada de transformação pessoal com acesso a conteúdos exclusivos.',
    keywords: 'cadastro, criar conta, registro, inscrição gratuita',
  },
  
  '/dashboard': {
    title: 'Painel do Aluno',
    description: 'Acesse seu painel de controle, acompanhe seu progresso e gerencie suas atividades na plataforma.',
    keywords: 'dashboard, painel do aluno, área do aluno, meus cursos',
  },
  
  '/my-courses': {
    title: 'Meus Cursos',
    description: 'Acesse todos os seus cursos matriculados e continue sua jornada de aprendizado.',
    keywords: 'meus cursos, cursos matriculados, aulas, conteúdo',
  },
  
  '/my-subscription': {
    title: 'Minha Assinatura',
    description: 'Gerencie sua assinatura, plano e pagamentos na plataforma Shadia Hasan.',
    keywords: 'assinatura, plano, pagamento, fatura, upgrade',
  },
  
  '/community': {
    title: 'Comunidade',
    description: 'Conecte-se com outros membros, compartilhe experiências e cresça junto com a comunidade Shadia Hasan.',
    keywords: 'comunidade, networking, conexões, membros, interação',
  },
  
  '/dashboard/referrals': {
    title: 'Programa de Indicações',
    description: 'Indique amigos e ganhe recompensas. A cada 2 indicações, ganhe 1 mês grátis de acesso premium.',
    keywords: 'indicações, programa de afiliados, cashback, recompensas, indicar amigos',
  },
};

/**
 * Obtém meta tags SEO para uma rota específica
 * @param path - Caminho da rota
 * @returns Objeto com meta tags ou valores padrão
 */
export function getSEOMetaTags(path: string): PageSEO {
  return SEO_META_TAGS[path] || {
    title: 'Plataforma de Desenvolvimento Pessoal',
    description: 'Transforme sua vida através de experiências imersivas em realidade virtual com Shadia Hasan.',
    keywords: 'psicologia, desenvolvimento pessoal, realidade virtual',
  };
}

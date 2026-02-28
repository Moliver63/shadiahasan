import { BreadcrumbItem } from "@/components/Breadcrumbs";

/**
 * Helper para gerar breadcrumbs dinamicamente baseado na rota
 */

export function getBreadcrumbs(path: string, params?: Record<string, string>): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];

  // Cursos
  if (path === '/courses') {
    breadcrumbs.push({ label: 'Programas', href: '/courses' });
  }
  
  if (path.startsWith('/courses/') && params?.courseId) {
    breadcrumbs.push({ label: 'Programas', href: '/courses' });
    breadcrumbs.push({ 
      label: params.courseTitle || 'Curso', 
      href: `/courses/${params.courseId}` 
    });
  }

  if (path.startsWith('/lesson/') && params?.lessonId) {
    breadcrumbs.push({ label: 'Programas', href: '/courses' });
    if (params.courseId && params.courseTitle) {
      breadcrumbs.push({ 
        label: params.courseTitle, 
        href: `/courses/${params.courseId}` 
      });
    }
    breadcrumbs.push({ 
      label: params.lessonTitle || 'Aula', 
      href: `/lesson/${params.lessonId}` 
    });
  }

  // Meus Cursos
  if (path === '/my-courses') {
    breadcrumbs.push({ label: 'Meus Cursos', href: '/my-courses' });
  }

  // Dashboard
  if (path === '/dashboard') {
    breadcrumbs.push({ label: 'Painel', href: '/dashboard' });
  }

  if (path === '/my-subscription') {
    breadcrumbs.push({ label: 'Painel', href: '/dashboard' });
    breadcrumbs.push({ label: 'Minha Assinatura', href: '/my-subscription' });
  }

  if (path === '/dashboard/referrals') {
    breadcrumbs.push({ label: 'Painel', href: '/dashboard' });
    breadcrumbs.push({ label: 'Indicações', href: '/dashboard/referrals' });
  }

  // Admin
  if (path.startsWith('/admin')) {
    breadcrumbs.push({ label: 'Admin', href: '/admin' });

    if (path === '/admin/courses') {
      breadcrumbs.push({ label: 'Programas', href: '/admin/courses' });
    }
    
    if (path.startsWith('/admin/courses/') && params?.courseId) {
      breadcrumbs.push({ label: 'Programas', href: '/admin/courses' });
      breadcrumbs.push({ 
        label: params.courseTitle || 'Aulas do Programa', 
        href: `/admin/courses/${params.courseId}/lessons` 
      });
    }

    if (path === '/admin/students') {
      breadcrumbs.push({ label: 'Alunos', href: '/admin/students' });
    }

    if (path === '/admin/plans') {
      breadcrumbs.push({ label: 'Planos', href: '/admin/plans' });
    }

    if (path === '/admin/settings') {
      breadcrumbs.push({ label: 'Configurações', href: '/admin/settings' });
    }

    if (path === '/admin/cashback-requests') {
      breadcrumbs.push({ label: 'Solicitações de Cashback', href: '/admin/cashback-requests' });
    }
  }

  // Comunidade
  if (path.startsWith('/community')) {
    breadcrumbs.push({ label: 'Comunidade', href: '/community' });

    if (path === '/community/explore') {
      breadcrumbs.push({ label: 'Explorar', href: '/community/explore' });
    }

    if (path === '/community/connections') {
      breadcrumbs.push({ label: 'Conexões', href: '/community/connections' });
    }
  }

  // Páginas institucionais
  if (path === '/about') {
    breadcrumbs.push({ label: 'Sobre', href: '/about' });
  }

  if (path === '/contact') {
    breadcrumbs.push({ label: 'Contato', href: '/contact' });
  }

  if (path === '/faq') {
    breadcrumbs.push({ label: 'FAQ', href: '/faq' });
  }

  // E-books
  if (path === '/ebooks') {
    breadcrumbs.push({ label: 'E-books', href: '/ebooks' });
  }

  if (path.startsWith('/ebook/') && params?.ebookId) {
    breadcrumbs.push({ label: 'E-books', href: '/ebooks' });
    breadcrumbs.push({ 
      label: params.ebookTitle || 'E-book', 
      href: `/ebook/${params.ebookId}` 
    });
  }

  // Perfil
  if (path === '/edit-profile') {
    breadcrumbs.push({ label: 'Painel', href: '/dashboard' });
    breadcrumbs.push({ label: 'Editar Perfil', href: '/edit-profile' });
  }

  // Mensagens
  if (path === '/messages') {
    breadcrumbs.push({ label: 'Painel', href: '/dashboard' });
    breadcrumbs.push({ label: 'Mensagens', href: '/messages' });
  }

  return breadcrumbs;
}

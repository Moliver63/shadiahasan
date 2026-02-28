import { Link } from "wouter";
import { ReactNode } from "react";

interface SeoLinkProps {
  to: string;
  label: string;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * SeoLink - Componente de link otimizado para SEO e acessibilidade
 * 
 * Garante que todos os links tenham:
 * - Texto âncora visível ou aria-label
 * - Atributo title para tooltip
 * - Conformidade com WCAG AA
 */
export function SeoLink({ to, label, children, className, onClick }: SeoLinkProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={className}
      onClick={onClick}
    >
      {children ?? label}
    </Link>
  );
}

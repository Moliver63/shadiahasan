import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";
import { JsonLd } from "./JsonLd";
import { urlAbsoluta } from "@/lib/site";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": urlAbsoluta(item.href)
    }))
  };

  return (
    <>
      <JsonLd dados={breadcrumbSchema} />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          {/* 
            FIX: <Link> do wouter já renderiza como <a>.
            Antes estava: <Link><a>...</a></Link> → <a><a> = hydration error
            Agora: <Link className="...">conteúdo</Link> → apenas um <a>
          */}
          <li className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
              <span>Início</span>
            </Link>
            <ChevronRight className="h-4 w-4" />
          </li>

          {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
              <li key={item.href} className="flex items-center gap-2">
                {isLast ? (
                  <span className="font-medium text-foreground" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <>
                    <Link
                      href={item.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

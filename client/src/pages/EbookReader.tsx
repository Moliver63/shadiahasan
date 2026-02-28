import { useAuth } from "@/_core/hooks/useAuth";
import PdfViewer from "@/components/PdfViewer";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function EbookReader() {
  const params = useParams();
  const ebookId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const { data: ebook, isLoading } = trpc.ebooks.getById.useQuery(
    { id: ebookId },
    { enabled: ebookId > 0 && isAuthenticated }
  );

  // Aguarda resolução do estado de autenticação antes de redirecionar
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ebook) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-gray-700 mb-4">
          Ebook não encontrado
        </h1>
        <Link href="/ebooks">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Biblioteca
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/ebooks")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{ebook.title}</h1>
            {ebook.description && (
              <p className="text-sm text-gray-500">{ebook.description}</p>
            )}
          </div>
        </div>
      </header>

      <div className="container py-4">
        <Breadcrumbs
          items={getBreadcrumbs(`/ebook/${ebookId}`, {
            ebookId: ebookId.toString(),
            ebookTitle: ebook.title,
          })}
        />
      </div>

      {/* PDF Viewer */}
      <PdfViewer fileUrl={ebook.fileUrl} title={ebook.title} />
    </div>
  );
}

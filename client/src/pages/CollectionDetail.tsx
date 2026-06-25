/**
 * CollectionDetail — Página pública de um agrupamento de conteúdo
 * Rota: /collections/:id
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "@/lib/formatDuration";
import { BookOpen, PlayCircle, Lock, ArrowLeft, Clock, Layers } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import PublicHeader from "@/components/PublicHeader";
import { toast } from "sonner";

export default function CollectionDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: collection, isLoading } = trpc.collections.getById.useQuery(
    { id: id || 0 },
    { enabled: id > 0, staleTime: 0, refetchOnMount: "always" }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-12 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card><CardContent className="py-12 text-center">
          <p className="text-lg mb-4">Agrupamento não encontrado</p>
          <Link href="/courses"><Button>Voltar ao catálogo</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  const lessons = (collection.lessons ?? []).filter((i: any) => i.lesson?.isPublished === 1);
  const totalDuration = lessons.reduce((acc: number, i: any) => acc + (i.lesson?.duration || 0), 0);

  function handleStart(lesson: any) {
    if (!isAuthenticated) { toast.error("Faça login para assistir."); return; }
    setLocation(`/lesson/${lesson.lessonId}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
        ]}
        className="bg-card"
      />

      <div className="container py-6 md:py-10">
        <Link href="/courses">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar ao catálogo
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Layers className="h-4 w-4" /><span>Agrupamento de conteúdo</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{collection.title}</h1>
              {collection.subtitle && <p className="text-lg text-primary/80 mb-2">{collection.subtitle}</p>}
              {collection.description && <p className="text-muted-foreground">{collection.description}</p>}
            </div>

            {collection.coverUrl && (
              <div className="h-56 w-full overflow-hidden rounded-lg bg-muted sm:h-72">
                <img src={collection.coverUrl} alt={collection.title} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Lista de aulas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />Conteúdo do programa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lessons.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma aula disponível.</p>
                ) : lessons.map((item: any, idx: number) => (
                  <div key={item.id}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleStart(item)}>
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.lesson?.title}</p>
                      <p className="text-xs text-muted-foreground">{item.course?.title}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                      {item.lesson?.duration && <span>{formatDuration(item.lesson.duration)}</span>}
                      {isAuthenticated ? <PlayCircle className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Aulas</p>
                    <p className="text-sm text-muted-foreground">{lessons.length} aulas disponíveis</p>
                  </div>
                </div>
                {totalDuration > 0 && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Duração total</p>
                      <p className="text-sm text-muted-foreground">{formatDuration(totalDuration)}</p>
                    </div>
                  </div>
                )}
                {!isAuthenticated && (
                  <Button className="w-full" size="lg" onClick={() => setLocation("/login")}>
                    Entrar para assistir
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <footer className="border-t bg-card mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Shadia VR Platform. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

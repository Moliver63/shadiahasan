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
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Layers className="h-4 w-4" /><span>Programa de conteúdo</span>
              </div>
              <h1 className="text-3xl font-bold mb-2">{collection.title}</h1>
              {collection.subtitle && (
                <p className="text-xl text-primary/80 font-medium mb-3">{collection.subtitle}</p>
              )}
              {collection.description && (
                <p className="text-muted-foreground leading-relaxed">{collection.description}</p>
              )}
            </div>

            {/* Capa mobile — aparece só abaixo de lg */}
            {collection.coverUrl && (
              <div className="lg:hidden h-48 w-full overflow-hidden rounded-xl bg-muted">
                <img src={collection.coverUrl} alt={collection.title} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Lista de aulas */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" /> Conteúdo do programa
              </h2>
              {lessons.length === 0 ? (
                <Card><CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Nenhuma aula disponível.</p>
                </CardContent></Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {lessons.map((item: any, idx: number) => (
                    <div key={item.id}
                      className="group cursor-pointer rounded-lg border overflow-hidden bg-card hover:border-primary/50 transition-all"
                      onClick={() => handleStart(item)}>
                      {/* Capa */}
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        {item.course?.thumbnail ? (
                          <img
                            src={item.course.thumbnail}
                            alt={item.lesson?.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlayCircle className="h-8 w-8 text-muted-foreground/40" />
                          </div>
                        )}
                        {/* Número */}
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold rounded px-1.5 py-0.5">
                          {idx + 1}
                        </div>
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isAuthenticated
                            ? <PlayCircle className="h-10 w-10 text-white" />
                            : <Lock className="h-8 w-8 text-white" />}
                        </div>
                        {/* Duração */}
                        {item.lesson?.duration && (
                          <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs rounded px-1.5 py-0.5">
                            {formatDuration(item.lesson.duration)}
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-2.5">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">{item.lesson?.title}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{item.course?.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Capa desktop */}
            {collection.coverUrl && (
              <div className="hidden lg:block overflow-hidden rounded-xl border">
                <img src={collection.coverUrl} alt={collection.title} className="w-full object-cover" />
              </div>
            )}
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

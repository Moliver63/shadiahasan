import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BookOpen, PlayCircle, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function MyCourses() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: enrollments, isLoading } =
    trpc.enrollments.myEnrollments.useQuery(undefined, {
      enabled: isAuthenticated,
    });

  // Busca todos os cursos matriculados de uma vez (evita hook dentro de .map)
  const courseIds = enrollments?.map((e) => e.courseId) ?? [];
  const { data: coursesData } = trpc.courses.getByIds.useQuery(
    { ids: courseIds },
    { enabled: courseIds.length > 0 }
  );

  // Monta mapa id -> curso para acesso rápido
  const courseMap = new Map(coursesData?.map((c) => [c.id, c]) ?? []);

  // Aguarda estado de autenticação ser resolvido antes de redirecionar
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <img
              src="/logo.png"
              alt="Shadia Hasan - Psicologia & Desenvolvimento Humano"
              className="h-36 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/courses">
              <Button variant="ghost">Catálogo</Button>
            </Link>
            <Link href="/my-courses">
              <Button>Meus Cursos</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container py-12">
        <Breadcrumbs items={getBreadcrumbs("/my-courses")} />

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Meus Cursos</h1>
          <p className="text-lg text-muted-foreground">
            Olá, {user?.name}! Continue seu aprendizado
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted animate-pulse rounded mb-2"></div>
                  <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-10 w-full bg-muted animate-pulse rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : enrollments && enrollments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => {
              const course = courseMap.get(enrollment.courseId);
              if (!course) return null;

              return (
                <Card
                  key={enrollment.id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    {course.thumbnail && (
                      <div className="w-full h-48 mb-4 rounded-lg overflow-hidden bg-muted">
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                    {course.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {course.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">{enrollment.progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${enrollment.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        <span>Em progresso</span>
                      </div>
                    </div>

                    <Link href={`/courses/${course.slug}`}>
                      <Button className="w-full">
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Continuar Aprendendo
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground mb-4">
                Você ainda não está matriculado em nenhum curso
              </p>
              <Link href="/courses">
                <Button>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Explorar Cursos
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-card mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Shadia VR Platform. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

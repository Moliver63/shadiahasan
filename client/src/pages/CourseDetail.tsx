import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BookOpen, PlayCircle, CheckCircle, Lock, ArrowLeft } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";
import { toast } from "sonner";

export default function CourseDetail() {
  const params = useParams();
  const slug = params.slug || "";
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const { data: course, isLoading: courseLoading } =
    trpc.courses.getBySlug.useQuery({ slug });

  const { data: lessons, isLoading: lessonsLoading } =
    trpc.lessons.listByCourse.useQuery(
      { courseId: course?.id || 0 },
      { enabled: !!course }
    );

  const { data: enrollmentData } = trpc.enrollments.checkEnrollment.useQuery(
    { courseId: course?.id || 0 },
    { enabled: !!course && isAuthenticated }
  );

  const utils = trpc.useUtils();
  const enrollMutation = trpc.enrollments.enroll.useMutation({
    onSuccess: () => {
      toast.success("Matrícula realizada com sucesso!");
      utils.enrollments.checkEnrollment.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao matricular: ${error.message}`);
    },
  });

  const isEnrolled = enrollmentData?.enrolled || false;

  const handleEnroll = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (course) {
      enrollMutation.mutate({ courseId: course.id });
    }
  };

  const handleStartLesson = (lessonId: number) => {
    if (!isEnrolled) {
      toast.error("Você precisa se matricular no curso primeiro");
      return;
    }
    setLocation(`/lesson/${lessonId}`);
  };

  if (courseLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12">
          <div className="h-8 w-32 bg-muted animate-pulse rounded mb-8"></div>
          <div className="h-12 w-3/4 bg-muted animate-pulse rounded mb-4"></div>
          <div className="h-6 w-full bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg mb-4">Curso não encontrado</p>
            <Link href="/courses">
              <Button>Voltar para Cursos</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/KQbMXrKxSjIsEkev.png" 
              alt="Shadia Hasan - Psicologia & Desenvolvimento Humano" 
              className="h-36 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/courses">
              <Button variant="ghost">Cursos</Button>
            </Link>
            {isAuthenticated ? (
                <UserMenu />
              ) : (
                <Button onClick={() => (window.location.href = getLoginUrl())}>
                  Entrar
                </Button>
              )}
          </nav>
        </div>
      </header>

      <div className="container py-8">
        <Link href="/courses">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Cursos
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
              {course.description && (
                <p className="text-lg text-muted-foreground">
                  {course.description}
                </p>
              )}
            </div>

            {course.thumbnail && (
              <div className="w-full h-96 rounded-lg overflow-hidden bg-muted">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Lessons List */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Conteúdo do Curso
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lessonsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-16 bg-muted animate-pulse rounded"
                      ></div>
                    ))}
                  </div>
                ) : lessons && lessons.length > 0 ? (
                  <div className="space-y-2">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          isEnrolled
                            ? "hover:bg-accent cursor-pointer"
                            : "opacity-60"
                        }`}
                        onClick={() =>
                          isEnrolled && handleStartLesson(lesson.id)
                        }
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{lesson.title}</h4>
                            {lesson.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {lesson.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {lesson.duration && (
                            <span className="text-sm text-muted-foreground">
                              {Math.floor(lesson.duration / 60)} min
                            </span>
                          )}
                          {isEnrolled ? (
                            <PlayCircle className="h-5 w-5 text-primary" />
                          ) : (
                            <Lock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma aula disponível ainda
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Aulas</p>
                    <p className="text-sm text-muted-foreground">
                      {lessons?.length || 0} aulas disponíveis
                    </p>
                  </div>
                </div>

                {isEnrolled ? (
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Matriculado</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Você já está matriculado neste curso
                    </p>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleEnroll}
                    disabled={enrollMutation.isPending}
                  >
                    {enrollMutation.isPending
                      ? "Matriculando..."
                      : "Matricular-se Agora"}
                  </Button>
                )}

                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground text-center">
                    Faça login para se matricular no curso
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Experiência VR</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Este curso oferece experiência imersiva em realidade virtual
                  compatível com Meta Quest.
                </p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>✓ Visualização 360°</p>
                  <p>✓ Controles VR nativos</p>
                  <p>✓ Ambiente imersivo</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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

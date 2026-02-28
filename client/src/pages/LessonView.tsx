import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import VideoPlayer from "@/components/VideoPlayer";
import VRViewer from "@/components/VRViewer";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function LessonView() {
  const params = useParams();
  const lessonId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [showVR, setShowVR] = useState(false);

  const { data: lesson, isLoading: lessonLoading } =
    trpc.lessons.getById.useQuery(
      { id: lessonId },
      { enabled: isAuthenticated && lessonId > 0 }
    );

  const { data: course } = trpc.courses.getById.useQuery(
    { id: lesson?.courseId || 0 },
    { enabled: !!lesson }
  );

  const { data: enrollmentData } = trpc.enrollments.checkEnrollment.useQuery(
    { courseId: lesson?.courseId || 0 },
    { enabled: !!lesson && isAuthenticated }
  );

  const { data: allLessons } = trpc.lessons.listByCourse.useQuery(
    { courseId: lesson?.courseId || 0 },
    { enabled: !!lesson }
  );

  const updateProgressMutation = trpc.enrollments.updateProgress.useMutation();

  const isEnrolled = enrollmentData?.enrolled || false;

  const handleProgress = (progress: number) => {
    if (lesson && isEnrolled && progress > 90) {
      updateProgressMutation.mutate({
        courseId: lesson.courseId,
        progress: 100,
        completedLessons: JSON.stringify([lessonId]),
      });
    }
  };

  const handleComplete = () => {
    if (lesson && isEnrolled) {
      toast.success("Aula concluída!");
      const currentIndex = allLessons?.findIndex((l) => l.id === lessonId);
      if (
        currentIndex !== undefined &&
        currentIndex >= 0 &&
        allLessons &&
        currentIndex < allLessons.length - 1
      ) {
        const nextLesson = allLessons[currentIndex + 1];
        setLocation(`/lesson/${nextLesson?.id}`);
      }
    }
  };

  // Aguarda resolução do estado de autenticação antes de redirecionar
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (lessonLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12">
          <div className="h-8 w-32 bg-muted animate-pulse rounded mb-8"></div>
          <div className="h-96 bg-muted animate-pulse rounded"></div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg mb-4">Aula não encontrada</p>
            <Link href="/courses">
              <Button>Voltar para Cursos</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center max-w-md">
            <p className="text-lg mb-4">
              Você precisa estar matriculado neste curso para acessar esta aula
            </p>
            <Link href={`/courses/${course?.slug}`}>
              <Button>Ver Curso</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIndex = allLessons?.findIndex((l) => l.id === lessonId) || 0;
  const nextLesson =
    allLessons && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;
  const prevLesson =
    allLessons && currentIndex > 0 ? allLessons[currentIndex - 1] : null;

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
            <Link href="/my-courses">
              <Button variant="ghost">Meus Cursos</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container py-8">
        {lesson && course && (
          <Breadcrumbs
            items={getBreadcrumbs(`/lesson/${lessonId}`, {
              lessonId: lessonId.toString(),
              lessonTitle: lesson.title,
              courseId: course.id.toString(),
              courseTitle: course.title,
            })}
          />
        )}

        <Link href={`/courses/${course?.slug}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para o Curso
          </Button>
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
              {course && (
                <p className="text-muted-foreground">Curso: {course.title}</p>
              )}
            </div>

            {/* Video Player */}
            {lesson.videoPlaybackUrl ? (
              <div className="space-y-4">
                {!showVR ? (
                  <>
                    <VideoPlayer
                      src={lesson.videoPlaybackUrl}
                      title={lesson.title}
                      onProgress={handleProgress}
                      onComplete={handleComplete}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowVR(true)}
                    >
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Ver em Modo VR 360°
                    </Button>
                  </>
                ) : (
                  <VRViewer
                    videoUrl={lesson.videoPlaybackUrl}
                    title={lesson.title}
                    onClose={() => setShowVR(false)}
                  />
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Vídeo não disponível para esta aula
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Lesson Description */}
            {lesson.description && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Sobre esta aula</h3>
                  <p className="text-muted-foreground">{lesson.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between gap-4">
              {prevLesson ? (
                <Link href={`/lesson/${prevLesson.id}`}>
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Aula Anterior
                  </Button>
                </Link>
              ) : (
                <div></div>
              )}
              {nextLesson && (
                <Link href={`/lesson/${nextLesson.id}`}>
                  <Button>
                    Próxima Aula
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Sidebar - Lessons List */}
          <div>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Conteúdo do Curso</h3>
                <div className="space-y-2">
                  {allLessons?.map((l, index) => (
                    <Link key={l.id} href={`/lesson/${l.id}`}>
                      <div
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          l.id === lessonId
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-medium">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">
                              {l.title}
                            </p>
                            {l.duration && (
                              <p className="text-xs opacity-70 mt-1">
                                {Math.floor(l.duration / 60)} min
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-card mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Shadia VR Platform. Todos os direitos
            reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import PublicHeader from "@/components/PublicHeader";
import VideoPlayer from "@/components/VideoPlayer";
import VRViewer from "@/components/VRViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { formatDuration } from "@/lib/formatDuration";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Lock, Maximize2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";

// Detecta se a URL é do YouTube
function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/.test(url);
}

function parseCompletedLessons(value?: string | null): number[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  } catch {
    return [];
  }
}

export default function LessonView() {
  const params = useParams();
  const lessonId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [showVR, setShowVR] = useState(false);
  const [hasMarkedComplete, setHasMarkedComplete] = useState(false);
  const utils = trpc.useUtils();

  const { data: lesson, isLoading: lessonLoading } =
    trpc.lessons.getById.useQuery({ id: lessonId });

  const { data: course } = trpc.courses.getById.useQuery(
    { id: lesson?.courseId || 0 },
    { enabled: !!lesson }
  );

  // Verifica acesso real (assinatura ativa no nível certo OU compra avulsa),
  // não apenas "matrícula" — substitui a antiga checagem enrollments.checkEnrollment
  // que bloqueava assinantes pagantes sem registro de matrícula.
  const { data: accessData, isLoading: accessLoading } =
    trpc.videos.hasAccess.useQuery(
      { lessonId },
      { enabled: !!lesson && isAuthenticated }
    );

  const { data: allLessons } = trpc.lessons.listByCourse.useQuery(
    { courseId: lesson?.courseId || 0 },
    { enabled: !!lesson }
  );

  const { data: enrollmentData } = trpc.enrollments.checkEnrollment.useQuery(
    { courseId: lesson?.courseId || 0 },
    { enabled: !!lesson && isAuthenticated }
  );

  const updateProgressMutation = trpc.enrollments.updateProgress.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.enrollments.checkEnrollment.invalidate({
          courseId: lesson?.courseId || 0,
        }),
        utils.enrollments.myEnrollments.invalidate(),
      ]);
    },
  });

  const hasAccess = accessData?.hasAccess ?? false;
  const completedLessons = useMemo(() => {
    return parseCompletedLessons(enrollmentData?.enrollment?.completedLessons);
  }, [enrollmentData?.enrollment?.completedLessons]);

  const currentLessonAlreadyCompleted = completedLessons.includes(lessonId);
  const isCurrentLessonCompleted =
    currentLessonAlreadyCompleted || hasMarkedComplete;

  const mergedCompletedLessons = useMemo(() => {
    const set = new Set<number>(completedLessons);

    if (isCurrentLessonCompleted && lessonId > 0) {
      set.add(lessonId);
    }

    return Array.from(set);
  }, [completedLessons, isCurrentLessonCompleted, lessonId]);

  const totalLessons = allLessons?.length ?? 0;
  const calculatedProgress = totalLessons > 0
    ? Math.min(
        100,
        Math.round((mergedCompletedLessons.length / totalLessons) * 100)
      )
    : 0;

  const currentIndex = allLessons?.findIndex((l) => l.id === lessonId) ?? -1;
  const nextLesson =
    allLessons && currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;
  const nextUnlockedLesson =
    allLessons && currentIndex >= 0
      ? allLessons.slice(currentIndex + 1).find((lesson: any) => !lesson.isPathLocked) ?? null
      : null;
  const prevLesson =
    allLessons && currentIndex > 0 ? allLessons[currentIndex - 1] : null;

  const nextStepLabel = nextUnlockedLesson
    ? isCurrentLessonCompleted
      ? `Seu próximo passo é continuar com "${nextUnlockedLesson.title}".`
      : `Ao concluir esta aula, seu próximo passo será "${nextUnlockedLesson.title}".`
    : nextLesson?.isPathLocked && nextLesson.unlockLabel
      ? nextLesson.unlockLabel
      : isCurrentLessonCompleted
        ? "Parabéns! Você concluiu a última aula disponível desta etapa do curso."
        : "Conclua esta aula para finalizar o curso e registrar seu avanço.";

  const shouldFetchPlaybackUrl =
    !!lesson &&
    hasAccess &&
    (Boolean(lesson.videoPlaybackUrl) ||
      (lesson.videoProvider === "cloudflare" && Boolean(lesson.videoAssetId)));

  const { data: playbackData, isLoading: playbackLoading } =
    trpc.videos.getPlaybackUrl.useQuery(
      { lessonId },
      {
        enabled: shouldFetchPlaybackUrl,
        refetchOnWindowFocus: false,
      }
    );

  const markLessonAsCompleted = () => {
    if (!lesson || !hasAccess || totalLessons === 0) return;
    if (
      hasMarkedComplete ||
      currentLessonAlreadyCompleted ||
      updateProgressMutation.isPending
    ) {
      return;
    }

    updateProgressMutation.mutate(
      {
        courseId: lesson.courseId,
        progress: calculatedProgress,
        completedLessons: JSON.stringify([...new Set([...completedLessons, lessonId])]),
      },
      {
        onSuccess: () => {
          setHasMarkedComplete(true);
        },
      }
    );
  };

  const handleProgress = (progress: number) => {
    if (lesson && hasAccess && progress > 90) {
      markLessonAsCompleted();
    }
  };

  const handleComplete = () => {
    if (lesson && hasAccess) {
      markLessonAsCompleted();
      toast.success("Aula concluída!");
    }
  };

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (lessonLoading || accessLoading) {
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

  // Aula restrita por assinatura/compra ou bloqueada pela trilha pedagógica
  if (!hasAccess) {
    const isLearningPathLocked = accessData?.reason === "learning_path_locked";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center max-w-md">
            <Lock className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg mb-2 font-semibold">
              {isLearningPathLocked ? "Aula ainda não liberada" : "Conteúdo exclusivo"}
            </p>
            <p className="text-muted-foreground mb-6">
              {isLearningPathLocked
                ? accessData?.nextUnlockLabel ||
                  "Esta aula faz parte de uma etapa futura da sua trilha de aprendizado."
                : "Esta aula é exclusiva para assinantes ou para quem adquiriu este curso individualmente. Assine um plano ou compre o curso para continuar."}
            </p>
            <div className="flex flex-col gap-2">
              {course && (
                <Link href={`/courses/${course.slug}`}>
                  <Button className="w-full">
                    {isLearningPathLocked ? "Voltar para a trilha" : "Ver opções do curso"}
                  </Button>
                </Link>
              )}
              {!isLearningPathLocked && (
                <Link href="/pricing">
                  <Button variant="outline" className="w-full">
                    Ver planos de assinatura
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const playbackUrl = playbackData?.url || lesson.videoPlaybackUrl || null;

  // YouTube não suporta VR — oculta o botão nesses casos
  const isYouTube = playbackUrl ? isYouTubeUrl(playbackUrl) : false;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Meus Cursos", href: "/my-courses" },
          { label: "Catálogo", href: "/courses", match: "prefix" },
        ]}
        className="bg-card"
      />

      <div className="container py-6 md:py-8">
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
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {lesson.title}
              </h1>
              {course && (
                <p className="text-muted-foreground">Curso: {course.title}</p>
              )}
            </div>

            {/* Video Player */}
            {playbackUrl ? (
              <div className="space-y-4">
                {!showVR ? (
                  <>
                    {/* VideoPlayer detecta YouTube internamente e renderiza iframe ou HLS */}
                    <VideoPlayer
                      src={playbackUrl}
                      title={lesson.title}
                      onProgress={handleProgress}
                      onComplete={handleComplete}
                    />
                    {/* Botão VR só aparece para vídeos de streaming (não YouTube) */}
                    {!isYouTube && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowVR(true)}
                      >
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Ver em Modo VR 360°
                      </Button>
                    )}
                  </>
                ) : (
                  <VRViewer
                    videoUrl={playbackUrl}
                    title={lesson.title}
                    onClose={() => setShowVR(false)}
                  />
                )}
              </div>
            ) : playbackLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Carregando vídeo da aula...
                  </p>
                </CardContent>
              </Card>
            ) : lesson.videoProvider === "cloudflare" && lesson.videoAssetId ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    O vídeo ainda está sendo processado. Tente novamente em instantes.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    Vídeo não disponível para esta aula
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Progresso no curso
                    </p>
                    <h3 className="text-xl font-semibold">{calculatedProgress}%</h3>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium text-muted-foreground">
                      Aulas concluídas
                    </p>
                    <p className="text-base font-semibold">
                      {Math.min(mergedCompletedLessons.length, totalLessons)} de {totalLessons}
                    </p>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${calculatedProgress}%` }}
                  />
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm font-medium text-primary mb-1">
                    Seu próximo passo é...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nextStepLabel}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {isCurrentLessonCompleted && nextUnlockedLesson ? (
                      <Button onClick={() => setLocation(`/lesson/${nextUnlockedLesson.id}`)}>
                        Ir para a próxima aula
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      >
                        Continuar nesta aula
                      </Button>
                    )}

                    <Button variant="outline" asChild>
                      <Link href={`/courses/${course?.slug}`}>
                        Voltar ao curso
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
              {nextUnlockedLesson ? (
                <Link href={`/lesson/${nextUnlockedLesson.id}`}>
                  <Button>
                    Próxima Aula
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </Link>
              ) : nextLesson?.isPathLocked ? (
                <Button variant="outline" disabled>
                  Próxima etapa bloqueada
                </Button>
              ) : null}
            </div>
          </div>

          {/* Sidebar - Lessons List */}
          <div>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Conteúdo do Curso</h3>
                <div className="space-y-2">
                  {allLessons?.map((l: any, index) => {
                    const isCompleted = mergedCompletedLessons.includes(l.id);
                    const isLockedByPath = Boolean(l.isPathLocked);
                    const lessonCard = (
                      <div
                        className={`p-3 rounded-lg border transition-colors ${
                          l.id === lessonId
                            ? "bg-primary text-primary-foreground border-primary"
                            : isLockedByPath
                              ? "opacity-70 cursor-not-allowed"
                              : "cursor-pointer hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-medium">{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2 flex items-center gap-1">
                              {l.title}
                              {l.isAccessRestricted === 1 && !l.videoPlaybackUrl && (
                                <Lock className="h-3 w-3 shrink-0" />
                              )}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
                              {l.duration && <span>{formatDuration(l.duration)}</span>}
                              {isCompleted && <span>• concluída</span>}
                              {isLockedByPath && <span>• bloqueada pela trilha</span>}
                            </div>
                            {isLockedByPath && l.unlockLabel && (
                              <p className="mt-1 text-xs opacity-70">{l.unlockLabel}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );

                    return isLockedByPath ? (
                      <div key={l.id}>{lessonCard}</div>
                    ) : (
                      <Link key={l.id} href={`/lesson/${l.id}`}>
                        {lessonCard}
                      </Link>
                    );
                  })}
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

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
import { ArrowLeft, Globe, Lock, Maximize2, Layers, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";
import LessonMaterials from "@/components/LessonMaterials";

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
  const { isAuthenticated, user } = useAuth();
  const [showVR, setShowVR] = useState(false);
  const [hasMarkedComplete, setHasMarkedComplete] = useState(false);
  // UX imediata — separada da persistência real no backend
  const [completionUiStarted, setCompletionUiStarted] = useState(false);
  // Confirmado pelo backend — countdown só inicia após onSuccess
  const [completionConfirmed, setCompletionConfirmed] = useState(false);
  // Countdown Netflix — autoplay próxima aula
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionUiStartedRef = useRef(false);
  const utils = trpc.useUtils();

  // Idioma preferido do usuário para auto-seleção de faixa de áudio
  const { data: userSettings } = trpc.profile.getSettings.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  // Idioma selecionado manualmente pelo aluno (null = usar preferredLanguage)
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);




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

  const { data: courseGroups = [] } = trpc.courseGroups.listByCourse.useQuery(
    { courseId: lesson?.courseId || 0 },
    { enabled: !!lesson, staleTime: 0 }
  );

  // Contexto da coleção — próxima aula ou próxima coleção ao terminar
  const { data: collectionContext } = trpc.collections.getLessonContext.useQuery(
    { lessonId },
    { enabled: lessonId > 0, staleTime: 0 }
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

  // Idiomas de dublagem — após lesson e hasAccess estarem disponíveis
  const { data: languagesData } = trpc.videos.getAvailableLanguages.useQuery(
    { lessonId },
    { enabled: !!lesson && hasAccess, staleTime: 300_000 }
  );
  const completedLessons = useMemo(() => {
    return parseCompletedLessons(enrollmentData?.enrollment?.completedLessons);
  }, [enrollmentData?.enrollment?.completedLessons]);

  const currentLessonAlreadyCompleted = completedLessons.includes(lessonId);
  const isCurrentLessonCompleted =
    currentLessonAlreadyCompleted || hasMarkedComplete || completionUiStarted;

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
    : (enrollmentData?.enrollment?.progress ?? 0);

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
    : collectionContext?.nextLesson
      ? `Próxima aula do programa: "${collectionContext.nextLesson.title}".`
      : collectionContext?.nextCollection
        ? `Ao concluir, você avança para o próximo programa: "${collectionContext.nextCollection.title}".`
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

  const markLessonAsCompleted = useCallback(() => {
    if (!lesson || !hasAccess) return;
    if (
      hasMarkedComplete ||
      currentLessonAlreadyCompleted ||
      completionUiStarted ||
      updateProgressMutation.isPending
    ) {
      return;
    }

    // Calcular progresso explícito no momento da persistência
    // (calculatedProgress pode estar defasado antes do re-render com completionUiStarted=true)
    const completedLessonsToPersist = [...new Set([...completedLessons, lessonId])];
    const progressToPersist = totalLessons > 0
      ? Math.min(100, Math.round((completedLessonsToPersist.length / totalLessons) * 100))
      : (enrollmentData?.enrollment?.progress ?? 0); // não sobrescreve com 0 se totalLessons ainda não carregou

    updateProgressMutation.mutate(
      {
        courseId: lesson.courseId,
        progress: progressToPersist,
        completedLessons: JSON.stringify(completedLessonsToPersist),
      },
      {
        onSuccess: () => {
          setHasMarkedComplete(true);
          // completionConfirmed é setado pelo startCompletionFlow quando chamado via onComplete
          if (completionUiStartedRef.current) {
            setCompletionConfirmed(true);
          }
        },
        onError: () => {
          // Rollback visual se o backend falhar
          setCompletionUiStarted(false);
          setCompletionConfirmed(false);
          setCountdown(null);
          setIsExiting(false);
          toast.error("Não foi possível salvar sua conclusão. Tente novamente.");
        },
      }
    );
  }, [lesson, hasAccess, hasMarkedComplete, currentLessonAlreadyCompleted, completionUiStarted, updateProgressMutation, completedLessons, lessonId, totalLessons, enrollmentData]);

  // Marca conclusão silenciosa (sem countdown) — chamada quando progress > 90%
  // O countdown só inicia no onComplete (fim real do vídeo)
  const markCompletionSilent = useCallback(() => {
    // Só grava se ainda não gravou e não é aula já concluída
    if (completionUiStarted || currentLessonAlreadyCompleted || hasMarkedComplete) return;
    // Grava progresso mas NÃO seta completionConfirmed — countdown vem do onComplete
    if (!lesson || !hasAccess) return;
    if (updateProgressMutation.isPending) return;
    const completedLessonsToPersist = [...new Set([...completedLessons, lessonId])];
    const progressToPersist = totalLessons > 0
      ? Math.min(100, Math.round((completedLessonsToPersist.length / totalLessons) * 100))
      : (enrollmentData?.enrollment?.progress ?? 0);
    updateProgressMutation.mutate(
      { courseId: lesson.courseId, progress: progressToPersist, completedLessons: JSON.stringify(completedLessonsToPersist) },
      { onSuccess: () => setHasMarkedComplete(true) } // SEM setCompletionConfirmed
    );
  }, [completionUiStarted, currentLessonAlreadyCompleted, hasMarkedComplete, lesson, hasAccess, updateProgressMutation, completedLessons, lessonId, totalLessons, enrollmentData]);

  // Conclusão completa: toast + countdown + persistência — chamada no onComplete (fim do vídeo)
  const startCompletionFlow = useCallback(() => {
    // Sempre inicia o countdown ao terminar o vídeo
    // Para aulas já concluídas: só dispara o countdown sem regravar
    if (!completionUiStarted) {
      completionUiStartedRef.current = true;
      setCompletionUiStarted(true);
      if (!currentLessonAlreadyCompleted && !hasMarkedComplete) {
        toast.success("Aula concluída!");
        markLessonAsCompleted();
      } else {
        // Aula já concluída anteriormente — inicia countdown direto sem regravar
        setCompletionConfirmed(true);
      }
    }
  }, [completionUiStarted, currentLessonAlreadyCompleted, hasMarkedComplete, markLessonAsCompleted]);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    if (tickRef.current) clearTimeout(tickRef.current);
    deadlineRef.current = null;
    setCountdown(null);
    setIsExiting(false); // reverte animação de saída se cancelado após 9.4s
  }, []);

  const goToNextLesson = useCallback(() => {
    cancelCountdown();
    // Prioridade: próxima aula no curso → próxima aula na coleção → próxima coleção
    if (nextUnlockedLesson) {
      setIsExiting(true);
      setTimeout(() => setLocation(`/lesson/${nextUnlockedLesson.id}`), 600);
    } else if (collectionContext?.nextLesson) {
      setIsExiting(true);
      setTimeout(() => setLocation(`/lesson/${collectionContext.nextLesson!.lessonId}`), 600);
    } else if (collectionContext?.nextCollection) {
      setIsExiting(true);
      setTimeout(() => setLocation(`/collections/${collectionContext.nextCollection!.id}`), 600);
    }
  }, [cancelCountdown, nextUnlockedLesson, collectionContext, setLocation]);

  // Inicia countdown quando aula é concluída e há próxima aula disponível
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownPausedRef = useRef(false);
  const deadlineRef = useRef<number | null>(null); // timestamp absoluto do fim do countdown
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null); // tick único por segundo

  // Reset de todos os estados ao trocar de aula — evita vazamento entre aulas
  useEffect(() => {
    setHasMarkedComplete(false);
    setCompletionUiStarted(false);
    setCompletionConfirmed(false);
    setCountdown(null);
    setIsExiting(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    if (tickRef.current) clearTimeout(tickRef.current);
    deadlineRef.current = null;
  }, [lessonId]);

  // nextStep: próxima aula do curso OU próxima da coleção OU próxima coleção
  const hasNextStep = !!nextUnlockedLesson
    || !!collectionContext?.nextLesson
    || !!collectionContext?.nextCollection;

  // Refs para captura estável do destino — atualizadas sempre, sem triggerar effect
  const nextUnlockedLessonRef = useRef<any>(null);
  const collectionContextRef = useRef<any>(null);
  nextUnlockedLessonRef.current = nextUnlockedLesson;
  collectionContextRef.current = collectionContext;

  useEffect(() => {
    // Só roda quando completionConfirmed vira true — deps mínimas para evitar cleanup prematuro
    if (!completionConfirmed) return;
    if (deadlineRef.current) return; // já iniciado

    function getDestination() {
      const nl = nextUnlockedLessonRef.current;
      const cc = collectionContextRef.current;
      const destLesson = nl ?? cc?.nextLesson ?? null;
      const destCollection = cc?.nextCollection ?? null;
      return { destLesson, destCollection };
    }

    function navigate() {
      const { destLesson, destCollection } = getDestination();
      if (destLesson && "id" in destLesson) {
        setLocation(`/lesson/${(destLesson as any).id}`);
      } else if (destLesson && "lessonId" in destLesson) {
        setLocation(`/lesson/${(destLesson as any).lessonId}`);
      } else if (destCollection) {
        setLocation(`/collections/${destCollection.id}`);
      }
    }

    function hasAnyNext() {
      const nl = nextUnlockedLessonRef.current;
      const cc = collectionContextRef.current;
      return !!nl || !!cc?.nextLesson || !!cc?.nextCollection;
    }

    // Aguarda até 3s para collectionContext carregar antes de iniciar
    let startAttempts = 0;
    function tryStart() {
      startAttempts++;
      if (hasAnyNext() || startAttempts >= 3) {
        if (!hasAnyNext()) return; // sem próximo — não inicia
        startCountdown();
      } else {
        tickRef.current = setTimeout(tryStart, 1000);
      }
    }

    function startCountdown() {
      const TOTAL_MS = 10_000;
      deadlineRef.current = Date.now() + TOTAL_MS;

      function tick() {
        if (!deadlineRef.current) return;
        const remaining = deadlineRef.current - Date.now();
        const secs = Math.max(0, Math.ceil(remaining / 1000));
        setCountdown(secs);

        if (remaining <= 600) setIsExiting(true);

        if (remaining <= 0) {
          deadlineRef.current = null;
          navTimeoutRef.current = setTimeout(navigate, 600);
          return;
        }

        const nextTick = remaining % 1000;
        tickRef.current = setTimeout(tick, nextTick > 50 ? nextTick : 1000);
      }

      tick();

      function handleVisibilityChange() {
        if (!deadlineRef.current) return;
        if (document.hidden) {
          countdownPausedRef.current = true;
          if (tickRef.current) { clearTimeout(tickRef.current); tickRef.current = null; }
          if (navTimeoutRef.current) { clearTimeout(navTimeoutRef.current); navTimeoutRef.current = null; }
        } else if (countdownPausedRef.current) {
          countdownPausedRef.current = false;
          tick();
        }
      }

      document.addEventListener("visibilitychange", handleVisibilityChange);
      // Guarda cleanup no ref para o return poder acessar
      (startCountdown as any)._cleanup = () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    tryStart();

    return () => {
      if (tickRef.current) clearTimeout(tickRef.current);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      deadlineRef.current = null;
      if ((startCountdown as any)._cleanup) (startCountdown as any)._cleanup();
    };
  }, [completionConfirmed]); // só completionConfirmed — evita cleanup por mudança de collectionContext

  const handleProgress = useCallback((progress: number) => {
    if (lesson && hasAccess && progress > 90) {
      // Política conservadora: só persiste conclusão em >90%, countdown inicia no onComplete
      markCompletionSilent();
    }
  }, [lesson, hasAccess, markCompletionSilent]);

  const handleComplete = useCallback(() => {
    if (lesson && hasAccess) {
      startCompletionFlow();
    }
  }, [lesson, hasAccess, startCompletionFlow]);

  // Derivadas de playback — depois de playbackData, antes dos early returns
  const playbackUrl = playbackData?.url || lesson?.videoPlaybackUrl || null;
  const isYouTube = playbackUrl ? isYouTubeUrl(playbackUrl) : false;
  const availableTracks = languagesData?.tracks ?? [];
  const hasMultipleLanguages = (languagesData?.hasMultipleLanguages ?? false) && !isYouTube;
  const effectiveLanguage = selectedLanguage ?? userSettings?.language ?? "pt-BR";

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

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={lessonId}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={isExiting
          ? { opacity: 0, scale: 1.03, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] } }
          : { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } }
        }
        exit={{ opacity: 0, scale: 1.03, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] } }}
      >
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
                    {/* Seletor de idioma de dublagem — só aparece se há múltiplas faixas */}
                    {hasMultipleLanguages && (
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground">Idioma do áudio:</span>
                        <div className="flex flex-wrap gap-2">
                          {availableTracks.map((track) => (
                            <button
                              key={track.audioTrackUid}
                              onClick={() => setSelectedLanguage(track.languageCode)}
                              className={[
                                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                                effectiveLanguage === track.languageCode
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary",
                              ].join(" ")}
                            >
                              {track.label}
                              {track.isDefault && (
                                <span className="ml-1 opacity-60">(padrão)</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* VideoPlayer detecta YouTube internamente e renderiza iframe ou HLS */}
                    <div className="relative">
                      <VideoPlayer
                        src={playbackUrl}
                        title={lesson.title}
                        preferredLanguage={effectiveLanguage}
                        onProgress={handleProgress}
                        onComplete={handleComplete}
                        countdown={countdown}
                        nextLesson={(() => {
                          if (nextUnlockedLesson) return {
                            title: nextUnlockedLesson.title,
                            thumbnail: (course as any)?.thumbnail ?? null,
                          };
                          if (collectionContext?.nextLesson) return {
                            title: collectionContext.nextLesson.title,
                            thumbnail: collectionContext.nextLesson.thumbnail ?? (course as any)?.thumbnail ?? null,
                          };
                          if (collectionContext?.nextCollection) return {
                            title: `Próximo programa: ${collectionContext.nextCollection.title}`,
                            thumbnail: collectionContext.nextCollection.coverUrl ?? null,
                          };
                          return null;
                        })()}
                        onGoToNext={goToNextLesson}
                        onCancelCountdown={cancelCountdown}
                      />

                    </div>
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
                      {totalLessons > 0 ? Math.min(mergedCompletedLessons.length, totalLessons) : "—"} de {totalLessons > 0 ? totalLessons : "—"}
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

                  {/* Status de salvamento e redirecionamento */}
                  {completionUiStarted && !completionConfirmed && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 mb-1">
                      <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                      Salvando conclusão...
                    </div>
                  )}
                  {completionConfirmed && countdown !== null && hasNextStep && (
                    <div className="flex items-center gap-2 text-sm text-primary font-medium mt-2 mb-1">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {countdown}
                      </span>
                      Redirecionando para a próxima aula em {countdown}s...
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {isCurrentLessonCompleted && nextUnlockedLesson ? (
                      <Button onClick={goToNextLesson}>
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

            {/* Material de Apoio + Exercícios Mentais */}
            <LessonMaterials lessonId={lessonId} lessonTitle={lesson.title} />

            {/* Lesson Description */}
            {(() => {
              const currentGroup = (courseGroups as any[]).find((g: any) => g.lessonIds.includes(lessonId));
              if (!currentGroup) return null;
              return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-primary font-medium">{currentGroup.title}</span>
                  {currentGroup.subtitle && <span className="text-muted-foreground">· {currentGroup.subtitle}</span>}
                </div>
              );
            })()}

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
                {(() => {
                  const renderLesson = (l: any, index: number, globalIndex: number) => {
                    const isCompleted = mergedCompletedLessons.includes(l.id);
                    const isLockedByPath = Boolean(l.isPathLocked);
                    const isCurrent = l.id === lessonId;
                    const card = (
                      <div className={`p-3 rounded-lg border transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary"
                          : isLockedByPath
                            ? "opacity-70 cursor-not-allowed"
                            : "cursor-pointer hover:bg-accent"
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-medium shrink-0">{globalIndex + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2 flex items-center gap-1">
                              {l.title}
                              {l.isAccessRestricted === 1 && !l.videoPlaybackUrl && (
                                <Lock className="h-3 w-3 shrink-0" />
                              )}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
                              {l.duration && <span>{formatDuration(l.duration)}</span>}
                              {isCompleted && <span className="flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" /> concluída</span>}
                              {isLockedByPath && <span>• bloqueada</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    return isLockedByPath ? (
                      <div key={l.id}>{card}</div>
                    ) : (
                      <Link key={l.id} href={`/lesson/${l.id}`}>{card}</Link>
                    );
                  };

                  if ((courseGroups as any[]).length > 0) {
                    let globalIdx = 0;
                    const groupedIds = new Set((courseGroups as any[]).flatMap((g: any) => g.lessonIds));
                    return (
                      <div className="space-y-3">
                        {(courseGroups as any[]).map((group: any) => {
                          const groupLessons = (allLessons || []).filter((l: any) => group.lessonIds.includes(l.id));
                          const completedInGroup = groupLessons.filter((l: any) => mergedCompletedLessons.includes(l.id)).length;
                          const currentInGroup = groupLessons.some((l: any) => l.id === lessonId);
                          return (
                            <div key={group.id} className="rounded-lg border overflow-hidden">
                              <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide ${currentInGroup ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
                                <Layers className="h-3 w-3 shrink-0" />
                                <span className="flex-1 truncate">{group.title}</span>
                                <span className="shrink-0 tabular-nums">{completedInGroup}/{groupLessons.length}</span>
                              </div>
                              <div className="p-2 space-y-1">
                                {groupLessons.map((l: any) => {
                                  const node = renderLesson(l, 0, globalIdx);
                                  globalIdx++;
                                  return node;
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {(() => {
                          const ungrouped = (allLessons || []).filter((l: any) => !groupedIds.has(l.id));
                          if (ungrouped.length === 0) return null;
                          return (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">Outras aulas</p>
                              {ungrouped.map((l: any) => {
                                const node = renderLesson(l, 0, globalIdx);
                                globalIdx++;
                                return node;
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {allLessons?.map((l: any, index) => renderLesson(l, index, index))}
                    </div>
                  );
                })()}
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
      </motion.div>
    </AnimatePresence>
  );
}
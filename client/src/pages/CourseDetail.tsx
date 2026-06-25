import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { OptimizedImage } from "@/components/OptimizedImage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "@/lib/formatDuration";
import { BookOpen, PlayCircle, CheckCircle, Lock, ArrowLeft, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import PublicHeader from "@/components/PublicHeader";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";


// ── Componentes auxiliares ────────────────────────────────────────────────────

function LessonRow({ lesson, index, isEnrolled, onStart }: {
  lesson: any; index: number; isEnrolled: boolean; onStart: (l: any) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
        isEnrolled && !lesson.isPathLocked ? "hover:bg-accent cursor-pointer" : "opacity-60"
      }`}
      onClick={() => isEnrolled && onStart(lesson)}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold text-sm">
          {index + 1}
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{lesson.title}</h4>
          {lesson.description && (
            <p className="text-sm text-muted-foreground line-clamp-1">{lesson.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lesson.duration && <span className="text-sm text-muted-foreground">{formatDuration(lesson.duration)}</span>}
        {isEnrolled ? (
          lesson.isPathLocked ? <Lock className="h-5 w-5 text-muted-foreground" /> : <PlayCircle className="h-5 w-5 text-primary" />
        ) : (
          <Lock className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      {lesson.isPathLocked && lesson.unlockLabel && (
        <p className="text-xs text-muted-foreground sm:text-right">{lesson.unlockLabel}</p>
      )}
    </div>
  );
}

function GroupSection({ group, groupLessons, isEnrolled, onStartLesson, completedLessonIds }: {
  group: any; groupLessons: any[]; isEnrolled: boolean; onStartLesson: (l: any) => void; completedLessonIds?: number[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/20 transition-colors text-left bg-muted/30"
        onClick={() => setOpen((o) => !o)}
      >
        {group.coverUrl ? (
          <img src={group.coverUrl} alt={group.title} className="h-10 w-14 rounded object-cover shrink-0 border" />
        ) : (
          <Layers className="h-4 w-4 text-primary shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{group.title}</p>
          {group.subtitle && <p className="text-xs text-primary/80">{group.subtitle}</p>}
          {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEnrolled && completedLessonIds && completedLessonIds.length > 0 && (() => {
            const done = groupLessons.filter((l: any) => completedLessonIds.includes(l.id)).length;
            return done > 0 ? (
              <span className="text-xs font-medium text-primary">{done}/{groupLessons.length}</span>
            ) : (
              <span className="text-xs text-muted-foreground">{groupLessons.length} aula(s)</span>
            );
          })()}
          {(!isEnrolled || !completedLessonIds || completedLessonIds.length === 0) && (
            <span className="text-xs text-muted-foreground">{groupLessons.length} aula(s)</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="p-3 space-y-2 border-t">
          {groupLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aula neste grupo.</p>
          ) : (
            groupLessons.map((lesson: any, idx: number) => (
              <LessonRow key={lesson.id} lesson={lesson} index={idx} isEnrolled={isEnrolled} onStart={onStartLesson} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CourseDetail() {
  const params = useParams();
  const slug = params.slug || "";
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const { data: course, isLoading: courseLoading } =
    trpc.courses.getBySlug.useQuery({ slug });

  const { data: lessons, isLoading: lessonsLoading } =
    trpc.lessons.listByCourse.useQuery(
      { courseId: course?.id ?? 0 },
      { enabled: !!course && !!course.id && course.id > 0, staleTime: 0, refetchOnMount: "always" }
    );

  const { data: courseGroups = [], isLoading: groupsLoading } = trpc.courseGroups.listByCourse.useQuery(
    { courseId: course?.id ?? 0 },
    { enabled: !!course && !!course.id && course.id > 0, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true }
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
  const learningPathEnabled = Boolean(lessons?.some((lesson: any) => lesson.learningPathEnabled));
  const currentLearningDay = lessons?.find((lesson: any) => lesson.currentLearningDay !== undefined)?.currentLearningDay ?? null;
  const nextUnlockLabel = lessons?.find((lesson: any) => lesson.nextUnlockLabel)?.nextUnlockLabel ?? null;

  const handleEnroll = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (course) {
      enrollMutation.mutate({ courseId: course.id });
    }
  };

  const handleStartLesson = (lesson: any) => {
    if (!isEnrolled) {
      toast.error("Você precisa se matricular no curso primeiro");
      return;
    }

    if (lesson.isPathLocked) {
      toast.info(lesson.unlockLabel || "Esta aula ainda não foi liberada na sua trilha.");
      return;
    }

    setLocation(`/lesson/${lesson.id}`);
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
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses", match: "prefix" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
          { label: "Comunidade", href: "/community/explore", match: "prefix" },
        ]}
        className="bg-card"
      />

      <div className="container py-6 md:py-8">
        {course && (
          <Breadcrumbs 
            items={getBreadcrumbs(`/courses/${course.id}`, { 
              courseId: course.id.toString(), 
              courseTitle: course.title 
            })} 
          />
        )}

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
              <h1 className="text-3xl sm:text-4xl font-bold mb-4">{course.title}</h1>
              {course.description && (
                <p className="text-lg text-muted-foreground">
                  {course.description}
                </p>
              )}
            </div>

            {course.thumbnail && (
              <div className="h-56 w-full overflow-hidden rounded-lg bg-muted sm:h-72 md:h-96">
                <OptimizedImage
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-full"
                  motion="always"
                  priority
                />
              </div>
            )}

            {learningPathEnabled && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-primary">Trilha de retenção ativa</p>
                      <p className="text-sm text-muted-foreground">
                        {currentLearningDay !== null
                          ? `Você está no Dia ${currentLearningDay} da sua jornada.`
                          : "Sua jornada está sendo liberada em etapas para manter foco e evolução consistente."}
                      </p>
                    </div>
                    {nextUnlockLabel && (
                      <p className="text-sm text-muted-foreground">{nextUnlockLabel}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conteúdo do Curso — com agrupamentos ou lista simples */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Conteúdo do Curso
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lessonsLoading || groupsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded"></div>
                    ))}
                  </div>
                ) : courseGroups.length > 0 ? (
                  // ── Visão com agrupamentos ──
                  <div className="space-y-4">
                    {(courseGroups as any[]).map((group: any) => {
                      const groupLessons = (lessons || []).filter((l: any) =>
                        group.lessonIds.includes(l.id)
                      );
                      return (
                        <GroupSection
                          key={group.id}
                          group={group}
                          groupLessons={groupLessons}
                          isEnrolled={isEnrolled}
                          onStartLesson={handleStartLesson}
                          completedLessonIds={(() => {
                            try {
                              return JSON.parse(enrollmentData?.enrollment?.completedLessons || "[]");
                            } catch { return []; }
                          })()}
                        />
                      );
                    })}
                    {/* Aulas sem grupo */}
                    {(() => {
                      const groupedIds = new Set((courseGroups as any[]).flatMap((g: any) => g.lessonIds));
                      const ungrouped = (lessons || []).filter((l: any) => !groupedIds.has(l.id));
                      return ungrouped.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">Outras aulas</p>
                          {ungrouped.map((lesson: any, index: number) => (
                            <LessonRow key={lesson.id} lesson={lesson} index={index}
                              isEnrolled={isEnrolled} onStart={handleStartLesson} />
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : lessons && lessons.length > 0 ? (
                  // ── Visão simples sem agrupamentos ──
                  <div className="space-y-2">
                    {lessons.map((lesson: any, index: number) => (
                      <LessonRow key={lesson.id} lesson={lesson} index={index}
                        isEnrolled={isEnrolled} onStart={handleStartLesson} />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Nenhuma aula disponível ainda</p>
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
                    <p className="text-sm font-medium">Conteúdo</p>
                    <p className="text-sm text-muted-foreground">
                      {(courseGroups as any[]).length > 0
                        ? `${(courseGroups as any[]).length} módulo(s) · ${lessons?.length || 0} aulas`
                        : `${lessons?.length || 0} aulas disponíveis`}
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

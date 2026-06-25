import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookOpen, MessageSquareQuote, PlayCircle, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import PublicHeader from "@/components/PublicHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OptimizedImage } from "@/components/OptimizedImage";
import CourseCard from "@/components/CourseCard";

export default function MyCourses() {
  const { user, isAuthenticated, loading } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [testimonialText, setTestimonialText] = useState("");
  const [testimonialConsent, setTestimonialConsent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const { data: myTestimonials } = trpc.testimonials.listMine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const utils = trpc.useUtils();
  const createTestimonial = trpc.testimonials.create.useMutation({
    onSuccess: () => {
      toast.success("Depoimento enviado para aprovação do admin.");
      utils.testimonials.listMine.invalidate();
      setDialogOpen(false);
      setSelectedCourseId(null);
      setTestimonialText("");
      setTestimonialConsent(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Monta mapa id -> curso para acesso rápido
  const courseMap = new Map(coursesData?.map((c) => [c.id, c]) ?? []);
  const testimonialMap = useMemo(
    () => new Map((myTestimonials ?? []).map((item) => [item.courseId, item])),
    [myTestimonials]
  );

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

  const selectedCourse = selectedCourseId ? courseMap.get(selectedCourseId) : undefined;

  const openTestimonialDialog = (courseId: number) => {
    setSelectedCourseId(courseId);
    setTestimonialText("");
    setTestimonialConsent(false);
    setDialogOpen(true);
  };

  const handleSubmitTestimonial = () => {
    if (!selectedCourseId) return;
    createTestimonial.mutate({
      courseId: selectedCourseId,
      text: testimonialText,
      consentPublicDisplay: testimonialConsent,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Catálogo", href: "/courses", match: "prefix" },
          { label: "Meus Cursos", href: "/my-courses" },
        ]}
        className="bg-card"
      />

      <div className="container py-8 md:py-12">
        <Breadcrumbs items={getBreadcrumbs("/my-courses")} />

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Meus Cursos</h1>
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
                <div key={enrollment.id}>
                  <CourseCard
                    id={course.id}
                    title={course.title}
                    description={course.description}
                    thumbnail={course.thumbnail}
                    slug={course.slug}
                    progress={enrollment.progress}
                  />
                  <div className="mt-3 grid gap-2">
                      <div className="px-1" />
                      <div className="grid gap-2">
                      <Link href={`/courses/${course.slug}`}>
                        <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 hover:bg-primary/90 transition-colors">
                          <PlayCircle className="h-4 w-4" />
                          Continuar Aprendendo
                        </button>
                      </Link>
                      {(() => {
                        const testimonial = testimonialMap.get(course.id);
                        return testimonial ? (
                          <Button variant="outline" className="w-full" disabled>
                            <MessageSquareQuote className="mr-2 h-4 w-4" />
                            {testimonial.status === "approved"
                              ? "Depoimento aprovado"
                              : testimonial.status === "rejected"
                                ? "Depoimento rejeitado"
                                : "Depoimento em análise"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => openTestimonialDialog(course.id)}
                          >
                            <MessageSquareQuote className="mr-2 h-4 w-4" />
                            Enviar depoimento
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar depoimento</DialogTitle>
            <DialogDescription>
              Seu relato será enviado para revisão e só poderá ser publicado após aprovação do admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                Curso: {selectedCourse?.title ?? "-"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="testimonial-text">Seu depoimento</Label>
              <Textarea
                id="testimonial-text"
                value={testimonialText}
                onChange={(e) => setTestimonialText(e.target.value)}
                placeholder="Escreva um relato real sobre sua experiência com o curso."
                rows={6}
              />
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={testimonialConsent}
                onChange={(e) => setTestimonialConsent(e.target.checked)}
              />
              <span>
                Autorizo a publicação do meu depoimento no site, sujeito à aprovação administrativa.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmitTestimonial}
              disabled={createTestimonial.isPending || testimonialText.trim().length < 20 || !testimonialConsent}
            >
              {createTestimonial.isPending ? "Enviando..." : "Enviar para aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-card mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Shadia VR Platform. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

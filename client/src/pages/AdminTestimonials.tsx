import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock3, MessageSquareQuote, XCircle } from "lucide-react";
import { toast } from "sonner";

const statusLabels = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
} as const;

const statusClasses = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
} as const;

export default function AdminTestimonials() {
  const utils = trpc.useUtils();
  const { data: testimonials, isLoading } = trpc.testimonials.adminList.useQuery();

  const updateStatus = trpc.testimonials.adminUpdateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status do depoimento atualizado.");
      utils.testimonials.adminList.invalidate();
      utils.testimonials.listApproved.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar depoimento: ${error.message}`);
    },
  });

  const pendingCount = testimonials?.filter((item) => item.status === "pending").length ?? 0;
  const approvedCount = testimonials?.filter((item) => item.status === "approved").length ?? 0;
  const rejectedCount = testimonials?.filter((item) => item.status === "rejected").length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Depoimentos</h1>
          <p className="mt-2 text-muted-foreground">
            Aprove ou rejeite somente relatos enviados por alunos matriculados.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <Clock3 className="h-8 w-8 text-amber-500" />
              <div>
                <div className="text-2xl font-bold">{pendingCount}</div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold">{approvedCount}</div>
                <div className="text-sm text-muted-foreground">Aprovados</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-6">
              <XCircle className="h-8 w-8 text-rose-500" />
              <div>
                <div className="text-2xl font-bold">{rejectedCount}</div>
                <div className="text-sm text-muted-foreground">Rejeitados</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">Carregando depoimentos...</CardContent>
            </Card>
          ) : testimonials && testimonials.length > 0 ? (
            testimonials.map((testimonial) => (
              <Card key={testimonial.id}>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageSquareQuote className="h-5 w-5 text-primary" />
                        {testimonial.displayName}
                      </CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <div>Curso: {testimonial.courseTitle}</div>
                        <div>E-mail: {testimonial.userEmail}</div>
                      </CardDescription>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusClasses[testimonial.status]}`}>
                      {statusLabels[testimonial.status]}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <blockquote className="rounded-xl border bg-muted/30 p-4 italic text-foreground">
                    “{testimonial.text}”
                  </blockquote>

                  {testimonial.rejectedReason ? (
                    <p className="text-sm text-muted-foreground">
                      Motivo da rejeição: {testimonial.rejectedReason}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={() => updateStatus.mutate({ id: testimonial.id, status: "approved" })}
                      disabled={updateStatus.isPending || testimonial.status === "approved"}
                    >
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateStatus.mutate({
                          id: testimonial.id,
                          status: "rejected",
                          rejectedReason: "Rejeitado na revisão administrativa.",
                        })
                      }
                      disabled={updateStatus.isPending || testimonial.status === "rejected"}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum depoimento enviado até o momento.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

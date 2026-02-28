import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Edit, Plus, Video, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminLessons() {
  const { data: courses, isLoading } = trpc.courses.listAll.useQuery();
  const [quickAddDialog, setQuickAddDialog] = useState<{ open: boolean; courseId: number; courseTitle: string }>({
    open: false, courseId: 0, courseTitle: "",
  });
  const [videoUrl, setVideoUrl] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDesc, setLessonDesc] = useState("");
  const [isFree, setIsFree] = useState(false);

  const utils = trpc.useUtils();
  const createLesson = trpc.lessons.create.useMutation({
    onSuccess: () => {
      toast.success("Aula criada com sucesso!");
      utils.courses.listAll.invalidate();
      setQuickAddDialog({ open: false, courseId: 0, courseTitle: "" });
      setVideoUrl(""); setLessonTitle(""); setLessonDesc(""); setIsFree(false);
    },
    onError: (err) => toast.error("Erro ao criar aula: " + err.message),
  });

  const handleQuickAdd = () => {
    if (!lessonTitle.trim()) { toast.error("O título da aula é obrigatório."); return; }
    if (!videoUrl.trim()) { toast.error("A URL do vídeo é obrigatória."); return; }

    createLesson.mutate({
      courseId: quickAddDialog.courseId,
      title: lessonTitle.trim(),
      description: lessonDesc.trim(),
      videoUrl: videoUrl.trim(),
      isFree: isFree ? 1 : 0,
      order: 999, // será reordenado pelo backend
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Todas as Aulas</h1>
            <p className="text-muted-foreground mt-2">Gerencie aulas por programa</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Programas e Aulas</CardTitle>
            <CardDescription>
              Clique em "Gerenciar Aulas" para editar aulas existentes, ou "Adicionar Aula" para criar rapidamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando programas...</div>
            ) : courses && courses.length > 0 ? (
              <div className="grid gap-4">
                {courses.map((course) => (
                  <Card key={course.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{course.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {course.description || "Sem descrição"} · {(course as any).lessonCount ?? 0} aula(s)
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {/* Botão de criação rápida com campo de URL */}
                          <Button
                            variant="outline"
                            onClick={() => {
                              setQuickAddDialog({ open: true, courseId: course.id, courseTitle: course.title });
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Aula
                          </Button>
                          <Link href={`/admin/courses/${course.id}/lessons`}>
                            <Button>
                              <Edit className="mr-2 h-4 w-4" />
                              Gerenciar Aulas
                            </Button>
                          </Link>
                          {/* Excluir aula: ação segura (direciona para a tela de gerenciamento) */}
                          <Button
                            variant="destructive"
                            onClick={() => {
                              const ok = confirm(
                                "Para excluir uma aula, abra o gerenciador de aulas deste programa. Deseja ir agora?"
                              );
                              if (!ok) return;
                              toast.info("Abra a aula e clique em Excluir no gerenciador.");
                              // Mantém a compatibilidade com as rotas existentes
                              window.location.href = `/admin/courses/${course.id}/lessons`;
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Aula
                          </Button>

                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Nenhum programa cadastrado ainda</p>
                <Link href="/admin/courses">
                  <Button><Plus className="mr-2 h-4 w-4" />Criar Primeiro Programa</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de criação rápida de aula com campo de URL */}
      <Dialog open={quickAddDialog.open} onOpenChange={(open) => setQuickAddDialog(p => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Aula — {quickAddDialog.courseTitle}</DialogTitle>
            <DialogDescription>Preencha os dados da nova aula.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lessonTitle">Título da Aula *</Label>
              <Input
                id="lessonTitle"
                placeholder="Ex: Introdução ao Mindfulness"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="videoUrl">URL do Vídeo *</Label>
              <div className="flex gap-2">
                <Video className="h-5 w-5 text-muted-foreground mt-2.5 flex-shrink-0" />
                <Input
                  id="videoUrl"
                  placeholder="https://vimeo.com/... ou https://youtube.com/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">Suporta Vimeo, YouTube, HLS (.m3u8) ou MP4 direto.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lessonDesc">Descrição (opcional)</Label>
              <Textarea
                id="lessonDesc"
                placeholder="Descrição breve da aula..."
                value={lessonDesc}
                onChange={(e) => setLessonDesc(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="isFree" checked={isFree} onCheckedChange={setIsFree} />
              <Label htmlFor="isFree">Aula gratuita (preview sem assinatura)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddDialog(p => ({ ...p, open: false }))}>
              Cancelar
            </Button>
            <Button onClick={handleQuickAdd} disabled={createLesson.isPending}>
              {createLesson.isPending ? "Criando..." : "Criar Aula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

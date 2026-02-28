import DashboardLayout from "@/components/DashboardLayout";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, ArrowLeft, Eye, EyeOff, PlayCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function AdminCourseLessons() {
  const params = useParams();
  const courseId = parseInt(params.id || "0");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    order: 1,
    description: "",
    videoProvider: "cloudflare",
    videoAssetId: "",
    videoPlaybackUrl: "",
    duration: 0,
    isPublished: 0,
  });

  const utils = trpc.useUtils();
  const { data: course } = trpc.courses.getById.useQuery({ id: courseId });
  const { data: lessons, isLoading } = trpc.lessons.listByCourse.useQuery({
    courseId,
  });

  const createMutation = trpc.lessons.create.useMutation({
    onSuccess: () => {
      toast.success("Aula criada com sucesso!");
      utils.lessons.listByCourse.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Erro ao criar aula: ${error.message}`);
    },
  });

  const updateMutation = trpc.lessons.update.useMutation({
    onSuccess: () => {
      toast.success("Aula atualizada com sucesso!");
      utils.lessons.listByCourse.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar aula: ${error.message}`);
    },
  });

  const deleteMutation = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      toast.success("Aula excluída com sucesso!");
      utils.lessons.listByCourse.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir aula: ${error.message}`);
    },
  });

  const openCreateDialog = () => {
    setEditingLesson(null);
    const nextOrder = lessons ? lessons.length + 1 : 1;
    setFormData({
      title: "",
      order: nextOrder,
      description: "",
      videoProvider: "cloudflare",
      videoAssetId: "",
      videoPlaybackUrl: "",
      duration: 0,
      isPublished: 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (lesson: any) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      order: lesson.order,
      description: lesson.description || "",
      videoProvider: lesson.videoProvider || "cloudflare",
      videoAssetId: lesson.videoAssetId || "",
      videoPlaybackUrl: lesson.videoPlaybackUrl || "",
      duration: lesson.duration || 0,
      isPublished: lesson.isPublished,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingLesson(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast.error("Título é obrigatório");
      return;
    }

    if (editingLesson) {
      updateMutation.mutate({
        id: editingLesson.id,
        ...formData,
      });
    } else {
      createMutation.mutate({
        courseId,
        ...formData,
      });
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Tem certeza que deseja excluir a aula "${title}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {course && (
          <Breadcrumbs 
            items={getBreadcrumbs(`/admin/courses/${courseId}/lessons`, { 
              courseId: courseId.toString(),
              courseTitle: course.title
            })} 
          />
        )}

        <div>
          <Link href="/admin/courses">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Cursos
            </Button>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {course?.title || "Curso"}
              </h1>
              <p className="text-muted-foreground mt-2">
                Gerencie as aulas deste curso
              </p>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Aula
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted animate-pulse rounded"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : lessons && lessons.length > 0 ? (
          <div className="space-y-4">
            {lessons.map((lesson) => (
              <Card key={lesson.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm font-normal">
                        #{lesson.order}
                      </span>
                      <span className="line-clamp-1">{lesson.title}</span>
                      {lesson.isPublished ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(lesson)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(lesson.id, lesson.title)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {lesson.description && (
                      <p className="text-muted-foreground line-clamp-2">
                        {lesson.description}
                      </p>
                    )}
                    {lesson.videoPlaybackUrl && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <PlayCircle className="h-3 w-3" />
                        <span>Vídeo configurado</span>
                        {lesson.duration && (
                          <span>• {Math.floor(lesson.duration / 60)} min</span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhuma aula cadastrada ainda
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Aula
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingLesson ? "Editar Aula" : "Nova Aula"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações da aula abaixo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Nome da aula"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="order">Ordem *</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        order: parseInt(e.target.value) || 1,
                      })
                    }
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição da aula..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="videoPlaybackUrl">URL do Vídeo</Label>
                <Input
                  id="videoPlaybackUrl"
                  value={formData.videoPlaybackUrl}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      videoPlaybackUrl: e.target.value,
                    })
                  }
                  placeholder="https://customer-xxxxx.cloudflarestream.com/xxxxx/manifest/video.m3u8"
                />
                <p className="text-xs text-muted-foreground">
                  URL de streaming do vídeo (Cloudflare Stream, Mux, etc)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="videoAssetId">ID do Asset</Label>
                  <Input
                    id="videoAssetId"
                    value={formData.videoAssetId}
                    onChange={(e) =>
                      setFormData({ ...formData, videoAssetId: e.target.value })
                    }
                    placeholder="asset-id-12345"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duração (segundos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={formData.isPublished === 1}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isPublished: e.target.checked ? 1 : 0,
                    })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="isPublished" className="cursor-pointer">
                  Publicar aula (visível para alunos)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingLesson ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

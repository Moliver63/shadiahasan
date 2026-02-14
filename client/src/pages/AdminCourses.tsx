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
import { Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function AdminCourses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    thumbnail: "",
    isPublished: 0,
  });

  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.courses.listAll.useQuery();
  const createMutation = trpc.courses.create.useMutation({
    onSuccess: () => {
      toast.success("Curso criado com sucesso!");
      utils.courses.listAll.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Erro ao criar curso: ${error.message}`);
    },
  });

  const updateMutation = trpc.courses.update.useMutation({
    onSuccess: () => {
      toast.success("Curso atualizado com sucesso!");
      utils.courses.listAll.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar curso: ${error.message}`);
    },
  });

  const deleteMutation = trpc.courses.delete.useMutation({
    onSuccess: () => {
      toast.success("Curso excluído com sucesso!");
      utils.courses.listAll.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir curso: ${error.message}`);
    },
  });

  const openCreateDialog = () => {
    setEditingCourse(null);
    setFormData({
      title: "",
      slug: "",
      description: "",
      thumbnail: "",
      isPublished: 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (course: any) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      slug: course.slug,
      description: course.description || "",
      thumbnail: course.thumbnail || "",
      isPublished: course.isPublished,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCourse(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }

    if (editingCourse) {
      updateMutation.mutate({
        id: editingCourse.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Tem certeza que deseja excluir o curso "${title}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cursos</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todos os cursos da plataforma
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Curso
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted animate-pulse rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                    <div className="h-4 w-2/3 bg-muted animate-pulse rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2">{course.title}</span>
                    {course.isPublished ? (
                      <Eye className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {course.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {course.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(course)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Link href={`/admin/courses/${course.id}/lessons`}>
                      <Button variant="outline" size="sm">
                        Aulas
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(course.id, course.title)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                Nenhum curso cadastrado ainda
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Curso
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCourse ? "Editar Curso" : "Novo Curso"}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do curso abaixo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setFormData({
                      ...formData,
                      title,
                      slug: editingCourse ? formData.slug : generateSlug(title),
                    });
                  }}
                  placeholder="Nome do curso"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="curso-exemplo"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL amigável para o curso (sem espaços ou caracteres especiais)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição do curso..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">URL da Thumbnail</Label>
                <Input
                  id="thumbnail"
                  value={formData.thumbnail}
                  onChange={(e) =>
                    setFormData({ ...formData, thumbnail: e.target.value })
                  }
                  placeholder="https://exemplo.com/imagem.jpg"
                />
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
                  Publicar curso (visível para alunos)
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
                {editingCourse ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

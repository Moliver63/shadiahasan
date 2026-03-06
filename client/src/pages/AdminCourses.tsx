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
import { Plus, Edit, Trash2, Eye, EyeOff, Wand2, RefreshCw, ImageIcon } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

// Generates a themed Unsplash thumbnail URL based on course title keywords
const generateThumbnailFromTitle = (title: string): string => {
  const keywords = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(",");

  const query = keywords || "education,learning,course";
  // Random seed so each "refresh" produces a different image for the same query
  const seed = Math.floor(Math.random() * 1000);
  return `https://source.unsplash.com/1600x900/?${encodeURIComponent(query)}&sig=${seed}`;
};

export default function AdminCourses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
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
    setThumbnailPreview("");
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
    setThumbnailPreview(course.thumbnail || "");
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
    setThumbnailPreview("");
  };

  const handleGenerateThumbnail = useCallback(() => {
    setIsGeneratingThumb(true);
    const url = generateThumbnailFromTitle(formData.title || "curso");
    setFormData((prev) => ({ ...prev, thumbnail: url }));
    setThumbnailPreview(url);
    // Give the browser a moment to start fetching before resetting the spinner
    setTimeout(() => setIsGeneratingThumb(false), 800);
  }, [formData.title]);

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
                {course.thumbnail && (
                  <div className="w-full h-32 overflow-hidden rounded-t-lg">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
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
                <Label htmlFor="thumbnail">Thumbnail do Curso</Label>

                {/* Preview */}
                <div className="relative w-full h-36 rounded-md border bg-muted overflow-hidden flex items-center justify-center">
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Preview da thumbnail"
                      className="w-full h-full object-cover"
                      onError={() => setThumbnailPreview("")}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-xs">Sem imagem</span>
                    </div>
                  )}
                </div>

                {/* URL input + generate button */}
                <div className="flex gap-2">
                  <Input
                    id="thumbnail"
                    value={formData.thumbnail}
                    onChange={(e) => {
                      setFormData({ ...formData, thumbnail: e.target.value });
                      setThumbnailPreview(e.target.value);
                    }}
                    placeholder="https://exemplo.com/imagem.jpg"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Gerar imagem automaticamente pelo título"
                    onClick={handleGenerateThumbnail}
                    disabled={isGeneratingThumb}
                  >
                    {isGeneratingThumb ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole uma URL ou clique em{" "}
                  <Wand2 className="inline h-3 w-3" /> para gerar uma imagem
                  automaticamente com base no título do curso.
                </p>
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

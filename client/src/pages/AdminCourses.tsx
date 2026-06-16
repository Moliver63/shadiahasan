import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import Sortable from "sortablejs";
import {
  Plus, Edit, Trash2, Eye, EyeOff, Wand2, RefreshCw, ImageIcon, Upload, Loader2,
  GripVertical, ArrowUp, ArrowDown, Copy, Search, X,
} from "lucide-react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

// Keyword map: Portuguese common words → English for image search
const ptToEn: Record<string, string> = {
  curso: "course", aula: "lesson", programacao: "programming", desenvolvimento: "development",
  web: "web", design: "design", marketing: "marketing", negocios: "business",
  financas: "finance", fotografia: "photography", musica: "music", arte: "art",
  culinaria: "cooking", fitness: "fitness", saude: "health", tecnologia: "technology",
  dados: "data", inteligencia: "intelligence", artificial: "artificial", gestao: "management",
  lideranca: "leadership", vendas: "sales", comunicacao: "communication", ingles: "english",
  idiomas: "languages", python: "python", javascript: "javascript", react: "react",
  mobile: "mobile", seguranca: "security", redes: "network", banco: "database",
  excel: "excel", contabilidade: "accounting", direito: "law", medicina: "medicine",
};

const generateThumbnailFromTitle = (title: string): string => {
  const words = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const translated = words.map((w) => ptToEn[w] || w).slice(0, 2).join(",");
  const query = translated || "education,learning";
  const seed = Math.floor(Math.random() * 9999);
  return `https://picsum.photos/seed/${encodeURIComponent(query)}-${seed}/1600/900`;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const normalize = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type StatusFilter = "all" | "published" | "draft";

export default function AdminCourses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    thumbnail: "",
    isPublished: 0,
  });

  // ── UX: busca, filtro, seleção, ordenação local ──────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [localCourses, setLocalCourses] = useState<any[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<Sortable | null>(null);

  const utils = trpc.useUtils();
  const { data: courses, isLoading } = trpc.courses.listAll.useQuery();
  const uploadThumbnailMutation = trpc.courses.uploadThumbnail.useMutation();

  // Mantém a lista local sincronizada com o servidor (ordenada por `order`)
  useEffect(() => {
    if (courses) setLocalCourses(courses);
  }, [courses]);

  const createMutation = trpc.courses.create.useMutation({
    onSuccess: () => {
      toast.success("Curso criado com sucesso!");
      utils.courses.listAll.invalidate();
      closeDialog();
    },
    onError: (error) => toast.error(`Erro ao criar curso: ${error.message}`),
  });

  const updateMutation = trpc.courses.update.useMutation({
    onSuccess: () => {
      toast.success("Curso atualizado com sucesso!");
      utils.courses.listAll.invalidate();
      closeDialog();
    },
    onError: (error) => toast.error(`Erro ao atualizar curso: ${error.message}`),
  });

  const deleteMutation = trpc.courses.delete.useMutation({
    onSuccess: () => {
      toast.success("Curso excluído com sucesso!");
      utils.courses.listAll.invalidate();
    },
    onError: (error) => toast.error(`Erro ao excluir curso: ${error.message}`),
  });

  const duplicateMutation = trpc.courses.duplicate.useMutation({
    onSuccess: (res: any) => {
      const n = res?.lessonsCopied ?? 0;
      toast.success(`Curso duplicado${n ? ` (${n} aula${n > 1 ? "s" : ""} copiada${n > 1 ? "s" : ""})` : ""}!`);
      utils.courses.listAll.invalidate();
    },
    onError: (error) => toast.error(`Erro ao duplicar: ${error.message}`),
  });

  const reorderMutation = trpc.courses.reorder.useMutation({
    onError: (error) => {
      toast.error(`Erro ao reordenar: ${error.message}`);
      utils.courses.listAll.invalidate(); // reverte para o estado do servidor
    },
  });

  const bulkUpdateMutation = trpc.courses.bulkUpdate.useMutation({
    onSuccess: (res: any) => {
      toast.success(`${res?.count ?? 0} curso(s) atualizado(s)!`);
      utils.courses.listAll.invalidate();
      setSelectedIds(new Set());
    },
    onError: (error) => toast.error(`Erro na ação em lote: ${error.message}`),
  });

  const bulkDeleteMutation = trpc.courses.bulkDelete.useMutation({
    onSuccess: (res: any) => {
      toast.success(`${res?.count ?? 0} curso(s) excluído(s)!`);
      utils.courses.listAll.invalidate();
      setSelectedIds(new Set());
    },
    onError: (error) => toast.error(`Erro ao excluir em lote: ${error.message}`),
  });

  // ── Dialog ────────────────────────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingCourse(null);
    setThumbnailPreview("");
    setFormData({ title: "", slug: "", description: "", thumbnail: "", isPublished: 0 });
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
    setTimeout(() => setIsGeneratingThumb(false), 800);
  }, [formData.title]);

  const handleThumbnailFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Selecione um arquivo de imagem válido.");
        return;
      }
      const MAX_SIZE = 2 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error("Imagem muito grande. Máximo 2MB.");
        return;
      }
      setIsUploadingThumb(true);
      try {
        const base64Data = await fileToBase64(file);
        setThumbnailPreview(base64Data);
        const { url } = await uploadThumbnailMutation.mutateAsync({
          fileName: file.name,
          contentType: file.type,
          base64Data,
        });
        setFormData((prev) => ({ ...prev, thumbnail: url }));
        setThumbnailPreview(url);
        toast.success("Imagem enviada com sucesso!");
      } catch (err: any) {
        toast.error("Erro no upload: " + (err.message || "tente novamente"));
      } finally {
        setIsUploadingThumb(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [uploadThumbnailMutation]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`Tem certeza que deseja excluir o curso "${title}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const generateSlug = (title: string) =>
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  // ── Busca + filtro ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return localCourses.filter((c) => {
      if (statusFilter === "published" && c.isPublished !== 1) return false;
      if (statusFilter === "draft" && c.isPublished === 1) return false;
      if (!q) return true;
      return (
        normalize(c.title).includes(q) ||
        normalize(c.slug).includes(q) ||
        normalize(c.description || "").includes(q)
      );
    });
  }, [localCourses, search, statusFilter]);

  // Reordenação só faz sentido sobre a lista completa (sem busca/filtro)
  const reorderEnabled = !search.trim() && statusFilter === "all";

  // ── Persistência da nova ordem ────────────────────────────────────────────
  const persistOrder = useCallback(
    (list: any[]) => {
      const items = list.map((c, idx) => ({ id: c.id, order: idx + 1 }));
      reorderMutation.mutate({ items });
    },
    [reorderMutation]
  );

  const moveBy = (id: number, dir: -1 | 1) => {
    const idx = localCourses.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= localCourses.length) return;
    const next = [...localCourses];
    [next[idx], next[target]] = [next[target], next[idx]];
    setLocalCourses(next);
    persistOrder(next);
  };

  // ── Drag & Drop via Sortable.js ────────────────────────────────────────────
  // Refs para evitar closures desatualizadas dentro do callback do Sortable
  // (a instância é criada uma única vez no mount).
  const localCoursesRef = useRef(localCourses);
  const persistOrderRef = useRef(persistOrder);
  useEffect(() => {
    localCoursesRef.current = localCourses;
  }, [localCourses]);
  useEffect(() => {
    persistOrderRef.current = persistOrder;
  }, [persistOrder]);

  useEffect(() => {
    if (!listRef.current) return;
    const sortable = Sortable.create(listRef.current, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "opacity-50",
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        const next = [...localCoursesRef.current];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        setLocalCourses(next);
        persistOrderRef.current(next);
      },
    });
    sortableRef.current = sortable;
    return () => {
      sortable.destroy();
      sortableRef.current = null;
    };
  }, []);

  // Habilita/desabilita o arraste sem recriar a instância
  useEffect(() => {
    sortableRef.current?.option("disabled", !reorderEnabled);
  }, [reorderEnabled]);

  // ── Seleção em lote ───────────────────────────────────────────────────────
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const selectedArray = Array.from(selectedIds);
  const runBulkPublish = (value: 0 | 1) =>
    bulkUpdateMutation.mutate({ ids: selectedArray, isPublished: value });
  const runBulkDelete = () => {
    if (confirm(`Excluir ${selectedArray.length} curso(s)? Esta ação remove também as aulas e matrículas relacionadas.`)) {
      bulkDeleteMutation.mutate({ ids: selectedArray });
    }
  };

  const bulkBusy = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cursos</h1>
            <p className="text-muted-foreground mt-1">
              {localCourses.length} curso(s) • arraste para reordenar
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Curso
          </Button>
        </div>

        {/* Barra de busca + filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, slug ou descrição..."
              className="pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="published">Publicados</SelectItem>
              <SelectItem value="draft">Rascunhos</SelectItem>
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={toggleSelectAll}>
              {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          )}
        </div>

        {/* Barra de ações em lote */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 flex-wrap rounded-lg border bg-muted/40 px-4 py-3">
            <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => runBulkPublish(1)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Publicar
              </Button>
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => runBulkPublish(0)}>
                <EyeOff className="h-3.5 w-3.5 mr-1" /> Ocultar
              </Button>
              <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={runBulkDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
              </Button>
              <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </div>
            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        {!reorderEnabled && localCourses.length > 1 && (
          <p className="text-xs text-muted-foreground -mt-2">
            A reordenação fica desativada enquanto há busca/filtro ativo. Limpe-os para arrastar.
          </p>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="h-16 w-28 bg-muted animate-pulse rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/2 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2" ref={listRef}>
            {filtered.map((course, index) => {
              const isSelected = selectedIds.has(course.id);
              return (
                <Card
                  key={course.id}
                  data-id={course.id}
                  className={[
                    "transition-all",
                    isSelected ? "border-primary bg-primary/5" : "",
                  ].join(" ")}
                >
                  <CardContent className="flex items-center gap-3 py-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(course.id)}
                      aria-label={`Selecionar ${course.title}`}
                    />

                    {reorderEnabled ? (
                      <span
                        className="drag-handle cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
                        title="Arraste para reordenar"
                      >
                        <GripVertical className="h-5 w-5" />
                      </span>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}

                    <span className="text-xs font-mono text-muted-foreground w-6 text-center shrink-0">
                      {index + 1}
                    </span>

                    {/* Thumbnail */}
                    <div className="h-14 w-24 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      {course.thumbnail ? (
                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{course.title}</h3>
                        {course.isPublished === 1 ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/40 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                            <Eye className="h-3 w-3" /> Publicado
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <EyeOff className="h-3 w-3" /> Rascunho
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate">/{course.slug}</p>
                      {course.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{course.description}</p>
                      )}
                    </div>

                    {/* Reorder ↑↓ */}
                    {reorderEnabled && (
                      <div className="flex flex-col shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => moveBy(course.id, -1)}
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === filtered.length - 1}
                          onClick={() => moveBy(course.id, 1)}
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(course)}>
                        <Edit className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Editar</span>
                      </Button>
                      <Link href={`/admin/courses/${course.id}/lessons`}>
                        <Button variant="outline" size="sm">Aulas</Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        title="Duplicar curso (com aulas)"
                        disabled={duplicateMutation.isPending}
                        onClick={() => duplicateMutation.mutate({ id: course.id })}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        title="Excluir curso"
                        onClick={() => handleDelete(course.id, course.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : localCourses.length > 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhum curso corresponde aos filtros.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhum curso cadastrado ainda</p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Curso
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog criar/editar (inalterado) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingCourse ? "Editar Curso" : "Novo Curso"}</DialogTitle>
              <DialogDescription>Preencha as informações do curso abaixo</DialogDescription>
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
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do curso..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Capa do Curso</Label>
                <div className="relative w-full h-36 rounded-md border bg-muted overflow-hidden flex items-center justify-center">
                  {isUploadingThumb && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Preview da capa"
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

                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleThumbnailFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingThumb}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload do PC
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Gerar imagem automaticamente pelo título"
                    onClick={handleGenerateThumbnail}
                    disabled={isGeneratingThumb || isUploadingThumb}
                  >
                    {isGeneratingThumb ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <Input
                  id="thumbnail"
                  value={formData.thumbnail}
                  onChange={(e) => {
                    setFormData({ ...formData, thumbnail: e.target.value });
                    setThumbnailPreview(e.target.value);
                  }}
                  placeholder="ou cole uma URL de imagem aqui"
                  className="text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Envie uma imagem do seu computador (até 2MB), gere automaticamente{" "}
                  <Wand2 className="inline h-3 w-3" /> com base no título, ou cole uma URL.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={formData.isPublished === 1}
                  onChange={(e) =>
                    setFormData({ ...formData, isPublished: e.target.checked ? 1 : 0 })
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
                disabled={createMutation.isPending || updateMutation.isPending || isUploadingThumb}
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

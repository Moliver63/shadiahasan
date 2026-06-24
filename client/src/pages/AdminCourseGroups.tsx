/**
 * AdminCourseGroups — Gerenciamento de agrupamentos de aulas por curso
 * Rota: /admin/courses/:id/groups
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  Plus, Trash2, ArrowLeft, Edit, Layers, PlayCircle,
  ChevronDown, ChevronUp, Loader2, FolderOpen, ImageIcon,
  GripVertical, Eye, EyeOff,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

export default function AdminCourseGroups() {
  const params = useParams();
  const parsedCourseId = Number(params.id);
  const courseId = Number.isInteger(parsedCourseId) && parsedCourseId > 0
    ? parsedCourseId
    : null;

  // Queries
  const { data: course } = trpc.courses.getById.useQuery(
    { id: courseId ?? 0 },
    { enabled: courseId !== null }
  );
  const { data: groups = [], refetch: refetchGroups } = trpc.courseGroups.adminListByCourse.useQuery(
    { courseId: courseId ?? 0 },
    { enabled: courseId !== null }
  );
  const { data: allLessons = [] } = trpc.courseGroups.adminListLessons.useQuery();

  // Aulas já vinculadas a algum grupo neste curso
  const groupedLessonIds = new Set((groups as any[]).flatMap((g: any) => g.lessons.map((l: any) => l.lessonId)));
  const ungroupedLessons = (allLessons as any[]).filter((l: any) => !groupedLessonIds.has(l.id));

  // Mutations
  const createGroupMutation = trpc.courseGroups.create.useMutation({
    onSuccess: () => { refetchGroups(); toast.success("Grupo criado!"); setShowCreateDialog(false); resetForm(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateGroupMutation = trpc.courseGroups.update.useMutation({
    onSuccess: () => { refetchGroups(); toast.success("Grupo atualizado!"); setShowEditDialog(false); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteGroupMutation = trpc.courseGroups.delete.useMutation({
    onSuccess: () => { refetchGroups(); toast.success("Agrupamento desfeito. As aulas foram mantidas."); setConfirmDelete(null); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const addLessonsMutation = trpc.courseGroups.addLessons.useMutation({
    onSuccess: (data) => { refetchGroups(); toast.success(`${(data as any).added} aula(s) adicionada(s)!`); setShowAddLessonsDialog(false); setSelectedLessonIds([]); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const reorderGroupsMutation = trpc.courseGroups.reorderGroups.useMutation({
    onSuccess: () => refetchGroups(),
    onError: (e) => toast.error("Erro ao reordenar: " + e.message),
  });


  async function handleCoverUpload(file: File, mode: "create" | "edit") {
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 2MB."); return; }
    setIsUploadingCover(true);

    // Preview local imediato
    const localPreview = URL.createObjectURL(file);
    if (mode === "create") setNewCoverPreview(localPreview);
    else setEditCoverPreview(localPreview);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "thome_unsigned");
      formData.append("folder", "shadiahasan/group-covers");

      const res = await fetch("https://api.cloudinary.com/v1_1/dzty82u60/image/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Falha no upload da imagem.");

      const data = await res.json();
      const url: string = data.secure_url;

      if (!url) throw new Error("Cloudinary não retornou URL.");

      if (mode === "create") { setNewCoverUrl(url); setNewCoverPreview(url); }
      else { setEditCoverUrl(url); setEditCoverPreview(url); }

      toast.success("Capa enviada!");
    } catch (error: any) {
      if (mode === "create") { setNewCoverUrl(""); setNewCoverPreview(""); }
      else { setEditCoverUrl(editingGroup?.coverUrl ?? ""); setEditCoverPreview(editingGroup?.coverUrl ?? ""); }
      toast.error(error?.message || "Erro no upload da capa.");
    } finally {
      setIsUploadingCover(false);
    }
  }

  const removeLessonMutation = trpc.courseGroups.removeLesson.useMutation({
    onSuccess: () => { refetchGroups(); toast.success("Aula removida do grupo."); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  // Estado — criar grupo
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCoverUrl, setNewCoverUrl] = useState("");
  const [newCoverPreview, setNewCoverPreview] = useState("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<number[]>([]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Estado — editar grupo
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editCoverPreview, setEditCoverPreview] = useState("");

  // Estado — adicionar aulas a grupo existente
  const [showAddLessonsDialog, setShowAddLessonsDialog] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<number | null>(null);

  // Estado — expandir grupo
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Estado — confirmação de delete
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function resetForm() { setNewTitle(""); setNewDesc(""); setNewCoverUrl(""); setNewCoverPreview(""); setSelectedLessonIds([]); }

  function toggleExpand(id: number) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleLesson(id: number) {
    setSelectedLessonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleCreate() {
    if (courseId === null) { toast.error("Curso inválido."); return; }
    if (!newTitle.trim()) { toast.error("Informe o nome do agrupamento."); return; }
    if (selectedLessonIds.length === 0) { toast.error("Selecione ao menos uma aula."); return; }
    if (isUploadingCover) { toast.error("Aguarde o upload da capa terminar."); return; }
    createGroupMutation.mutate({
      courseId,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      coverUrl: newCoverUrl || undefined,
      lessonIds: selectedLessonIds,
      order: (groups as any[]).length,
    });
  }

  function handleEdit() {
    if (!editTitle.trim()) { toast.error("Informe o nome do agrupamento."); return; }
    if (isUploadingCover) { toast.error("Aguarde o upload da capa terminar."); return; }
    updateGroupMutation.mutate({
      groupId: editingGroup.id,
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
      coverUrl: editCoverUrl || null,
    });
  }

  function openEdit(group: any) {
    setEditingGroup(group);
    setEditTitle(group.title);
    setEditDesc(group.description ?? "");
    setEditCoverUrl(group.coverUrl ?? "");
    setEditCoverPreview(group.coverUrl ?? "");
    setShowEditDialog(true);
  }

  function openAddLessons(groupId: number) {
    setTargetGroupId(groupId);
    setSelectedLessonIds([]);
    setShowAddLessonsDialog(true);
  }

  function togglePublish(group: any) {
    const newVal = group.isPublished === 1 ? 0 : 1;
    updateGroupMutation.mutate(
      { groupId: group.id, isPublished: newVal },
      {
        onSuccess: () => {
          refetchGroups();
          toast.success(newVal === 1 ? "Grupo publicado." : "Grupo despublicado.");
        },
      }
    );
  }

  function moveGroup(index: number, direction: "up" | "down") {
    const arr = [...(groups as any[])];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    reorderGroupsMutation.mutate({ groupIds: arr.map((g: any) => g.id) });
  }

  const ungroupedLessonIds = ungroupedLessons.map((l: any) => l.id);
  const allCreateSelected = ungroupedLessonIds.length > 0 && ungroupedLessonIds.every((id) => selectedLessonIds.includes(id));

  const targetGroup = (groups as any[]).find((g: any) => g.id === targetGroupId);
  const targetGroupLessonIds = new Set((targetGroup?.lessons ?? []).map((l: any) => l.lessonId));
  const availableToAdd = ungroupedLessons.filter((l: any) => !targetGroupLessonIds.has(l.id));
  const availableToAddIds = availableToAdd.map((l: any) => l.id);
  const allAvailableSelected = availableToAddIds.length > 0 && availableToAddIds.every((id) => selectedLessonIds.includes(id));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/admin/courses`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Agrupamentos de Aulas</h1>
            {course && <p className="text-sm text-muted-foreground">Curso: <span className="font-medium text-foreground">{course.title}</span></p>}
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />Criar Agrupamento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{(groups as any[]).length}</p>
              <p className="text-xs text-muted-foreground">Agrupamentos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{(allLessons as any[]).length}</p>
              <p className="text-xs text-muted-foreground">Aulas do curso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{ungroupedLessons.length}</p>
              <p className="text-xs text-muted-foreground">Sem agrupamento</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de grupos */}
        {(groups as any[]).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Layers className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-base font-medium mb-1">Nenhum agrupamento criado</p>
              <p className="text-sm text-muted-foreground mb-4">Agrupe aulas relacionadas para organizar melhor o curso.</p>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />Criar primeiro agrupamento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(groups as any[]).map((group: any, index: number) => (
              <Card key={group.id} className={group.isPublished === 0 ? "opacity-60" : ""}>
                <div className="flex items-center gap-3 p-4">
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                      disabled={index === 0}
                      onClick={() => moveGroup(index, "up")}
                      title="Mover para cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                      disabled={index === (groups as any[]).length - 1}
                      onClick={() => moveGroup(index, "down")}
                      title="Mover para baixo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt={group.title} className="h-10 w-14 rounded object-cover shrink-0 border" />
                  ) : (
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{group.title}</p>
                      {group.isPublished === 0 && (
                        <Badge variant="outline" className="text-xs shrink-0">Rascunho</Badge>
                      )}
                    </div>
                    {group.description && <p className="text-xs text-muted-foreground truncate">{group.description}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{group.lessonCount} aula(s)</Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle publicado */}
                    <button
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-muted"
                      title={group.isPublished === 1 ? "Despublicar" : "Publicar"}
                      onClick={() => togglePublish(group)}
                    >
                      {group.isPublished === 1
                        ? <Eye className="h-4 w-4" />
                        : <EyeOff className="h-4 w-4" />}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => openAddLessons(group.id)} title="Adicionar aulas">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(group)} title="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(group.id)} title="Desfazer agrupamento">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleExpand(group.id)}>
                      {expandedGroups.has(group.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Aulas do grupo */}
                {expandedGroups.has(group.id) && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-2">
                    {group.lessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aula neste grupo.</p>
                    ) : (
                      group.lessons.map((lesson: any, idx: number) => (
                        <div key={lesson.lessonId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                          <span className="text-xs font-medium text-muted-foreground w-5 text-center">{idx + 1}</span>
                          <PlayCircle className="h-4 w-4 text-primary shrink-0" />
                          <p className="text-sm flex-1 truncate">{lesson.title}</p>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0"
                            onClick={() => removeLessonMutation.mutate({ groupId: group.id, lessonId: lesson.lessonId })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                    <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => openAddLessons(group.id)}>
                      <Plus className="h-4 w-4 mr-2" />Adicionar aulas
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Aulas sem grupo */}
        {ungroupedLessons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aulas sem agrupamento ({ungroupedLessons.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ungroupedLessons.map((lesson: any) => (
                <div key={lesson.id} className="flex items-center gap-2 p-2 rounded border text-sm">
                  <PlayCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{lesson.title}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Dialog: Criar agrupamento ── */}
      <Dialog open={showCreateDialog} onOpenChange={(o) => { if (!o) { setShowCreateDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Agrupamento</DialogTitle>
            <DialogDescription>
              Agrupe aulas relacionadas e dê um nome ao bloco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do agrupamento</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Fundamentos do Curso" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} className="resize-none" placeholder="Breve descrição..." />
            </div>
            {/* Upload de capa */}
            <div className="space-y-2">
              <Label>Capa do agrupamento (opcional)</Label>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0], "create")} />
              {newCoverPreview ? (
                <div className="relative rounded-lg overflow-hidden border h-32 bg-muted">
                  <img src={newCoverPreview} alt="Capa" className="w-full h-full object-cover" />
                  <button onClick={() => { setNewCoverUrl(""); setNewCoverPreview(""); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-24 border-dashed flex flex-col gap-1"
                  onClick={() => fileInputRef.current?.click()} disabled={isUploadingCover}>
                  {isUploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{isUploadingCover ? "Enviando..." : "Clique para fazer upload"}</span>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Selecione as aulas do curso</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setSelectedLessonIds(ungroupedLessonIds)}
                    disabled={ungroupedLessonIds.length === 0 || allCreateSelected}>
                    Selecionar todas
                  </Button>
                  <Button type="button" size="sm" variant="ghost"
                    onClick={() => setSelectedLessonIds([])}
                    disabled={selectedLessonIds.length === 0}>
                    Limpar
                  </Button>
                </div>
              </div>
              {ungroupedLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {(allLessons as any[]).length === 0
                    ? "Nenhuma aula cadastrada neste curso."
                    : "Todas as aulas já estão em algum agrupamento."}
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1 border rounded-lg p-3">
                  {ungroupedLessons.map((lesson: any) => (
                    <div key={lesson.id}
                      className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => toggleLesson(lesson.id)}>
                      <Checkbox checked={selectedLessonIds.includes(lesson.id)}
                        onCheckedChange={() => toggleLesson(lesson.id)} />
                      <span className="text-sm flex-1 truncate">{lesson.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedLessonIds.length > 0 && (
                <p className="text-xs text-primary">{selectedLessonIds.length} aula(s) selecionada(s)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createGroupMutation.isPending || isUploadingCover}>
              {createGroupMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar agrupamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar agrupamento ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agrupamento</DialogTitle>
            <DialogDescription>
              Atualize o nome, a descrição e a capa do agrupamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Capa do agrupamento</Label>
              <input ref={editFileInputRef} type="file" className="hidden" accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0], "edit")} />
              {editCoverPreview ? (
                <div className="relative rounded-lg overflow-hidden border h-32 bg-muted">
                  <img src={editCoverPreview} alt="Capa" className="w-full h-full object-cover" />
                  <button onClick={() => { setEditCoverUrl(""); setEditCoverPreview(""); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" className="w-full h-24 border-dashed flex flex-col gap-1"
                  onClick={() => editFileInputRef.current?.click()} disabled={isUploadingCover}>
                  {isUploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{isUploadingCover ? "Enviando..." : "Clique para fazer upload"}</span>
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateGroupMutation.isPending || isUploadingCover}>
              {updateGroupMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar aulas ao grupo ── */}
      <Dialog open={showAddLessonsDialog} onOpenChange={(o) => { if (!o) { setShowAddLessonsDialog(false); setSelectedLessonIds([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Aulas ao Grupo</DialogTitle>
            <DialogDescription>
              Escolha aulas disponíveis (sem agrupamento) para incluir neste bloco.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {availableToAdd.length > 0 && (
              <div className="flex items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline"
                  onClick={() => setSelectedLessonIds(availableToAddIds)}
                  disabled={allAvailableSelected}>
                  Selecionar todas
                </Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => setSelectedLessonIds([])}
                  disabled={selectedLessonIds.length === 0}>
                  Limpar
                </Button>
              </div>
            )}
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todas as aulas já estão em algum agrupamento.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1 border rounded-lg p-3">
                {availableToAdd.map((lesson: any) => (
                  <div key={lesson.id} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => toggleLesson(lesson.id)}>
                    <Checkbox checked={selectedLessonIds.includes(lesson.id)}
                      onCheckedChange={() => toggleLesson(lesson.id)} />
                    <span className="text-sm flex-1 truncate">{lesson.title}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedLessonIds.length > 0 && (
              <p className="text-xs text-primary">{selectedLessonIds.length} aula(s) selecionada(s)</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddLessonsDialog(false); setSelectedLessonIds([]); }}>Cancelar</Button>
            <Button onClick={() => targetGroupId && addLessonsMutation.mutate({ groupId: targetGroupId, lessonIds: selectedLessonIds })}
              disabled={addLessonsMutation.isPending || selectedLessonIds.length === 0}>
              {addLessonsMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adicionando...</> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar delete ── */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desfazer agrupamento?</DialogTitle>
            <DialogDescription>
              O agrupamento será removido, mas todas as aulas continuarão disponíveis no curso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteGroupMutation.mutate({ groupId: confirmDelete })}>
              {deleteGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desfazer agrupamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

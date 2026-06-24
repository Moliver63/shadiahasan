/**
 * AdminCourseGroups — Gerenciamento de agrupamentos de aulas por curso
 * Rota: /admin/courses/:id/groups
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import {
  Plus, Trash2, ArrowLeft, Edit, Layers, PlayCircle,
  ChevronDown, ChevronUp, Loader2, FolderOpen, ImageIcon, Upload,
} from "lucide-react";
import { useRef } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

export default function AdminCourseGroups() {
  const params = useParams();
  const courseId = parseInt(params.id || "0");

  // Queries
  const { data: course } = trpc.courses.getById.useQuery(
    { id: courseId },
    { enabled: courseId > 0 }
  );
  const { data: groups = [], refetch: refetchGroups } = trpc.courseGroups.adminListByCourse.useQuery(
    { courseId },
    { enabled: courseId > 0 }
  );
  const { data: allLessons = [] } = trpc.courseGroups.adminListLessons.useQuery();

  // Aulas que ainda não estão em nenhum grupo
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
    onSuccess: (data) => { refetchGroups(); toast.success(`${data.added} aula(s) adicionada(s)!`); setShowAddLessonsDialog(false); setSelectedLessonIds([]); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const uploadThumbnailMutation = trpc.courses.uploadThumbnail.useMutation();

  async function handleCoverUpload(file: File, mode: "create" | "edit") {
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 2MB."); return; }
    setIsUploadingCover(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const preview = reader.result as string;
        if (mode === "create") setNewCoverPreview(preview);
        else setEditCoverPreview(preview);
      };
      reader.readAsDataURL(file);

      const base64Reader = new FileReader();
      base64Reader.onload = async () => {
        const base64Data = (base64Reader.result as string).split(",")[1];
        const { url } = await uploadThumbnailMutation.mutateAsync({ fileName: file.name, contentType: file.type, base64Data });
        if (mode === "create") { setNewCoverUrl(url); setNewCoverPreview(url); }
        else { setEditCoverUrl(url); setEditCoverPreview(url); }
        toast.success("Capa enviada!");
      };
      base64Reader.readAsDataURL(file);
    } catch { toast.error("Erro no upload da capa."); }
    finally { setIsUploadingCover(false); }
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
    if (!newTitle.trim()) { toast.error("Informe o nome do agrupamento."); return; }
    if (selectedLessonIds.length === 0) { toast.error("Selecione ao menos uma aula."); return; }
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

  // Aulas disponíveis para adicionar ao grupo selecionado
  const targetGroup = (groups as any[]).find((g: any) => g.id === targetGroupId);
  const targetGroupLessonIds = new Set((targetGroup?.lessons ?? []).map((l: any) => l.lessonId));
  const availableToAdd = (allLessons as any[]).filter((l: any) => !targetGroupLessonIds.has(l.id) && !groupedLessonIds.has(l.id));

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
              <p className="text-xs text-muted-foreground">Total de aulas</p>
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
            {(groups as any[]).map((group: any) => (
              <Card key={group.id}>
                {/* Header do grupo */}
                <div className="flex items-center gap-3 p-4">
                  {group.coverUrl ? (
                    <img src={group.coverUrl} alt={group.title} className="h-10 w-14 rounded object-cover shrink-0 border" />
                  ) : (
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{group.title}</p>
                    {group.description && <p className="text-xs text-muted-foreground truncate">{group.description}</p>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{group.lessonCount} aula(s)</Badge>
                  <div className="flex items-center gap-1 shrink-0">
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
              <Label>Selecione as aulas</Label>
              {(allLessons as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma aula disponível.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
                  {/* Agrupa aulas por curso para facilitar seleção */}
                  {Object.entries(
                    (allLessons as any[]).reduce((acc: any, lesson: any) => {
                      const key = lesson.courseTitle || "Sem curso";
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(lesson);
                      return acc;
                    }, {})
                  ).map(([courseTitle, courseLessons]: [string, any]) => (
                    <div key={courseTitle}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 bg-muted/50 rounded sticky top-0">
                        📚 {courseTitle}
                      </p>
                      {(courseLessons as any[]).map((lesson: any) => (
                        <div key={lesson.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent/30 transition-colors ${groupedLessonIds.has(lesson.id) ? "opacity-40" : ""}`}
                          onClick={() => !groupedLessonIds.has(lesson.id) && toggleLesson(lesson.id)}>
                          <Checkbox checked={selectedLessonIds.includes(lesson.id)} disabled={groupedLessonIds.has(lesson.id)}
                            onCheckedChange={() => !groupedLessonIds.has(lesson.id) && toggleLesson(lesson.id)} />
                          <span className="text-sm flex-1 truncate">{lesson.title}</span>
                          {groupedLessonIds.has(lesson.id) && <Badge variant="outline" className="text-xs shrink-0">Em grupo</Badge>}
                        </div>
                      ))}
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
            <Button onClick={handleCreate} disabled={createGroupMutation.isPending}>
              {createGroupMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar agrupamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar agrupamento ── */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Agrupamento</DialogTitle></DialogHeader>
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
            <Button onClick={handleEdit} disabled={updateGroupMutation.isPending}>
              {updateGroupMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar aulas ao grupo ── */}
      <Dialog open={showAddLessonsDialog} onOpenChange={(o) => { if (!o) { setShowAddLessonsDialog(false); setSelectedLessonIds([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Aulas ao Grupo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Todas as aulas já estão neste grupo ou em outro.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 border rounded-lg p-3">
                {Object.entries(
                  (availableToAdd as any[]).reduce((acc: any, lesson: any) => {
                    const key = lesson.courseTitle || "Sem curso";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(lesson);
                    return acc;
                  }, {})
                ).map(([courseTitle, courseLessons]: [string, any]) => (
                  <div key={courseTitle}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 bg-muted/50 rounded">
                      📚 {courseTitle}
                    </p>
                    {(courseLessons as any[]).map((lesson: any) => (
                      <div key={lesson.id} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={() => toggleLesson(lesson.id)}>
                        <Checkbox checked={selectedLessonIds.includes(lesson.id)}
                          onCheckedChange={() => toggleLesson(lesson.id)} />
                        <span className="text-sm flex-1 truncate">{lesson.title}</span>
                      </div>
                    ))}
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
          <DialogHeader><DialogTitle>Desfazer agrupamento?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            O agrupamento será removido, mas todas as aulas serão mantidas intactas no curso.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteGroupMutation.mutate({ groupId: confirmDelete })}>
              Desfazer agrupamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

/**
 * AdminCollections — Gerenciamento de Agrupamentos de Conteúdo
 * Rota: /admin/collections
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "@/lib/formatDuration";
import {
  Plus, Trash2, Edit, Eye, EyeOff, ChevronDown, ChevronUp,
  Loader2, ImageIcon, Search, PlayCircle, Copy, Clock,
  GripVertical, History, X, BookOpen, Layers,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

// ── Upload Cloudinary ──────────────────────────────────────────────────────
async function uploadToCloudinary(file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024) throw new Error("Imagem muito grande. Máximo 4MB.");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "thome_unsigned");
  formData.append("folder", "shadiahasan/collections");
  const res = await fetch("https://api.cloudinary.com/v1_1/dzty82u60/image/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Falha no upload da imagem.");
  const data = await res.json();
  if (!data.secure_url) throw new Error("Cloudinary não retornou URL.");
  return data.secure_url;
}

// ── Componente de prévia de capa ───────────────────────────────────────────
function CoverUpload({ value, preview, onUpload, onClear, loading }: {
  value: string; preview: string; onUpload: (f: File) => void; onClear: () => void; loading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label>Capa (opcional)</Label>
      <input ref={ref} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border h-32 bg-muted">
          <img src={preview} alt="Capa" className="w-full h-full object-cover" />
          <button onClick={onClear} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button variant="outline" className="w-full h-24 border-dashed flex flex-col gap-1"
          onClick={() => ref.current?.click()} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{loading ? "Enviando..." : "Clique para fazer upload"}</span>
        </Button>
      )}
    </div>
  );
}

// ── Seletor de aulas ───────────────────────────────────────────────────────
function LessonPicker({ selectedIds, onChange, excludeIds = [] }: {
  selectedIds: number[]; onChange: (ids: number[]) => void; excludeIds?: number[];
}) {
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<number | undefined>();

  const { data: allLessons = [], isLoading } = trpc.collections.searchLessons.useQuery(
    { query: search, courseId: courseFilter },
    { staleTime: 30_000 }
  );

  const available = (allLessons as any[]).filter((l: any) => !excludeIds.includes(l.id));
  const courseOptions = [...new Map((available as any[]).map((l: any) => [l.courseId, l.courseTitle])).entries()];

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function selectAll() { onChange([...new Set([...selectedIds, ...available.map((l: any) => l.id)])]); }
  function clearAll() { onChange(selectedIds.filter((id) => !available.some((l: any) => l.id === id))); }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar aulas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <select className="border rounded-md px-2 text-sm bg-background" value={courseFilter ?? ""} onChange={(e) => setCourseFilter(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">Todos os cursos</option>
          {courseOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{selectedIds.length} selecionada(s)</span>
        <div className="flex gap-2">
          <button className="text-primary hover:underline" onClick={selectAll}>Selecionar todas</button>
          <span>·</span>
          <button className="hover:underline" onClick={clearAll}>Limpar</button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma aula encontrada.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
          {(available as any[]).map((lesson: any) => (
            <div key={lesson.id} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggle(lesson.id)}>
              <Checkbox checked={selectedIds.includes(lesson.id)} onCheckedChange={() => toggle(lesson.id)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{lesson.title}</p>
                <p className="text-xs text-muted-foreground">{lesson.courseTitle}{lesson.duration ? ` · ${formatDuration(lesson.duration)}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function AdminCollections() {
  const { data: collections = [], refetch, isLoading } = trpc.collections.adminList.useQuery();

  const createMutation = trpc.collections.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Agrupamento criado!"); setShowCreate(false); resetCreate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.collections.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Salvo!"); setShowEdit(false); },
    onError: (e) => toast.error(e.message),
  });
  const addLessonsMutation = trpc.collections.addLessons.useMutation({
    onSuccess: (d: any) => { refetch(); toast.success(`${d.added} aula(s) adicionada(s)!`); setShowAddLessons(false); setPickerIds([]); },
    onError: (e) => toast.error(e.message),
  });
  const removeLessonMutation = trpc.collections.removeLesson.useMutation({
    onSuccess: () => { refetch(); if (detailId) refetchDetail(); toast.success("Aula removida."); },
    onError: (e) => toast.error(e.message),
  });
  const reorderMutation = trpc.collections.reorderCollections.useMutation({
    onSuccess: () => refetch(),
  });
  const duplicateMutation = trpc.collections.duplicate.useMutation({
    onSuccess: () => { refetch(); toast.success("Agrupamento duplicado (inativo)."); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.collections.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Agrupamento removido."); setConfirmDelete(null); },
    onError: (e) => toast.error(e.message),
  });

  // Estado — criar
  const [showCreate, setShowCreate] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cSubtitle, setCSubtitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cCoverUrl, setCCoverUrl] = useState("");
  const [cCoverPreview, setCCoverPreview] = useState("");
  const [cLessonIds, setCLessonIds] = useState<number[]>([]);
  const [cUploading, setCUploading] = useState(false);

  function resetCreate() { setCTitle(""); setCSubtitle(""); setCDesc(""); setCCoverUrl(""); setCCoverPreview(""); setCLessonIds([]); }

  async function handleCoverUpload(file: File, setUrl: (u: string) => void, setPreview: (p: string) => void, setLoading: (b: boolean) => void) {
    setLoading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const url = await uploadToCloudinary(file);
      setUrl(url);
      setPreview(url);
      toast.success("Capa enviada!");
    } catch (e: any) {
      setUrl(""); setPreview(""); toast.error(e.message);
    } finally { setLoading(false); }
  }

  // Estado — editar
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [eTitle, setETitle] = useState("");
  const [eSubtitle, setESubtitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eCoverUrl, setECoverUrl] = useState("");
  const [eCoverPreview, setECoverPreview] = useState("");
  const [eUploading, setEUploading] = useState(false);

  function openEdit(col: any) {
    setEditing(col); setETitle(col.title); setESubtitle(col.subtitle ?? "");
    setEDesc(col.description ?? ""); setECoverUrl(col.coverUrl ?? ""); setECoverPreview(col.coverUrl ?? "");
    setShowEdit(true);
  }

  // Estado — detalhe / aulas
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: detail, refetch: refetchDetail } = trpc.collections.getById.useQuery(
    { id: detailId ?? 0 },
    { enabled: detailId !== null && detailId > 0, staleTime: 0 }
  );

  // Estado — adicionar aulas
  const [showAddLessons, setShowAddLessons] = useState(false);
  const [addTarget, setAddTarget] = useState<number | null>(null);
  const [pickerIds, setPickerIds] = useState<number[]>([]);

  // Estado — histórico
  const [showHistory, setShowHistory] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const { data: history = [] } = trpc.collections.getHistory.useQuery(
    { collectionId: historyId ?? 0 },
    { enabled: historyId !== null && historyId > 0 }
  );

  // Estado — delete
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpand(id: number) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    if (!expanded.has(id)) setDetailId(id);
  }

  function moveCollection(index: number, dir: "up" | "down") {
    const arr = [...(collections as any[])];
    const t = dir === "up" ? index - 1 : index + 1;
    if (t < 0 || t >= arr.length) return;
    [arr[index], arr[t]] = [arr[t], arr[index]];
    reorderMutation.mutate({ ids: arr.map((c: any) => c.id) });
  }

  const existingIds = (detail?.lessons ?? []).map((i: any) => i.lessonId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agrupamentos de Conteúdo</h1>
            <p className="text-sm text-muted-foreground mt-1">Coleções de aulas de qualquer curso, exibidas como um programa único.</p>
          </div>
          <Button onClick={() => { resetCreate(); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-2" />Criar Agrupamento
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{(collections as any[]).length}</p>
            <p className="text-xs text-muted-foreground">Agrupamentos</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{(collections as any[]).filter((c: any) => c.isActive === 1).length}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-2xl font-bold">{(collections as any[]).reduce((a: number, c: any) => a + (c.lessonCount || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Total de aulas</p>
          </CardContent></Card>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (collections as any[]).length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <Layers className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="font-medium mb-1">Nenhum agrupamento criado</p>
            <p className="text-sm text-muted-foreground mb-4">Crie coleções de aulas de qualquer curso.</p>
            <Button onClick={() => { resetCreate(); setShowCreate(true); }}><Plus className="h-4 w-4 mr-2" />Criar primeiro</Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {(collections as any[]).map((col: any, index: number) => (
              <Card key={col.id} className={col.isActive === 0 ? "opacity-60" : ""}>
                <div className="flex items-center gap-3 p-4">
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button className="text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={index === 0} onClick={() => moveCollection(index, "up")}><ChevronUp className="h-3.5 w-3.5" /></button>
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <button className="text-muted-foreground hover:text-foreground disabled:opacity-20" disabled={index === (collections as any[]).length - 1} onClick={() => moveCollection(index, "down")}><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>

                  {col.coverUrl ? (
                    <img src={col.coverUrl} alt={col.title} className="h-10 w-14 rounded object-cover shrink-0 border" />
                  ) : (
                    <div className="h-10 w-14 rounded bg-muted flex items-center justify-center shrink-0 border">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{col.title}</p>
                      {col.isActive === 0 && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                    </div>
                    {col.subtitle && <p className="text-xs text-primary/80 truncate">{col.subtitle}</p>}
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span><BookOpen className="h-3 w-3 inline mr-0.5" />{col.lessonCount} aula(s)</span>
                      {col.totalDuration > 0 && <span><Clock className="h-3 w-3 inline mr-0.5" />{formatDuration(col.totalDuration)}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title={col.isActive === 1 ? "Desativar" : "Ativar"}
                      onClick={() => updateMutation.mutate({ id: col.id, isActive: col.isActive === 1 ? 0 : 1 })}>
                      {col.isActive === 1 ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Duplicar"
                      onClick={() => duplicateMutation.mutate({ id: col.id })}>
                      <Copy className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Histórico"
                      onClick={() => { setHistoryId(col.id); setShowHistory(true); }}>
                      <History className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar"
                      onClick={() => openEdit(col)}>
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted text-destructive hover:text-destructive" title="Excluir"
                      onClick={() => setConfirmDelete(col.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      onClick={() => toggleExpand(col.id)}>
                      {expanded.has(col.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Aulas do agrupamento */}
                {expanded.has(col.id) && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-2">
                    {!detail || detail.id !== col.id ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : (detail.lessons ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma aula neste agrupamento.</p>
                    ) : (
                      (detail.lessons ?? []).map((item: any, idx: number) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                          <span className="text-xs font-medium text-muted-foreground w-5 text-center">{idx + 1}</span>
                          <PlayCircle className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{item.lesson?.title ?? "–"}</p>
                            <p className="text-xs text-muted-foreground">{item.course?.title}{item.lesson?.duration ? ` · ${formatDuration(item.lesson.duration)}` : ""}</p>
                          </div>
                          <button className="text-destructive hover:text-destructive p-1 rounded hover:bg-muted"
                            onClick={() => removeLessonMutation.mutate({ collectionId: col.id, lessonId: item.lessonId })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                    <Button size="sm" variant="outline" className="w-full mt-2"
                      onClick={() => { setAddTarget(col.id); setPickerIds([]); setShowAddLessons(true); }}>
                      <Plus className="h-4 w-4 mr-2" />Adicionar aulas
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog: Criar ── */}
      <Dialog open={showCreate} onOpenChange={(o) => { if (!o) { setShowCreate(false); resetCreate(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Agrupamento</DialogTitle>
            <DialogDescription>Coleção de aulas de qualquer curso exibida como programa único.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nome *</Label><Input value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Ex: Permita-se Ser Livre" /></div>
            <div className="space-y-2"><Label>Subtítulo (opcional)</Label><Input value={cSubtitle} onChange={(e) => setCSubtitle(e.target.value)} placeholder="Ex: Jornada de autoconhecimento" /></div>
            <div className="space-y-2"><Label>Descrição (opcional)</Label><Textarea value={cDesc} onChange={(e) => setCDesc(e.target.value)} rows={2} className="resize-none" /></div>
            <CoverUpload value={cCoverUrl} preview={cCoverPreview}
              onUpload={(f) => handleCoverUpload(f, setCCoverUrl, setCCoverPreview, setCUploading)}
              onClear={() => { setCCoverUrl(""); setCCoverPreview(""); }} loading={cUploading} />
            <div className="space-y-2">
              <Label>Selecionar aulas</Label>
              <LessonPicker selectedIds={cLessonIds} onChange={setCLessonIds} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreate(); }}>Cancelar</Button>
            <Button onClick={() => {
              if (!cTitle.trim()) { toast.error("Informe o nome."); return; }
              if (cUploading) { toast.error("Aguarde o upload."); return; }
              createMutation.mutate({ title: cTitle, subtitle: cSubtitle || undefined, description: cDesc || undefined, coverUrl: cCoverUrl || undefined, lessonIds: cLessonIds });
            }} disabled={createMutation.isPending || cUploading}>
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Criando...</> : "Criar agrupamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar ── */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Agrupamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nome</Label><Input value={eTitle} onChange={(e) => setETitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Subtítulo</Label><Input value={eSubtitle} onChange={(e) => setESubtitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={eDesc} onChange={(e) => setEDesc(e.target.value)} rows={2} className="resize-none" /></div>
            <CoverUpload value={eCoverUrl} preview={eCoverPreview}
              onUpload={(f) => handleCoverUpload(f, setECoverUrl, setECoverPreview, setEUploading)}
              onClear={() => { setECoverUrl(""); setECoverPreview(""); }} loading={eUploading} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!eTitle.trim()) { toast.error("Informe o nome."); return; }
              updateMutation.mutate({ id: editing.id, title: eTitle, subtitle: eSubtitle || null, description: eDesc || null, coverUrl: eCoverUrl || null });
            }} disabled={updateMutation.isPending || eUploading}>
              {updateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar aulas ── */}
      <Dialog open={showAddLessons} onOpenChange={(o) => { if (!o) { setShowAddLessons(false); setPickerIds([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Aulas</DialogTitle>
            <DialogDescription>Busque e selecione aulas de qualquer curso.</DialogDescription>
          </DialogHeader>
          <LessonPicker selectedIds={pickerIds} onChange={setPickerIds} excludeIds={existingIds} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddLessons(false); setPickerIds([]); }}>Cancelar</Button>
            <Button onClick={() => addTarget && addLessonsMutation.mutate({ collectionId: addTarget, lessonIds: pickerIds })}
              disabled={addLessonsMutation.isPending || pickerIds.length === 0}>
              {addLessonsMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adicionando...</> : `Adicionar ${pickerIds.length > 0 ? pickerIds.length : ""} aula(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Histórico ── */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de Alterações</DialogTitle></DialogHeader>
          {(history as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum histórico registrado.</p>
          ) : (
            <div className="space-y-2">
              {(history as any[]).map((h: any) => (
                <div key={h.id} className="flex gap-3 text-sm p-2 rounded border">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{h.action.replace(/_/g, " ")}</p>
                    {h.detail && <p className="text-xs text-muted-foreground">{h.detail}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{new Date(h.performedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar delete ── */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir agrupamento?</DialogTitle>
            <DialogDescription>Esta ação remove o agrupamento e seus vínculos. As aulas originais não são afetadas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteMutation.mutate({ id: confirmDelete })}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

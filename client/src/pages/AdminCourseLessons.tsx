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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  Plus, Edit, Trash2, ArrowLeft, Eye, EyeOff,
  PlayCircle, Upload, Youtube, Cloud, Lock, Unlock,
  CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type VideoProvider = "cloudflare" | "youtube" | "hls" | "other";

interface FormData {
  title: string;
  order: number;
  description: string;
  videoProvider: VideoProvider;
  videoAssetId: string;
  videoPlaybackUrl: string;
  duration: number;
  isPublished: number;
  isAccessRestricted: number;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; fileName: string }
  | { status: "processing"; uid: string }
  | { status: "done"; uid: string; fileName: string }
  | { status: "error"; message: string };

// ─── Helper: upload TUS para Cloudflare Stream ───────────────────────────────
// O Cloudflare Stream usa o protocolo TUS para upload resumível.
// Fazemos o upload direto do browser → Cloudflare (sem passar pelo servidor).

async function tusUpload(
  file: File,
  uploadUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const CHUNK = 50 * 1024 * 1024; // 50 MB por chunk
  let offset = 0;

  // Upload em chunks via protocolo TUS (Cloudflare Stream)
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK);
    const res = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": String(offset),
        "Tus-Resumable": "1.0.0",
      },
      body: chunk,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Erro no upload (offset ${offset}): ${res.status} ${errText}`);
    }

    const newOffset = res.headers.get("Upload-Offset");
    offset = newOffset ? parseInt(newOffset) : offset + chunk.size;
    onProgress(Math.round((offset / file.size) * 100));
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminCourseLessons() {
  const params = useParams();
  const courseId = parseInt(params.id || "0");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emptyForm = (): FormData => ({
    title: "",
    order: 1,
    description: "",
    videoProvider: "cloudflare",
    videoAssetId: "",
    videoPlaybackUrl: "",
    duration: 0,
    isPublished: 0,
    isAccessRestricted: 0,
  });

  const [formData, setFormData] = useState<FormData>(emptyForm());

  const utils = trpc.useUtils();
  const { data: course } = trpc.courses.getById.useQuery({ id: courseId });
  const { data: lessons, isLoading } = trpc.lessons.listByCourse.useQuery({ courseId });
  const { data: cfStatus } = trpc.videos.admin.cfStatus.useQuery();

  const createUploadUrlMutation = trpc.videos.admin.createUploadUrl.useMutation();
  const updateLessonVideoMutation = trpc.videos.admin.updateLessonVideo.useMutation();

  const createMutation = trpc.lessons.create.useMutation({
    onSuccess: () => {
      toast.success("Aula criada com sucesso!");
      utils.lessons.listByCourse.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`Erro ao criar aula: ${e.message}`),
  });

  const updateMutation = trpc.lessons.update.useMutation({
    onSuccess: () => {
      toast.success("Aula atualizada com sucesso!");
      utils.lessons.listByCourse.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`Erro ao atualizar aula: ${e.message}`),
  });

  const deleteMutation = trpc.lessons.delete.useMutation({
    onSuccess: () => {
      toast.success("Aula excluída com sucesso!");
      utils.lessons.listByCourse.invalidate();
    },
    onError: (e) => toast.error(`Erro ao excluir aula: ${e.message}`),
  });

  // ── Upload de arquivo para Cloudflare Stream ──────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo válido.");
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10 GB.");
      return;
    }

    setUploadState({ status: "uploading", progress: 0, fileName: file.name });

    try {
      // 1. Obter URL de upload direto do servidor
      const { uploadUrl, uid } = await createUploadUrlMutation.mutateAsync({
        name: formData.title || file.name,
        isProtected: formData.isAccessRestricted === 1,
      });

      // 2. Upload direto browser → Cloudflare (sem passar pelo servidor)
      await tusUpload(file, uploadUrl, (pct) => {
        setUploadState({ status: "uploading", progress: pct, fileName: file.name });
      });

      // 3. Vídeo enviado — CF processa em background
      setUploadState({ status: "done", uid, fileName: file.name });
      setFormData((prev) => ({
        ...prev,
        videoProvider: "cloudflare",
        videoAssetId: uid,
        videoPlaybackUrl: "", // será preenchido quando CF processar
      }));

      toast.success("Vídeo enviado! O Cloudflare está processando — pode levar alguns minutos.");
    } catch (err: any) {
      setUploadState({ status: "error", message: err.message || "Falha no upload" });
      toast.error("Erro no upload: " + (err.message || "tente novamente"));
    }

    // Limpar input para permitir re-seleção do mesmo arquivo
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [formData.title, formData.isAccessRestricted, createUploadUrlMutation]);

  // ── Dialogs ───────────────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingLesson(null);
    const nextOrder = lessons ? lessons.length + 1 : 1;
    setFormData({ ...emptyForm(), order: nextOrder });
    setUploadState({ status: "idle" });
    setDialogOpen(true);
  };

  const openEditDialog = (lesson: any) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      order: lesson.order,
      description: lesson.description || "",
      videoProvider: (lesson.videoProvider as VideoProvider) || "cloudflare",
      videoAssetId: lesson.videoAssetId || "",
      videoPlaybackUrl: lesson.videoPlaybackUrl || "",
      duration: lesson.duration || 0,
      isPublished: lesson.isPublished,
      isAccessRestricted: lesson.isAccessRestricted ?? 0,
    });
    setUploadState({ status: "idle" });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingLesson(null);
    setUploadState({ status: "idle" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast.error("Título é obrigatório");
      return;
    }

    const payload = {
      title: formData.title,
      order: formData.order,
      description: formData.description,
      videoProvider: formData.videoProvider,
      videoAssetId: formData.videoAssetId || null,
      videoPlaybackUrl: formData.videoPlaybackUrl || null,
      duration: formData.duration,
      isPublished: formData.isPublished,
      isAccessRestricted: formData.isAccessRestricted,
    };

    if (editingLesson) {
      updateMutation.mutate({ id: editingLesson.id, ...payload });
    } else {
      createMutation.mutate({ courseId, ...payload });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {course && (
          <Breadcrumbs
            items={getBreadcrumbs(`/admin/courses/${courseId}/lessons`, {
              courseId: courseId.toString(),
              courseTitle: course.title,
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
            <div className="flex items-center gap-3">
              {/* Indicador de status do Cloudflare */}
              {cfStatus && (
                <Badge variant={cfStatus.configured ? "default" : "secondary"} className="text-xs">
                  {cfStatus.configured ? (
                    <><Cloud className="h-3 w-3 mr-1" />Cloudflare ativo</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" />CF não configurado</>
                  )}
                </Badge>
              )}
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Aula
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de aulas */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : lessons && lessons.length > 0 ? (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <Card key={lesson.id}>
                <CardHeader className="py-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground text-sm font-normal shrink-0">
                        #{lesson.order}
                      </span>
                      <span className="truncate">{lesson.title}</span>

                      {/* Provider badge */}
                      {lesson.videoProvider === "youtube" && (
                        <Badge variant="outline" className="shrink-0 text-red-600 border-red-200">
                          <Youtube className="h-3 w-3 mr-1" />YouTube
                        </Badge>
                      )}
                      {lesson.videoProvider === "cloudflare" && (
                        <Badge variant="outline" className="shrink-0 text-orange-600 border-orange-200">
                          <Cloud className="h-3 w-3 mr-1" />Cloudflare
                        </Badge>
                      )}

                      {/* Acesso restrito */}
                      {(lesson as any).isAccessRestricted === 1 ? (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          <Lock className="h-3 w-3 mr-1" />Pago
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-xs text-green-600 border-green-200">
                          <Unlock className="h-3 w-3 mr-1" />Grátis
                        </Badge>
                      )}

                      {/* Publicado */}
                      {lesson.isPublished ? (
                        <Eye className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(lesson)}>
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Excluir a aula "${lesson.title}"?`)) {
                            deleteMutation.mutate({ id: lesson.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>

                {(lesson.description || lesson.videoPlaybackUrl || lesson.videoAssetId) && (
                  <CardContent className="pt-0 pb-4">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {lesson.description && (
                        <p className="line-clamp-1">{lesson.description}</p>
                      )}
                      {(lesson.videoPlaybackUrl || lesson.videoAssetId) && (
                        <div className="flex items-center gap-2 text-xs">
                          <PlayCircle className="h-3 w-3" />
                          <span>Vídeo configurado</span>
                          {lesson.duration ? (
                            <span>• {Math.floor(lesson.duration / 60)} min</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhuma aula cadastrada ainda</p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Aula
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Dialog criar/editar aula ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
              <DialogDescription>Preencha as informações da aula</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">

              {/* Título + Ordem */}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Nome da aula"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Ordem</Label>
                  <Input
                    id="order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição da aula..."
                  rows={2}
                />
              </div>

              {/* Seletor de provider */}
              <div className="space-y-3">
                <Label>Fonte do vídeo</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, videoProvider: "cloudflare", videoPlaybackUrl: "" })}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.videoProvider === "cloudflare"
                        ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <Cloud className="h-5 w-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Cloudflare Stream</p>
                      <p className="text-xs text-muted-foreground">Upload de arquivo do PC</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, videoProvider: "youtube", videoAssetId: "" })}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.videoProvider === "youtube"
                        ? "border-red-400 bg-red-50 dark:bg-red-950/20"
                        : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <Youtube className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">YouTube</p>
                      <p className="text-xs text-muted-foreground">Colar URL do vídeo</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* ── Cloudflare: upload de arquivo ── */}
              {formData.videoProvider === "cloudflare" && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                  <Label>Upload do vídeo</Label>

                  {/* Estado: idle ou erro */}
                  {(uploadState.status === "idle" || uploadState.status === "error") && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-20 border-dashed flex flex-col gap-1"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!cfStatus?.configured}
                      >
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">
                          {cfStatus?.configured
                            ? "Clique para selecionar o vídeo"
                            : "Configure o Cloudflare Stream primeiro"}
                        </span>
                        <span className="text-xs text-muted-foreground">MP4, MOV, AVI — até 10 GB</span>
                      </Button>
                      {uploadState.status === "error" && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {uploadState.message}
                        </p>
                      )}
                      {/* Se já tem UID salvo (edição) */}
                      {formData.videoAssetId && uploadState.status === "idle" && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Vídeo atual: <code className="text-xs bg-muted px-1 rounded">{formData.videoAssetId}</code>
                          <span className="text-xs">(enviar novo arquivo substitui)</span>
                        </p>
                      )}
                    </>
                  )}

                  {/* Estado: enviando */}
                  {uploadState.status === "uploading" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando {uploadState.fileName}...
                        </span>
                        <span className="font-mono">{uploadState.progress}%</span>
                      </div>
                      <Progress value={uploadState.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Não feche esta janela enquanto o upload estiver em andamento.
                      </p>
                    </div>
                  )}

                  {/* Estado: processando */}
                  {uploadState.status === "processing" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cloudflare está processando o vídeo...
                    </div>
                  )}

                  {/* Estado: concluído */}
                  {uploadState.status === "done" && (
                    <div className="space-y-1">
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Upload concluído — {uploadState.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        UID: <code className="bg-muted px-1 rounded">{uploadState.uid}</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        O vídeo ficará disponível em alguns minutos enquanto o Cloudflare processa.
                      </p>
                    </div>
                  )}

                  {/* Campo manual de UID (opcional) */}
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="videoAssetId" className="text-xs text-muted-foreground">
                      UID do vídeo (preenchido automaticamente após upload)
                    </Label>
                    <Input
                      id="videoAssetId"
                      value={formData.videoAssetId}
                      onChange={(e) => setFormData({ ...formData, videoAssetId: e.target.value })}
                      placeholder="a1b2c3d4e5f6..."
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* ── YouTube: URL ── */}
              {formData.videoProvider === "youtube" && (
                <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
                  <Label htmlFor="videoPlaybackUrl">URL do YouTube</Label>
                  <div className="flex gap-2 items-center">
                    <Youtube className="h-5 w-5 text-red-500 shrink-0" />
                    <Input
                      id="videoPlaybackUrl"
                      value={formData.videoPlaybackUrl}
                      onChange={(e) => setFormData({ ...formData, videoPlaybackUrl: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cole a URL completa do YouTube. O vídeo pode ser público ou não-listado.
                  </p>
                </div>
              )}

              {/* Duração */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (segundos)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                  min="0"
                  placeholder="Ex: 1800 = 30 min"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Acesso restrito</p>
                    <p className="text-xs text-muted-foreground">
                      Ativado: apenas assinantes ou quem comprou o curso assistem
                    </p>
                  </div>
                  <Switch
                    checked={formData.isAccessRestricted === 1}
                    onCheckedChange={(v) => setFormData({ ...formData, isAccessRestricted: v ? 1 : 0 })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Publicar aula</p>
                    <p className="text-xs text-muted-foreground">
                      Aula visível no catálogo de cursos
                    </p>
                  </div>
                  <Switch
                    checked={formData.isPublished === 1}
                    onCheckedChange={(v) => setFormData({ ...formData, isPublished: v ? 1 : 0 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  uploadState.status === "uploading"
                }
              >
                {uploadState.status === "uploading" ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando vídeo...</>
                ) : editingLesson ? (
                  "Atualizar"
                ) : (
                  "Criar Aula"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

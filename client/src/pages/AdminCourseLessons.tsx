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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import Sortable from "sortablejs";
import { formatDuration } from "@/lib/formatDuration";
import {
  Plus, Edit, Trash2, ArrowLeft, Eye, EyeOff,
  PlayCircle, Upload, Youtube, Cloud, Lock, Unlock,
  CheckCircle2, AlertCircle, Loader2, RotateCw, Languages, Star,
  GripVertical, ArrowUp, ArrowDown,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
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

interface AudioTrackItem {
  uid: string;
  label: string;
  isDefault: boolean;
  status: string;
}

interface DubbingFormData {
  languageCode: string;
  label: string;
  audioUrl: string;
  makeDefault: boolean;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; fileName: string }
  | { status: "processing"; uid: string; fileName: string }
  | { status: "ready"; uid: string; fileName: string; duration: number }
  | { status: "error"; message: string };

const DUBBING_LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
];

function normalizeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes("fileSize") && message.includes("undefined")) {
    return "A página aberta está desatualizada. Recarregue com Ctrl+F5 e tente novamente.";
  }

  if (message.includes("Versão da página desatualizada")) {
    return message;
  }

  return message || "Falha no upload";
}

// ─── Helper: upload TUS para Cloudflare Stream ───────────────────────────────
// O Cloudflare Stream exige TUS para arquivos grandes (>200 MB) e recomenda
// esse protocolo quando a conexão do usuário pode oscilar, pois o upload é
// resumível e mais robusto do que um POST multipart simples.

async function tusUpload(
  file: File,
  uploadUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const tus = await import("tus-js-client");

  return new Promise(async (resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl,
      uploadSize: file.size,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        name: file.name,
        filetype: file.type || "video/mp4",
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        if (bytesTotal > 0) {
          onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        }
      },
      onError: (error) => {
        reject(new Error(error.message || "Erro de rede durante o upload"));
      },
      onSuccess: () => {
        onProgress(100);
        resolve();
      },
    });

    try {
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    } catch (error: any) {
      reject(new Error(error?.message || "Falha ao iniciar upload resumível"));
    }
  });
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminCourseLessons() {
  const params = useParams();
  const courseId = parseInt(params.id || "0");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backgroundPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Reordenação (drag & drop via Sortable.js + ↑↓) ────────────────────────
  const [localLessons, setLocalLessons] = useState<any[]>([]);
  const lessonsListRef = useRef<HTMLDivElement>(null);
  const lessonsSortableRef = useRef<Sortable | null>(null);

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
  const [dubbingForm, setDubbingForm] = useState<DubbingFormData>({
    languageCode: "en",
    label: "English",
    audioUrl: "",
    makeDefault: false,
  });

  const utils = trpc.useUtils();
  const { data: course } = trpc.courses.getById.useQuery({ id: courseId });
  const { data: lessons, isLoading } = trpc.lessons.listByCourse.useQuery({ courseId });
  const { data: cfStatus } = trpc.videos.admin.cfStatus.useQuery();
  const { data: audioTracks, isLoading: audioTracksLoading, refetch: refetchAudioTracks } =
    trpc.videos.admin.listAudioTracks.useQuery(
      { videoUid: formData.videoAssetId },
      {
        enabled:
          dialogOpen &&
          formData.videoProvider === "cloudflare" &&
          Boolean(formData.videoAssetId),
      }
    );

  const createUploadUrlMutation = trpc.videos.admin.createUploadUrl.useMutation();
  const updateLessonVideoMutation = trpc.videos.admin.updateLessonVideo.useMutation();
  const checkUploadStatusMutation = trpc.videos.admin.checkUploadStatus.useMutation();
  const addAudioTrackMutation = trpc.videos.admin.addAudioTrack.useMutation({
    onSuccess: async () => {
      toast.success("Faixa de dublagem adicionada com sucesso!");
      setDubbingForm((prev) => ({ ...prev, audioUrl: "", makeDefault: false }));
      await refetchAudioTracks();
    },
    onError: (e) => toast.error(`Erro ao adicionar dublagem: ${e.message}`),
  });
  const setDefaultAudioTrackMutation = trpc.videos.admin.setDefaultAudioTrack.useMutation({
    onSuccess: async () => {
      toast.success("Áudio padrão atualizado.");
      await refetchAudioTracks();
    },
    onError: (e) => toast.error(`Erro ao definir áudio padrão: ${e.message}`),
  });
  const deleteAudioTrackMutation = trpc.videos.admin.deleteAudioTrack.useMutation({
    onSuccess: async () => {
      toast.success("Faixa de dublagem removida.");
      await refetchAudioTracks();
    },
    onError: (e) => toast.error(`Erro ao remover dublagem: ${e.message}`),
  });

  // Sincronização SILENCIOSA automática ao abrir a página — corrige
  // vídeos "pendentes" (videoAssetId preenchido, videoPlaybackUrl vazio)
  // sem precisar de clique manual. Roda uma vez por carregamento da página.
  const autoSyncDone = useRef(false);
  const silentSyncMutation = trpc.videos.admin.syncPendingVideos.useMutation({
    onSuccess: (result) => {
      if (result.updated > 0) {
        utils.lessons.listByCourse.invalidate();
        toast.success(
          `${result.updated} vídeo(s) sincronizado(s) automaticamente!`
        );
      }
    },
  });

  useEffect(() => {
    if (!autoSyncDone.current && cfStatus?.configured) {
      autoSyncDone.current = true;
      silentSyncMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfStatus?.configured]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (backgroundPollRef.current) {
        clearInterval(backgroundPollRef.current);
      }
    };
  }, []);

  // Botão manual — mesma operação, mas com feedback explícito ao admin.
  const syncPendingMutation = trpc.videos.admin.syncPendingVideos.useMutation({
    onSuccess: (result) => {
      utils.lessons.listByCourse.invalidate();
      if (result.checked === 0) {
        toast.info("Nenhum vídeo pendente para sincronizar.");
      } else if (result.updated > 0) {
        toast.success(
          `${result.updated} vídeo(s) sincronizado(s)! ` +
          (result.stillProcessing > 0
            ? `${result.stillProcessing} ainda processando.`
            : "")
        );
      } else if (result.stillProcessing > 0) {
        toast.info(`${result.stillProcessing} vídeo(s) ainda processando no Cloudflare.`);
      } else {
        toast.info("Nenhuma atualização necessária.");
      }
    },
    onError: (e) => toast.error(`Erro ao sincronizar: ${e.message}`),
  });

  const createMutation = trpc.lessons.create.useMutation({
    onSuccess: async (result) => {
      toast.success("Aula criada com sucesso!");

      // Se o vídeo do Cloudflare ainda estava processando/pronto no momento
      // da criação (videoAssetId existe mas videoPlaybackUrl pode estar vazio
      // ou desatualizado), consulta o status novamente agora que já temos o
      // lessonId, garantindo que a URL seja persistida.
      if (formData.videoProvider === "cloudflare" && formData.videoAssetId) {
        try {
          const status = await checkUploadStatusMutation.mutateAsync({
            uid: formData.videoAssetId,
            lessonId: result.id,
          });

          if (!status.readyToStream) {
            pollUploadStatus(formData.videoAssetId, result.id, {
              keepRunningAfterClose: true,
            });
          }
        } catch (err) {
          console.error("Erro ao sincronizar status do vídeo:", err);
        }
      }

      utils.lessons.listByCourse.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`Erro ao criar aula: ${e.message}`),
  });

  const updateMutation = trpc.lessons.update.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success("Aula atualizada com sucesso!");

      // Mesma sincronização do fluxo de criação: garante que
      // videoPlaybackUrl/duration sejam persistidos mesmo que o admin
      // tenha salvo antes do polling terminar (ou fechado o modal).
      if (formData.videoProvider === "cloudflare" && formData.videoAssetId) {
        try {
          const status = await checkUploadStatusMutation.mutateAsync({
            uid: formData.videoAssetId,
            lessonId: variables.id,
          });

          if (!status.readyToStream) {
            pollUploadStatus(formData.videoAssetId, variables.id, {
              keepRunningAfterClose: true,
            });
          }
        } catch (err) {
          console.error("Erro ao sincronizar status do vídeo:", err);
        }
      }

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

  // Mantém a lista local sincronizada com o servidor (já vem ordenada por `order`)
  useEffect(() => {
    if (lessons) setLocalLessons(lessons);
  }, [lessons]);

  const reorderMutation = trpc.lessons.reorder.useMutation({
    onError: (e) => {
      toast.error(`Erro ao reordenar: ${e.message}`);
      utils.lessons.listByCourse.invalidate(); // reverte para o estado do servidor
    },
  });

  const persistLessonOrder = useCallback(
    (list: any[]) => {
      const items = list.map((l, idx) => ({ id: l.id, order: idx + 1 }));
      reorderMutation.mutate({ items });
    },
    [reorderMutation]
  );

  const moveLessonBy = (id: number, dir: -1 | 1) => {
    const idx = localLessons.findIndex((l) => l.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= localLessons.length) return;
    const next = [...localLessons];
    [next[idx], next[target]] = [next[target], next[idx]];
    setLocalLessons(next);
    persistLessonOrder(next);
  };

  // Refs para evitar closures desatualizadas dentro do callback do Sortable
  // (a instância é criada uma única vez no mount).
  const localLessonsRef = useRef(localLessons);
  const persistLessonOrderRef = useRef(persistLessonOrder);
  useEffect(() => {
    localLessonsRef.current = localLessons;
  }, [localLessons]);
  useEffect(() => {
    persistLessonOrderRef.current = persistLessonOrder;
  }, [persistLessonOrder]);

  useEffect(() => {
    if (!lessonsListRef.current) return;
    const sortable = Sortable.create(lessonsListRef.current, {
      animation: 150,
      handle: ".drag-handle",
      ghostClass: "opacity-50",
      onEnd: (evt: Sortable.SortableEvent) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        const next = [...localLessonsRef.current];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        setLocalLessons(next);
        persistLessonOrderRef.current(next);
      },
    });
    lessonsSortableRef.current = sortable;
    return () => {
      sortable.destroy();
      lessonsSortableRef.current = null;
    };
  }, []);

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
        fileSize: file.size,
        mimeType: file.type,
        isProtected: formData.isAccessRestricted === 1,
      });

      // 2. Upload direto browser → Cloudflare (sem passar pelo servidor)
      await tusUpload(file, uploadUrl, (pct) => {
        setUploadState({ status: "uploading", progress: pct, fileName: file.name });
      });

      // 3. Vídeo enviado — CF processa em background
      setUploadState({ status: "processing", uid, fileName: file.name });
      setFormData((prev) => ({
        ...prev,
        videoProvider: "cloudflare",
        videoAssetId: uid,
        videoPlaybackUrl: "", // será preenchido automaticamente quando o CF terminar
      }));

      toast.success("Vídeo enviado! Cloudflare está processando a aula...");

      // 4. Polling: a cada 5s consulta o status até ficar "ready",
      // então preenche videoPlaybackUrl/duration automaticamente
      // (no banco, se a aula já existir, e no formulário sempre).
      pollUploadStatus(uid, editingLesson?.id, { fileName: file.name });
    } catch (err: any) {
      const message = normalizeUploadError(err);
      setUploadState({ status: "error", message });
      toast.error("Erro no upload: " + message);
    }

    // Limpar input para permitir re-seleção do mesmo arquivo
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [formData.title, formData.isAccessRestricted, createUploadUrlMutation]);

  // ── Polling de status do Cloudflare Stream ────────────────────────────────
  // Consulta a cada 5s até o vídeo ficar "readyToStream". Quando pronto,
  // preenche videoPlaybackUrl/duration no formulário e, se lessonId existir
  // (edição), também salva direto no banco via checkUploadStatus.
  const pollUploadStatus = useCallback(
    (
      uid: string,
      lessonId?: number,
      options?: { keepRunningAfterClose?: boolean; fileName?: string }
    ) => {
      const fileName =
        options?.fileName ??
        (uploadState.status === "processing" ? uploadState.fileName : "vídeo");
      const targetRef = options?.keepRunningAfterClose
        ? backgroundPollRef
        : pollIntervalRef;

      if (targetRef.current) clearInterval(targetRef.current);

      const interval = setInterval(async () => {
        try {
          const result = await checkUploadStatusMutation.mutateAsync({
            uid,
            lessonId,
          });

          if (result.readyToStream) {
            clearInterval(interval);
            targetRef.current = null;
            setUploadState((prev) => {
              if (options?.keepRunningAfterClose && prev.status === "idle") {
                return prev;
              }

              return {
                status: "ready",
                uid,
                fileName,
                duration: Math.round(result.duration || 0),
              };
            });
            setFormData((prev) => ({
              ...prev,
              videoPlaybackUrl: result.playbackUrl || "",
              duration: Math.round(result.duration || 0),
            }));

            if (lessonId) {
              utils.lessons.listByCourse.invalidate();
              toast.success(
                options?.keepRunningAfterClose
                  ? "Vídeo processado e aula atualizada automaticamente!"
                  : "Vídeo processado e salvo na aula!"
              );
            } else {
              toast.success("Vídeo processado! Pronto para salvar a aula.");
            }
          }
        } catch (err) {
          // Em caso de erro de rede pontual, mantém tentando
          console.error("Erro ao consultar status do upload:", err);
        }
      }, 5000);

      targetRef.current = interval;

      // Timeout de segurança: para após 10 minutos
      setTimeout(() => {
        clearInterval(interval);
        if (targetRef.current === interval) {
          targetRef.current = null;
        }
      }, 10 * 60 * 1000);
    },
    [checkUploadStatusMutation, utils, uploadState]
  );

  // ── Dialogs ───────────────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingLesson(null);
    const nextOrder = lessons ? lessons.length + 1 : 1;
    setFormData({ ...emptyForm(), order: nextOrder });
    setDubbingForm({
      languageCode: "en",
      label: "English",
      audioUrl: "",
      makeDefault: false,
    });
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
    setDubbingForm({
      languageCode: "en",
      label: "English",
      audioUrl: "",
      makeDefault: false,
    });
    setUploadState({ status: "idle" });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingLesson(null);
    setDubbingForm({
      languageCode: "en",
      label: "English",
      audioUrl: "",
      makeDefault: false,
    });
    setUploadState({ status: "idle" });
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleLanguageChange = (value: string) => {
    const option = DUBBING_LANGUAGE_OPTIONS.find((item) => item.value === value);
    setDubbingForm((prev) => ({
      ...prev,
      languageCode: value,
      label:
        !prev.label || DUBBING_LANGUAGE_OPTIONS.some((item) => item.label === prev.label)
          ? option?.label || prev.label
          : prev.label,
    }));
  };

  const handleAddAudioTrack = () => {
    if (!formData.videoAssetId) {
      toast.error("Envie ou vincule um vídeo Cloudflare antes de adicionar dublagem.");
      return;
    }

    if (!dubbingForm.label.trim() || !dubbingForm.audioUrl.trim()) {
      toast.error("Informe o idioma e a URL pública do áudio dublado.");
      return;
    }

    addAudioTrackMutation.mutate({
      videoUid: formData.videoAssetId,
      label: dubbingForm.label.trim(),
      audioUrl: dubbingForm.audioUrl.trim(),
      makeDefault: dubbingForm.makeDefault,
      languageCode: dubbingForm.languageCode,
      lessonId: editingLesson?.id,
    });
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
              {cfStatus?.configured && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncPendingMutation.mutate()}
                  disabled={syncPendingMutation.isPending}
                  title="Verifica vídeos enviados ao Cloudflare que ainda não foram vinculados à aula e corrige automaticamente"
                >
                  {syncPendingMutation.isPending ? (
                    <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4 mr-2" />
                  )}
                  Sincronizar vídeos pendentes
                </Button>
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
        ) : localLessons && localLessons.length > 0 ? (
          <div className="space-y-3" ref={lessonsListRef}>
            {localLessons.map((lesson, index) => {
              return (
              <Card key={lesson.id} data-id={lesson.id} className="transition-all">
                <CardHeader className="py-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="drag-handle cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
                        title="Arraste para reordenar"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === 0}
                          onClick={() => moveLessonBy(lesson.id, -1)}
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === localLessons.length - 1}
                          onClick={() => moveLessonBy(lesson.id, 1)}
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
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
                          <span>
                            {lesson.videoPlaybackUrl
                              ? "Vídeo configurado"
                              : "Vídeo enviado, aguardando processamento"}
                          </span>
                          {lesson.duration ? (
                            <span>• {formatDuration(lesson.duration)}</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );})}
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <>
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

                    {/* Estado: processando (polling a cada 5s) */}
                    {uploadState.status === "processing" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cloudflare está processando {uploadState.fileName}...
                        </div>
                        <p className="text-xs text-muted-foreground">
                          UID: <code className="bg-muted px-1 rounded">{uploadState.uid}</code>
                          {" — "}isso costuma levar de 30s a poucos minutos.
                        </p>
                      </div>
                    )}

                    {/* Estado: pronto (videoPlaybackUrl já preenchido automaticamente) */}
                    {uploadState.status === "ready" && (
                      <div className="space-y-1">
                        <p className="text-sm text-green-600 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Vídeo processado — {uploadState.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          UID: <code className="bg-muted px-1 rounded">{uploadState.uid}</code>
                          {" • "}
                          Duração: {formatDuration(uploadState.duration)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          URL de reprodução preenchida automaticamente. Salve a aula para confirmar.
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

                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">Dublagem por idioma</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Adicione faixas extras de áudio para o mesmo vídeo Cloudflare. O player mostrará a troca de idioma automaticamente quando houver mais de uma faixa.
                      </p>
                    </div>

                    {!formData.videoAssetId ? (
                      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Primeiro envie ou vincule um vídeo Cloudflare para liberar o gerenciamento de dublagem.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Idioma</Label>
                            <Select value={dubbingForm.languageCode} onValueChange={handleLanguageChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione o idioma" />
                              </SelectTrigger>
                              <SelectContent>
                                {DUBBING_LANGUAGE_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="dubbing-label">Rótulo exibido no player</Label>
                            <Input
                              id="dubbing-label"
                              value={dubbingForm.label}
                              onChange={(e) => setDubbingForm((prev) => ({ ...prev, label: e.target.value }))}
                              placeholder="Ex: English"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dubbing-url">URL pública do áudio dublado</Label>
                          <Input
                            id="dubbing-url"
                            type="url"
                            value={dubbingForm.audioUrl}
                            onChange={(e) => setDubbingForm((prev) => ({ ...prev, audioUrl: e.target.value }))}
                            placeholder="https://cdn.seusite.com/audio/lesson-01-english.mp3"
                          />
                          <p className="text-xs text-muted-foreground">
                            Use um arquivo MP3, M4A ou outro áudio acessível por URL pública. O Cloudflare anexará essa faixa ao vídeo sem reenviar o vídeo principal.
                          </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Definir como idioma padrão</p>
                            <p className="text-xs text-muted-foreground">
                              Novos alunos ouvirão esta faixa por padrão, se o navegador suportar a troca.
                            </p>
                          </div>
                          <Switch
                            checked={dubbingForm.makeDefault}
                            onCheckedChange={(checked) =>
                              setDubbingForm((prev) => ({ ...prev, makeDefault: checked }))
                            }
                          />
                        </div>

                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleAddAudioTrack}
                          disabled={addAudioTrackMutation.isPending}
                        >
                          {addAudioTrackMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adicionando dublagem...</>
                          ) : (
                            <><Languages className="mr-2 h-4 w-4" />Adicionar faixa de idioma</>
                          )}
                        </Button>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Faixas cadastradas</p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => refetchAudioTracks()}
                              disabled={audioTracksLoading}
                            >
                              {audioTracksLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCw className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          {audioTracksLoading ? (
                            <div className="rounded-md border p-3 text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />Carregando faixas adicionais...
                            </div>
                          ) : audioTracks && audioTracks.length > 0 ? (
                            <div className="space-y-2">
                              {audioTracks.map((track: AudioTrackItem) => (
                                <div
                                  key={track.uid}
                                  className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{track.label}</span>
                                      {track.isDefault && (
                                        <Badge variant="default" className="text-xs">
                                          <Star className="mr-1 h-3 w-3" />Padrão
                                        </Badge>
                                      )}
                                      <Badge variant="outline" className="text-xs">
                                        {track.status}
                                      </Badge>
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">
                                      UID: <code>{track.uid}</code>
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {!track.isDefault && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setDefaultAudioTrackMutation.mutate({
                                            videoUid: formData.videoAssetId,
                                            audioUid: track.uid,
                                            lessonId: editingLesson?.id,
                                          })
                                        }
                                        disabled={setDefaultAudioTrackMutation.isPending}
                                      >
                                        <Star className="mr-2 h-3 w-3" />Tornar padrão
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        if (confirm(`Remover a faixa \"${track.label}\"?`)) {
                                          deleteAudioTrackMutation.mutate({
                                            videoUid: formData.videoAssetId,
                                            audioUid: track.uid,
                                          });
                                        }
                                      }}
                                      disabled={deleteAudioTrackMutation.isPending}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                              Nenhuma faixa adicional cadastrada ainda. A faixa original do vídeo continuará sendo usada até você adicionar uma dublagem.
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
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

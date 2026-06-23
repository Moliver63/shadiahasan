/**
 * AdminLessonMaterials — Gerenciamento de Material de Apoio + Exercícios por Aula
 * Rota: /admin/lessons/:id/materials
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Plus,
  Trash2,
  ArrowLeft,
  FileText,
  Headphones,
  Video,
  BookOpen,
  File,
  Brain,
  Upload,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type MaterialType = "pdf" | "ebook" | "audio" | "video" | "spreadsheet" | "other";

type ExerciseType =
  | "thought_restructuring"
  | "resilience"
  | "self_confidence"
  | "victory_diary"
  | "emotional_control"
  | "gratitude"
  | "future_visualization";

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  pdf: "PDF",
  ebook: "E-book",
  audio: "Áudio / Meditação",
  video: "Vídeo complementar",
  spreadsheet: "Planilha",
  other: "Outro",
};

const EXERCISE_TYPE_LABELS: Record<ExerciseType, { label: string; desc: string; emoji: string }> = {
  thought_restructuring: { label: "Reestruturação de Pensamentos", desc: "Identificar e transformar pensamentos negativos automáticos", emoji: "🧩" },
  resilience: { label: "Treino de Resiliência", desc: "Lidar com adversidades e crescer através delas", emoji: "💪" },
  self_confidence: { label: "Fortalecimento da Autoconfiança", desc: "Reconhecer competências e conquistas pessoais", emoji: "⭐" },
  victory_diary: { label: "Diário de Vitórias", desc: "Registrar conquistas diárias para mentalidade positiva", emoji: "🏆" },
  emotional_control: { label: "Controle Emocional", desc: "Consciência emocional e respostas mais equilibradas", emoji: "❤️" },
  gratitude: { label: "Treino de Gratidão", desc: "Cultivar gratidão diária para reprogramar a mente", emoji: "🙏" },
  future_visualization: { label: "Visualização do Futuro", desc: "Fortalecer motivação visualizando quem deseja se tornar", emoji: "🔭" },
};

function MaterialIcon({ type }: { type: MaterialType }) {
  const cls = "h-4 w-4 shrink-0";
  if (type === "pdf") return <FileText className={cls + " text-red-500"} />;
  if (type === "ebook") return <BookOpen className={cls + " text-blue-500"} />;
  if (type === "audio") return <Headphones className={cls + " text-purple-500"} />;
  if (type === "video") return <Video className={cls + " text-green-500"} />;
  return <File className={cls + " text-muted-foreground"} />;
}

// ─── Upload para Cloudinary ──────────────────────────────────────────────────

async function uploadToCloudinary(file: File): Promise<{ url: string; key: string; sizeBytes: number }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "thome_unsigned"); // mesmo preset do projeto
  formData.append("resource_type", "raw");

  const res = await fetch("https://api.cloudinary.com/v1_1/dzty82u60/raw/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Falha no upload para Cloudinary");

  const data = await res.json();
  return {
    url: data.secure_url,
    key: data.public_id,
    sizeBytes: data.bytes,
  };
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function AdminLessonMaterials() {
  const params = useParams();
  const lessonId = parseInt(params.id || "0");

  // Queries
  const { data: lesson } = trpc.lessons.getById.useQuery({ id: lessonId });
  const { data: materials = [], refetch: refetchMaterials } =
    trpc.materials.listByLesson.useQuery({ lessonId });
  const { data: exercises = [], refetch: refetchExercises } =
    trpc.materials.listExercisesByLesson.useQuery({ lessonId });

  // Mutations
  const addMaterialMutation = trpc.materials.addMaterial.useMutation({
    onSuccess: () => { refetchMaterials(); toast.success("Material adicionado!"); setShowMaterialDialog(false); resetMaterialForm(); },
    onError: () => toast.error("Erro ao adicionar material."),
  });
  const deleteMaterialMutation = trpc.materials.deleteMaterial.useMutation({
    onSuccess: () => { refetchMaterials(); toast.success("Material removido."); },
    onError: () => toast.error("Erro ao remover material."),
  });
  const addExerciseMutation = trpc.materials.addExercise.useMutation({
    onSuccess: () => { refetchExercises(); toast.success("Exercício adicionado!"); setShowExerciseDialog(false); },
    onError: () => toast.error("Erro ao adicionar exercício."),
  });
  const deleteExerciseMutation = trpc.materials.deleteExercise.useMutation({
    onSuccess: () => { refetchExercises(); toast.success("Exercício removido."); },
    onError: () => toast.error("Erro ao remover exercício."),
  });

  const generateWithAIMutation = trpc.materials.generateExercisesWithAI.useMutation({
    onSuccess: (data) => {
      setAiContent(data.content);
      setShowAIDialog(true);
      toast.success("Exercícios gerados pela IA!");
    },
    onError: (e) => toast.error("Erro na IA: " + e.message),
  });

  // Estado: modal material
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle");
  const [uploadedFile, setUploadedFile] = useState<{ url: string; key: string; sizeBytes: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materialForm, setMaterialForm] = useState({
    title: "",
    description: "",
    fileType: "pdf" as MaterialType,
    order: 0,
  });

  // Estado: modal exercício
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [selectedExerciseType, setSelectedExerciseType] = useState<ExerciseType>("thought_restructuring");

  // Estado: confirmação de delete
  const [confirmDelete, setConfirmDelete] = useState<{ type: "material" | "exercise"; id: number } | null>(null);

  function resetMaterialForm() {
    setMaterialForm({ title: "", description: "", fileType: "pdf", order: 0 });
    setUploadedFile(null);
    setUploadState("idle");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    try {
      const result = await uploadToCloudinary(file);
      setUploadedFile(result);
      setUploadState("done");
      // Auto-preenche o título se estiver vazio
      if (!materialForm.title) {
        setMaterialForm((f) => ({ ...f, title: file.name.replace(/\.[^/.]+$/, "") }));
      }
      toast.success("Arquivo enviado com sucesso!");
    } catch {
      setUploadState("idle");
      toast.error("Falha no upload. Tente novamente.");
    }
  }

  function handleSaveMaterial() {
    if (!uploadedFile) { toast.error("Faça o upload do arquivo primeiro."); return; }
    if (!materialForm.title.trim()) { toast.error("Informe o título do material."); return; }
    addMaterialMutation.mutate({
      lessonId,
      title: materialForm.title.trim(),
      description: materialForm.description.trim() || undefined,
      fileUrl: uploadedFile.url,
      fileKey: uploadedFile.key,
      fileType: materialForm.fileType,
      fileSizeBytes: uploadedFile.sizeBytes,
      order: materialForm.order,
    });
  }

  function handleSaveExercise() {
    // Verifica se já existe esse tipo nesta aula
    const alreadyExists = (exercises as any[]).some((ex) => ex.type === selectedExerciseType);
    if (alreadyExists) {
      toast.error("Este tipo de exercício já foi adicionado a esta aula.");
      return;
    }
    addExerciseMutation.mutate({
      lessonId,
      type: selectedExerciseType,
      order: (exercises as any[]).length,
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href={`/admin/lessons`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Material de Apoio & Exercícios</h1>
            {lesson && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Aula: <span className="font-medium text-foreground">{lesson.title}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── Seção: Material de Apoio ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              📚 Material de Apoio
            </CardTitle>
            <Button size="sm" onClick={() => setShowMaterialDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar material
            </Button>
          </CardHeader>
          <CardContent>
            {materials.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum material adicionado ainda.</p>
                <p className="text-xs mt-1">Adicione PDFs, e-books, áudios ou planos de ação.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(materials as any[]).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors"
                  >
                    <MaterialIcon type={m.fileType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {MATERIAL_TYPE_LABELS[m.fileType as MaterialType]}
                    </Badge>
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline shrink-0"
                    >
                      Ver
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => setConfirmDelete({ type: "material", id: m.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Seção: Exercícios Mentais ── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              🧠 Exercícios de Fortalecimento Mental
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline"
                onClick={() => generateWithAIMutation.mutate({
                  lessonId,
                  lessonTitle: lesson?.title ?? "",
                  lessonDescription: lesson?.description ?? "",
                  courseTitle: "",
                })}
                disabled={generateWithAIMutation.isPending}
                className="border-yellow-400/60 hover:bg-yellow-50 dark:hover:bg-yellow-950/20">
                {generateWithAIMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</>
                  : <><Sparkles className="h-4 w-4 mr-2 text-yellow-500" />Gerar com IA</>}
              </Button>
              <Button size="sm" onClick={() => setShowExerciseDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar exercício
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {exercises.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum exercício adicionado ainda.</p>
                <p className="text-xs mt-1">Adicione exercícios baseados em Neurociência e TCC.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(exercises as any[]).map((ex) => {
                  const info = EXERCISE_TYPE_LABELS[ex.type as ExerciseType];
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors"
                    >
                      <span className="text-xl shrink-0">{info?.emoji ?? "🧠"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{ex.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{info?.desc}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={() => setConfirmDelete({ type: "exercise", id: ex.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: Adicionar Material ── */}
      <Dialog open={showMaterialDialog} onOpenChange={(o) => { if (!o) { setShowMaterialDialog(false); resetMaterialForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Material de Apoio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Upload */}
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.epub,.mp3,.mp4,.xlsx,.xls,.csv,.docx,.pptx"
                onChange={handleFileSelect}
              />
              {uploadState === "idle" && (
                <Button
                  variant="outline"
                  className="w-full h-20 border-dashed flex flex-col gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para fazer upload</span>
                  <span className="text-xs text-muted-foreground">PDF, e-book, áudio, planilha...</span>
                </Button>
              )}
              {uploadState === "uploading" && (
                <div className="flex items-center gap-2 h-20 border rounded-lg justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Enviando arquivo...</span>
                </div>
              )}
              {uploadState === "done" && uploadedFile && (
                <div className="flex items-center gap-2 h-20 border rounded-lg justify-center bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">Arquivo enviado com sucesso!</span>
                  <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs">
                    Trocar
                  </Button>
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo de material</Label>
              <Select
                value={materialForm.fileType}
                onValueChange={(v) => setMaterialForm((f) => ({ ...f, fileType: v as MaterialType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={materialForm.title}
                onChange={(e) => setMaterialForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Plano de Ação Semana 1"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={materialForm.description}
                onChange={(e) => setMaterialForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrição do conteúdo..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Ordem */}
            <div className="space-y-2">
              <Label>Ordem de exibição</Label>
              <Input
                type="number"
                min={0}
                value={materialForm.order}
                onChange={(e) => setMaterialForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMaterialDialog(false); resetMaterialForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveMaterial}
              disabled={addMaterialMutation.isPending || uploadState === "uploading"}
            >
              {addMaterialMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar Exercício ── */}
      <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Exercício Mental</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o tipo de exercício para adicionar a esta aula. Os campos e perguntas são gerados automaticamente.
            </p>
            <div className="space-y-2">
              {Object.entries(EXERCISE_TYPE_LABELS).map(([type, info]) => {
                const alreadyAdded = (exercises as any[]).some((ex) => ex.type === type);
                return (
                  <button
                    key={type}
                    onClick={() => !alreadyAdded && setSelectedExerciseType(type as ExerciseType)}
                    disabled={alreadyAdded}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                      alreadyAdded
                        ? "opacity-40 cursor-not-allowed bg-muted"
                        : selectedExerciseType === type
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent/30"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{info.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground">{info.desc}</p>
                    </div>
                    {alreadyAdded && (
                      <Badge variant="secondary" className="text-xs shrink-0">Adicionado</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExerciseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveExercise} disabled={addExerciseMutation.isPending}>
              {addExerciseMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adicionando...</>
              ) : "Adicionar exercício"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Resultado IA ── */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Exercícios Gerados pela IA
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-muted-foreground mb-3">
              Copie o conteúdo abaixo e use como referência para criar PDFs ou adicionar exercícios manualmente.
            </p>
            <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans bg-muted rounded-lg p-4 overflow-x-auto">
              {aiContent}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (aiContent) navigator.clipboard.writeText(aiContent);
              toast.success("Copiado!");
            }}>
              Copiar texto
            </Button>
            <Button onClick={() => setShowAIDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão ── */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {confirmDelete?.type === "material"
              ? "Tem certeza que deseja remover este material? Esta ação não pode ser desfeita."
              : "Tem certeza que deseja remover este exercício e todas as respostas dos alunos? Esta ação não pode ser desfeita."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.type === "material") {
                  deleteMaterialMutation.mutate({ materialId: confirmDelete.id });
                } else {
                  deleteExerciseMutation.mutate({ exerciseId: confirmDelete.id });
                }
                setConfirmDelete(null);
              }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

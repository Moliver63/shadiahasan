/**
 * LessonMaterials — Material de Apoio + Exercícios + IA Mentora (Gemini)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Download, CheckCircle2, Circle, ChevronDown, ChevronUp,
  FileText, Headphones, Video, File, Brain, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

type MaterialType = "pdf" | "ebook" | "audio" | "video" | "spreadsheet" | "other";
type ExerciseField = { key: string; label: string; type: "textarea" | "select" | "number"; options?: string[] };
type ExerciseDefinition = { title: string; description: string; fields: readonly ExerciseField[] };
type Exercise = { id: number; type: string; title: string; description: string | null; definition: ExerciseDefinition | null };
type Material = { id: number; title: string; description: string | null; fileUrl: string; fileType: MaterialType; fileSizeBytes: number | null };

function MaterialIcon({ type }: { type: MaterialType }) {
  const cls = "h-5 w-5 shrink-0";
  if (type === "pdf") return <FileText className={cls + " text-red-500"} />;
  if (type === "ebook") return <BookOpen className={cls + " text-blue-500"} />;
  if (type === "audio") return <Headphones className={cls + " text-purple-500"} />;
  if (type === "video") return <Video className={cls + " text-green-500"} />;
  return <File className={cls + " text-muted-foreground"} />;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Card de material ────────────────────────────────────────────────────────

function MaterialCard({ material, isCompleted, onMarkComplete }: {
  material: Material; isCompleted: boolean; onMarkComplete: (id: number) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <MaterialIcon type={material.fileType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{material.title}</p>
        {material.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{material.description}</p>}
        {material.fileSizeBytes && <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(material.fileSizeBytes)}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href={material.fileUrl} target="_blank" rel="noopener noreferrer" download>
          <Button size="sm" variant="outline" className="h-8 px-2"><Download className="h-4 w-4" /></Button>
        </a>
        <Button size="sm" variant={isCompleted ? "default" : "outline"} className="h-8 px-2"
          onClick={() => onMarkComplete(material.id)}>
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Card de exercício + IA Mentora ──────────────────────────────────────────

function ExerciseCard({ exercise, lessonId, lessonTitle }: { exercise: Exercise; lessonId: number; lessonTitle: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data: savedResponse, isLoading: loadingResponse } = trpc.materials.getResponse.useQuery(
    { exerciseId: exercise.id },
    { enabled: isOpen }
  );

  const { data: lastAnalysis } = trpc.materials.getLastAnalysis.useQuery(
    { exerciseId: exercise.id },
    { enabled: isOpen }
  );

  // Preenche formulário com respostas salvas quando chegam
  const [hydrated, setHydrated] = useState(false);
  if (savedResponse?.responses && !hydrated && Object.keys(values).length === 0) {
    setHydrated(true);
    setValues(savedResponse.responses);
  }

  const saveResponseMutation = trpc.materials.saveResponse.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("Exercício salvo!");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const analyzeMutation = trpc.materials.analyzeResponseWithAI.useMutation({
    onSuccess: () => {
      setShowAnalysis(true);
      toast.success("IA Mentora analisou suas respostas!");
    },
    onError: (e) => toast.error("Erro na análise: " + e.message),
  });

  const def = exercise.definition;
  if (!def) return null;

  const hasResponses = Object.values(values).some((v) => v?.trim());
  const isComplete = !!savedResponse;

  function handleSave() {
    saveResponseMutation.mutate({ exerciseId: exercise.id, lessonId, responses: values });
  }

  function handleAnalyze() {
    if (!hasResponses) { toast.error("Responda o exercício antes de analisar."); return; }
    analyzeMutation.mutate({
      exerciseId: exercise.id,
      lessonId,
      exerciseTitle: exercise.title,
      exerciseType: exercise.type,
      lessonTitle,
      responses: values,
    });
  }

  const currentAnalysis = analyzeMutation.data?.analysis ?? lastAnalysis?.analysis;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <button className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setIsOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">{exercise.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{exercise.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {currentAnalysis && <Sparkles className="h-4 w-4 text-yellow-500" />}
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          {loadingResponse ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Carregando...
            </div>
          ) : (
            <>
              {/* Campos do exercício */}
              {def.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label}</label>
                  {field.type === "textarea" && (
                    <Textarea value={values[field.key] ?? ""} rows={3} className="text-sm resize-none"
                      placeholder="Escreva aqui..."
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} />
                  )}
                  {field.type === "select" && field.options && (
                    <div className="flex flex-wrap gap-2">
                      {field.options.map((opt) => (
                        <button key={opt} onClick={() => setValues((v) => ({ ...v, [field.key]: opt }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            values[field.key] === opt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {field.type === "number" && (
                    <div className="flex items-center gap-2">
                      <input type="range" min={1} max={10} className="flex-1 accent-primary"
                        value={values[field.key] ?? "5"}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))} />
                      <span className="text-sm font-semibold w-8 text-center">{values[field.key] ?? "5"}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Botões ação */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleSave} disabled={saveResponseMutation.isPending} className="flex-1">
                  {saveResponseMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                    : saved ? <><CheckCircle2 className="h-4 w-4 mr-2" />Salvo!</> : "Salvar"}
                </Button>
                <Button variant="outline" onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending || !hasResponses}
                  className="flex-1 border-yellow-400/50 hover:bg-yellow-50 dark:hover:bg-yellow-950/20">
                  {analyzeMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analisando...</>
                    : <><Sparkles className="h-4 w-4 mr-2 text-yellow-500" />IA Mentora</>}
                </Button>
              </div>

              {/* Análise da IA */}
              {currentAnalysis && (
                <div className="mt-2">
                  <button className="flex items-center gap-2 text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2"
                    onClick={() => setShowAnalysis((s) => !s)}>
                    <Sparkles className="h-3.5 w-3.5" />
                    {showAnalysis ? "Ocultar análise da IA Mentora" : "Ver análise da IA Mentora"}
                    {showAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showAnalysis && (
                    <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans text-foreground">
                          {currentAnalysis}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function LessonMaterials({ lessonId, lessonTitle }: { lessonId: number; lessonTitle?: string }) {
  const { data: materials = [], isLoading: loadingMaterials } = trpc.materials.listByLesson.useQuery({ lessonId });
  const { data: exercises = [], isLoading: loadingExercises } = trpc.materials.listExercisesByLesson.useQuery({ lessonId });
  const { data: completedMaterials = [], refetch: refetchCompleted } = trpc.materials.getCompletedMaterials.useQuery({ lessonId });

  const markCompleteMutation = trpc.materials.markMaterialComplete.useMutation({
    onSuccess: () => { void refetchCompleted(); toast.success("Material marcado como concluído!"); },
  });

  if (!materials.length && !exercises.length && !loadingMaterials && !loadingExercises) return null;

  return (
    <div className="space-y-6">
      {/* Material de Apoio */}
      {(materials.length > 0 || loadingMaterials) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">📚 Material de Apoio</h3>
            </div>
            <p className="text-sm text-muted-foreground">Materiais complementares para aprofundar seu aprendizado.</p>
            {loadingMaterials ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Carregando...
              </div>
            ) : (
              <div className="space-y-2">
                {(materials as Material[]).map((m) => (
                  <MaterialCard key={m.id} material={m}
                    isCompleted={completedMaterials.includes(m.id)}
                    onMarkComplete={(id) => markCompleteMutation.mutate({ materialId: id })} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Exercícios + IA Mentora */}
      {(exercises.length > 0 || loadingExercises) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">🧠 Exercícios de Fortalecimento Mental</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                IA Mentora disponível
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Responda os exercícios e receba análise personalizada da IA Mentora baseada em Neurociência e TCC.
            </p>
            {loadingExercises ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Carregando...
              </div>
            ) : (
              <div className="space-y-3">
                {(exercises as Exercise[]).map((ex) => (
                  <ExerciseCard key={ex.id} exercise={ex} lessonId={lessonId} lessonTitle={lessonTitle ?? ""} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

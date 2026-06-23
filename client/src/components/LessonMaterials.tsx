/**
 * LessonMaterials — Material de Apoio + Exercícios de Fortalecimento Mental
 * Renderizado ao final do LessonView, após o vídeo.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Download,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  FileText,
  Headphones,
  Video,
  File,
  Brain,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type MaterialType = "pdf" | "ebook" | "audio" | "video" | "spreadsheet" | "other";

type Material = {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: MaterialType;
  fileSizeBytes: number | null;
};

type ExerciseField = {
  key: string;
  label: string;
  type: "textarea" | "select" | "number";
  options?: string[];
};

type ExerciseDefinition = {
  title: string;
  description: string;
  fields: readonly ExerciseField[];
};

type Exercise = {
  id: number;
  type: string;
  title: string;
  description: string | null;
  definition: ExerciseDefinition | null;
};

// ─── Ícone por tipo de arquivo ───────────────────────────────────────────────

function MaterialIcon({ type }: { type: MaterialType }) {
  const cls = "h-5 w-5 shrink-0";
  if (type === "pdf") return <FileText className={cls + " text-red-500"} />;
  if (type === "ebook") return <BookOpen className={cls + " text-blue-500"} />;
  if (type === "audio") return <Headphones className={cls + " text-purple-500"} />;
  if (type === "video") return <Video className={cls + " text-green-500"} />;
  return <File className={cls + " text-muted-foreground"} />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Card de material individual ────────────────────────────────────────────

function MaterialCard({
  material,
  isCompleted,
  onMarkComplete,
}: {
  material: Material;
  isCompleted: boolean;
  onMarkComplete: (id: number) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <MaterialIcon type={material.fileType} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{material.title}</p>
        {material.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{material.description}</p>
        )}
        {material.fileSizeBytes && (
          <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(material.fileSizeBytes)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={material.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          <Button size="sm" variant="outline" className="h-8 px-2">
            <Download className="h-4 w-4" />
          </Button>
        </a>
        <Button
          size="sm"
          variant={isCompleted ? "default" : "outline"}
          className="h-8 px-2"
          onClick={() => onMarkComplete(material.id)}
          title={isCompleted ? "Concluído" : "Marcar como concluído"}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Card de exercício com formulário ───────────────────────────────────────

function ExerciseCard({ exercise, lessonId }: { exercise: Exercise; lessonId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data: savedResponse, isLoading: loadingResponse } = trpc.materials.getResponse.useQuery(
    { exerciseId: exercise.id },
    { enabled: isOpen }
  );

  // Preenche o formulário quando a resposta salva chegar do backend
  const [initializedRef] = useState(() => ({ done: false }));
  if (savedResponse?.responses && !initializedRef.done && Object.keys(values).length === 0) {
    initializedRef.done = true;
    setValues(savedResponse.responses);
  }

  const saveResponseMutation = trpc.materials.saveResponse.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("Exercício salvo com sucesso!");
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error("Erro ao salvar. Tente novamente."),
  });

  const def = exercise.definition;
  if (!def) return null;

  const handleSave = () => {
    saveResponseMutation.mutate({
      exerciseId: exercise.id,
      lessonId,
      responses: values,
    });
  };

  const isComplete = savedResponse !== null && savedResponse !== undefined;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors text-left"
        onClick={() => setIsOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">{exercise.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{exercise.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {isComplete && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Formulário */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4">
          {loadingResponse ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando respostas...
            </div>
          ) : (
            <>
              {def.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">{field.label}</label>
                  {field.type === "textarea" && (
                    <Textarea
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.key]: e.target.value }))
                      }
                      placeholder="Escreva aqui..."
                      rows={3}
                      className="text-sm resize-none"
                    />
                  )}
                  {field.type === "select" && field.options && (
                    <div className="flex flex-wrap gap-2">
                      {field.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setValues((v) => ({ ...v, [field.key]: opt }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            values[field.key] === opt
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {field.type === "number" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={values[field.key] ?? "5"}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [field.key]: e.target.value }))
                        }
                        className="flex-1 accent-primary"
                      />
                      <span className="text-sm font-semibold w-8 text-center">
                        {values[field.key] ?? "5"}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              <Button
                onClick={handleSave}
                disabled={saveResponseMutation.isPending}
                className="w-full"
              >
                {saveResponseMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                ) : saved ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" />Salvo!</>
                ) : (
                  "Salvar exercício"
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function LessonMaterials({ lessonId }: { lessonId: number }) {
  const { data: materials = [], isLoading: loadingMaterials } =
    trpc.materials.listByLesson.useQuery({ lessonId });

  const { data: exercises = [], isLoading: loadingExercises } =
    trpc.materials.listExercisesByLesson.useQuery({ lessonId });

  const { data: completedMaterials = [], refetch: refetchCompleted } =
    trpc.materials.getCompletedMaterials.useQuery({ lessonId });

  const markCompleteMutation = trpc.materials.markMaterialComplete.useMutation({
    onSuccess: () => {
      void refetchCompleted();
      toast.success("Material marcado como concluído!");
    },
  });

  const hasMaterials = materials.length > 0;
  const hasExercises = exercises.length > 0;

  if (!hasMaterials && !hasExercises && !loadingMaterials && !loadingExercises) {
    return null; // Não renderiza nada se não há conteúdo
  }

  return (
    <div className="space-y-6">
      {/* ── Material de Apoio ── */}
      {(hasMaterials || loadingMaterials) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">📚 Material de Apoio</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Materiais complementares selecionados para aprofundar seu aprendizado desta aula.
            </p>

            {loadingMaterials ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando materiais...
              </div>
            ) : (
              <div className="space-y-2">
                {materials.map((material) => (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    isCompleted={completedMaterials.includes(material.id)}
                    onMarkComplete={(id) => markCompleteMutation.mutate({ materialId: id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Exercícios de Fortalecimento Mental ── */}
      {(hasExercises || loadingExercises) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">🧠 Exercícios de Fortalecimento Mental</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Pratique os conceitos da aula com exercícios baseados em Neurociência, Psicologia
              Positiva e Terapia Cognitivo-Comportamental.
            </p>

            {loadingExercises ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando exercícios...
              </div>
            ) : (
              <div className="space-y-3">
                {exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise as Exercise}
                    lessonId={lessonId}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

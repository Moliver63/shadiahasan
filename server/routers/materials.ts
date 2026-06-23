/**
 * Router: materials & exercises + Gemini AI
 * Material de Apoio + Exercícios de Fortalecimento Mental + IA Mentora
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  lessonMaterials,
  lessonExercises,
  exerciseResponses,
  userMaterialProgress,
  aiAnalyses,
} from "../../drizzle/schema";
import { eq, and, asc, desc } from "drizzle-orm";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Gemini ─────────────────────────────────────────────────────────────────

const GEMINI_URL_KEY = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
const GEMINI_URL_OAUTH = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GEMINI_API_KEY não configurada." });

  // Detecta tipo de chave: AQ. = OAuth2 Bearer, AIza = API Key
  const isOAuth = apiKey.startsWith("AQ.");

  const url = isOAuth ? GEMINI_URL_OAUTH : GEMINI_URL_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  
  const fetchUrl = isOAuth ? url : `${url}?key=${apiKey}`;
  if (isOAuth) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(fetchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.75, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Gemini error: ${await res.text()}` });

  const data = await res.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sem resposta da IA.";
}

// ─── Definições dos exercícios ───────────────────────────────────────────────

export const EXERCISE_DEFINITIONS = {
  thought_restructuring: {
    title: "Reestruturação de Pensamentos",
    description: "Treine sua mente para identificar e transformar pensamentos negativos automáticos.",
    fields: [
      { key: "what_happened", label: "O que aconteceu?", type: "textarea" },
      { key: "what_i_thought", label: "O que pensei?", type: "textarea" },
      { key: "fact_or_opinion", label: "Essa interpretação é um fato ou uma opinião?", type: "select", options: ["Fato", "Opinião", "Misto"] },
      { key: "another_perspective", label: "Existe outra forma de enxergar essa situação?", type: "textarea" },
      { key: "balanced_thought", label: "Qual pensamento mais equilibrado posso adotar?", type: "textarea" },
    ],
  },
  resilience: {
    title: "Treino de Resiliência",
    description: "Aumente sua capacidade de lidar com adversidades e crescer através delas.",
    fields: [
      { key: "challenge", label: "Qual desafio enfrentei recentemente?", type: "textarea" },
      { key: "learning", label: "O que aprendi com ele?", type: "textarea" },
      { key: "stronger", label: "Como isso me tornou mais forte?", type: "textarea" },
      { key: "next_time", label: "O que farei diferente na próxima vez?", type: "textarea" },
    ],
  },
  self_confidence: {
    title: "Fortalecimento da Autoconfiança",
    description: "Treine seu cérebro para reconhecer suas competências e conquistas.",
    fields: [
      { key: "qualities", label: "10 qualidades pessoais (uma por linha)", type: "textarea" },
      { key: "achievements", label: "10 conquistas da sua vida (uma por linha)", type: "textarea" },
      { key: "challenges_overcome", label: "10 desafios que você superou (um por linha)", type: "textarea" },
      { key: "reasons_to_trust", label: "10 motivos para confiar em si mesmo (um por linha)", type: "textarea" },
    ],
  },
  victory_diary: {
    title: "Diário de Vitórias",
    description: "Registre suas conquistas diárias para fortalecer sua mentalidade positiva.",
    fields: [
      { key: "victories", label: "3 pequenas vitórias de hoje (uma por linha)", type: "textarea" },
      { key: "learning", label: "1 aprendizado de hoje", type: "textarea" },
      { key: "courage", label: "1 ação de coragem que tomei", type: "textarea" },
      { key: "positive_attitude", label: "1 atitude positiva que demonstrei", type: "textarea" },
    ],
  },
  emotional_control: {
    title: "Controle Emocional",
    description: "Desenvolva consciência emocional e aprenda a responder, não reagir.",
    fields: [
      { key: "what_i_felt", label: "O que senti?", type: "textarea" },
      { key: "intensity", label: "Qual foi a intensidade da emoção? (1-10)", type: "number" },
      { key: "how_i_reacted", label: "Como reagi?", type: "textarea" },
      { key: "helped_or_hurt", label: "Minha reação me ajudou ou me prejudicou?", type: "select", options: ["Me ajudou", "Me prejudicou", "Neutro"] },
      { key: "better_response", label: "Como posso reagir melhor no futuro?", type: "textarea" },
    ],
  },
  gratitude: {
    title: "Treino de Gratidão",
    description: "Cultive gratidão diária para reprogramar sua mente para o positivo.",
    fields: [
      { key: "grateful_for", label: "3 coisas pelas quais sou grato hoje (uma por linha)", type: "textarea" },
      { key: "important_people", label: "3 pessoas importantes na minha vida (uma por linha)", type: "textarea" },
      { key: "positive_experience", label: "1 experiência positiva de hoje", type: "textarea" },
    ],
  },
  future_visualization: {
    title: "Visualização do Futuro",
    description: "Fortaleça sua motivação e direcionamento visualizando quem você quer se tornar.",
    fields: [
      { key: "in_one_year", label: "Como quero estar daqui a 1 ano?", type: "textarea" },
      { key: "my_routine", label: "Como será minha rotina?", type: "textarea" },
      { key: "how_i_will_feel", label: "Como quero me sentir?", type: "textarea" },
      { key: "habits", label: "Quais hábitos terei desenvolvido?", type: "textarea" },
    ],
  },
} as const;

export type ExerciseType = keyof typeof EXERCISE_DEFINITIONS;

// ─── Router ─────────────────────────────────────────────────────────────────

export const materialsRouter = router({

  // ── MATERIAIS ──────────────────────────────────────────────────────────────

  listByLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(lessonMaterials)
        .where(and(eq(lessonMaterials.lessonId, input.lessonId), eq(lessonMaterials.isPublished, 1)))
        .orderBy(asc(lessonMaterials.order));
    }),

  addMaterial: adminProcedure
    .input(z.object({
      lessonId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      fileUrl: z.string().url(),
      fileKey: z.string(),
      fileType: z.enum(["pdf", "ebook", "audio", "video", "spreadsheet", "other"]).default("pdf"),
      fileSizeBytes: z.number().optional(),
      order: z.number().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [material] = await db.insert(lessonMaterials).values({
        lessonId: input.lessonId, title: input.title, description: input.description,
        fileUrl: input.fileUrl, fileKey: input.fileKey, fileType: input.fileType,
        fileSizeBytes: input.fileSizeBytes, order: input.order, uploadedBy: ctx.user.id,
      }).returning();
      return material;
    }),

  deleteMaterial: adminProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(lessonMaterials).where(eq(lessonMaterials.id, input.materialId));
      return { success: true };
    }),

  markMaterialComplete: protectedProcedure
    .input(z.object({ materialId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.select().from(userMaterialProgress)
        .where(and(eq(userMaterialProgress.userId, ctx.user.id), eq(userMaterialProgress.materialId, input.materialId))).limit(1);
      if (existing.length === 0) {
        await db.insert(userMaterialProgress).values({ userId: ctx.user.id, materialId: input.materialId });
      }
      return { success: true };
    }),

  getCompletedMaterials: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const materials = await db.select({ id: lessonMaterials.id }).from(lessonMaterials)
        .where(eq(lessonMaterials.lessonId, input.lessonId));
      if (materials.length === 0) return [];
      const materialIds = materials.map((m) => m.id);
      const completed = await db.select().from(userMaterialProgress)
        .where(eq(userMaterialProgress.userId, ctx.user.id));
      return completed.filter((c) => materialIds.includes(c.materialId)).map((c) => c.materialId);
    }),

  // ── EXERCÍCIOS ─────────────────────────────────────────────────────────────

  listExercisesByLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const exercises = await db.select().from(lessonExercises)
        .where(and(eq(lessonExercises.lessonId, input.lessonId), eq(lessonExercises.isPublished, 1)))
        .orderBy(asc(lessonExercises.order));
      return exercises.map((ex) => ({
        ...ex,
        definition: EXERCISE_DEFINITIONS[ex.type as ExerciseType] ?? null,
      }));
    }),

  addExercise: adminProcedure
    .input(z.object({
      lessonId: z.number(),
      type: z.enum(["thought_restructuring", "resilience", "self_confidence", "victory_diary", "emotional_control", "gratitude", "future_visualization"]),
      order: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const def = EXERCISE_DEFINITIONS[input.type];
      const [exercise] = await db.insert(lessonExercises)
        .values({ lessonId: input.lessonId, type: input.type, title: def.title, description: def.description, order: input.order })
        .returning();
      return exercise;
    }),

  deleteExercise: adminProcedure
    .input(z.object({ exerciseId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(lessonExercises).where(eq(lessonExercises.id, input.exerciseId));
      return { success: true };
    }),

  saveResponse: protectedProcedure
    .input(z.object({ exerciseId: z.number(), lessonId: z.number(), responses: z.record(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.select().from(exerciseResponses)
        .where(and(eq(exerciseResponses.userId, ctx.user.id), eq(exerciseResponses.exerciseId, input.exerciseId))).limit(1);
      if (existing.length > 0) {
        await db.update(exerciseResponses)
          .set({ responses: JSON.stringify(input.responses), updatedAt: new Date() })
          .where(eq(exerciseResponses.id, existing[0].id));
      } else {
        await db.insert(exerciseResponses).values({
          userId: ctx.user.id, exerciseId: input.exerciseId,
          lessonId: input.lessonId, responses: JSON.stringify(input.responses),
        });
      }
      return { success: true };
    }),

  getResponse: protectedProcedure
    .input(z.object({ exerciseId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [response] = await db.select().from(exerciseResponses)
        .where(and(eq(exerciseResponses.userId, ctx.user.id), eq(exerciseResponses.exerciseId, input.exerciseId))).limit(1);
      if (!response) return null;
      return { ...response, responses: JSON.parse(response.responses) as Record<string, string> };
    }),

  getExerciseDefinitions: protectedProcedure.query(() => EXERCISE_DEFINITIONS),

  // ── GEMINI: Gerar exercícios automaticamente por aula (admin) ──────────────

  generateExercisesWithAI: adminProcedure
    .input(z.object({
      lessonId: z.number(),
      lessonTitle: z.string(),
      lessonDescription: z.string().optional(),
      courseTitle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const prompt = `${buildSystemPrompt()}

## MISSÃO
Analise o conteúdo desta aula e gere exercícios práticos de fortalecimento mental altamente específicos para ela.

## CONTEÚDO DA AULA
- **Curso:** ${input.courseTitle ?? "Não informado"}
- **Aula:** ${input.lessonTitle}
- **Descrição:** ${input.lessonDescription ?? "Não informada"}

## O QUE ENTREGAR
Crie exatamente 3 exercícios práticos personalizados para esta aula. Para cada exercício:

### Exercício [N]: [Nome]
🎯 **Objetivo Neurocientífico:** [qual área cognitiva está sendo treinada]
🔬 **Fundamentação Científica:** [princípio da neurociência que sustenta]
📋 **Passo a Passo:** [exatamente como executar, em etapas numeradas]
⏱️ **Tempo Necessário:** [duração diária]
📊 **Nível:** Iniciante / Intermediário / Avançado
✅ **Benefícios Esperados:** [resultados após prática consistente]
💬 **Perguntas de Reflexão:** [3 perguntas para aprofundar autoconsciência]
📈 **Indicador de Evolução:** [como medir o progresso]

Ao final, inclua:
### 🗓️ Desafio de 7 dias
[uma prática diária simples relacionada ao conteúdo da aula]

### 🔥 Desafio de 21 dias
[prática progressiva para consolidar o aprendizado]

Seja específico ao conteúdo desta aula. Evite respostas genéricas.`;

      return { content: await callGemini(prompt) };
    }),

  // ── GEMINI: IA Mentora — análise de respostas do aluno ───────────────────

  analyzeResponseWithAI: protectedProcedure
    .input(z.object({
      exerciseId: z.number(),
      lessonId: z.number(),
      exerciseTitle: z.string(),
      exerciseType: z.string(),
      lessonTitle: z.string(),
      responses: z.record(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Monta as respostas em formato legível
      const responsesText = Object.entries(input.responses)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`)
        .join("\n");

      const prompt = `${buildSystemPrompt()}

## MISSÃO
Atue como IA Mentora pessoal. Analise profundamente as respostas do aluno para este exercício e ofereça feedback personalizado e transformador.

## CONTEXTO
- **Aula:** ${input.lessonTitle}
- **Exercício:** ${input.exerciseTitle} (tipo: ${input.exerciseType})

## RESPOSTAS DO ALUNO
${responsesText}

## O QUE ENTREGAR

### 🧠 Análise de Padrões Mentais
[identifique padrões emocionais, crenças limitantes e pontos de força nas respostas]

### 💡 Insights Personalizados
[3 insights específicos baseados no que o aluno escreveu — não seja genérico]

### ⚠️ Pontos de Atenção
[comportamentos ou pensamentos que merecem atenção especial]

### 🚀 Próximos Passos
[3 ações práticas e específicas que o aluno pode tomar nos próximos 7 dias]

### 💬 Pergunta Poderosa
[uma pergunta profunda para o aluno refletir nas próximas horas]

### 📊 Avaliação
- **Nível de Autoconsciência:** [1-10 com justificativa]
- **Potencial de Crescimento Identificado:** [descreva brevemente]

Seja direto, empático e específico. Use as respostas do aluno como base — não invente informações.`;

      const analysis = await callGemini(prompt);

      // Salva análise no banco
      await db.insert(aiAnalyses).values({
        userId: ctx.user.id,
        exerciseId: input.exerciseId,
        lessonId: input.lessonId,
        analysis,
      });

      return { analysis };
    }),

  // Busca última análise salva de um exercício
  getLastAnalysis: protectedProcedure
    .input(z.object({ exerciseId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [analysis] = await db.select().from(aiAnalyses)
        .where(and(eq(aiAnalyses.userId, ctx.user.id), eq(aiAnalyses.exerciseId, input.exerciseId)))
        .orderBy(desc(aiAnalyses.createdAt))
        .limit(1);
      return analysis ?? null;
    }),
});

function buildSystemPrompt(): string {
  return `Você é um especialista multidisciplinar em Neurociência, Psicologia Cognitiva, Psicologia Positiva, Treinamento Mental de Alta Performance e Desenvolvimento Humano.

Suas respostas são baseadas em:
- Neuroplasticidade e ciência comportamental validada
- Técnicas de atletas de elite, executivos e forças especiais
- Terapia Cognitivo-Comportamental (TCC)
- Psicologia Positiva e Hábitos Atômicos
- Aprendizagem Acelerada e repetição espaçada

REGRAS ABSOLUTAS:
- Seja altamente prático e específico ao contexto fornecido
- Evite conteúdo genérico e motivacional vazio
- Baseie recomendações em evidências científicas reais
- Escreva em português do Brasil, tom profissional mas acessível
- Use formatação clara com emojis para facilitar leitura`;
}

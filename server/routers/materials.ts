/**
 * Router: materials & exercises
 * Material de Apoio + Exercícios de Fortalecimento Mental
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
} from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Definições dos exercícios por tipo ─────────────────────────────────────
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db
        .select()
        .from(lessonMaterials)
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
      const [material] = await db
        .insert(lessonMaterials)
        .values({
          lessonId: input.lessonId,
          title: input.title,
          description: input.description,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          fileType: input.fileType,
          fileSizeBytes: input.fileSizeBytes,
          order: input.order,
          uploadedBy: ctx.user.id,
        })
        .returning();
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
      const existing = await db
        .select()
        .from(userMaterialProgress)
        .where(and(eq(userMaterialProgress.userId, ctx.user.id), eq(userMaterialProgress.materialId, input.materialId)))
        .limit(1);
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
      const materials = await db
        .select({ id: lessonMaterials.id })
        .from(lessonMaterials)
        .where(eq(lessonMaterials.lessonId, input.lessonId));
      if (materials.length === 0) return [];
      const completed = await db
        .select()
        .from(userMaterialProgress)
        .where(eq(userMaterialProgress.userId, ctx.user.id));
      const materialIds = materials.map((m) => m.id);
      return completed.filter((c) => materialIds.includes(c.materialId)).map((c) => c.materialId);
    }),

  // ── EXERCÍCIOS ─────────────────────────────────────────────────────────────

  listExercisesByLesson: protectedProcedure
    .input(z.object({ lessonId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const exercises = await db
        .select()
        .from(lessonExercises)
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
      const [exercise] = await db
        .insert(lessonExercises)
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
    .input(z.object({
      exerciseId: z.number(),
      lessonId: z.number(),
      responses: z.record(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db
        .select()
        .from(exerciseResponses)
        .where(and(eq(exerciseResponses.userId, ctx.user.id), eq(exerciseResponses.exerciseId, input.exerciseId)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(exerciseResponses)
          .set({ responses: JSON.stringify(input.responses), updatedAt: new Date() })
          .where(eq(exerciseResponses.id, existing[0].id));
      } else {
        await db.insert(exerciseResponses).values({
          userId: ctx.user.id,
          exerciseId: input.exerciseId,
          lessonId: input.lessonId,
          responses: JSON.stringify(input.responses),
        });
      }
      return { success: true };
    }),

  getResponse: protectedProcedure
    .input(z.object({ exerciseId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const [response] = await db
        .select()
        .from(exerciseResponses)
        .where(and(eq(exerciseResponses.userId, ctx.user.id), eq(exerciseResponses.exerciseId, input.exerciseId)))
        .limit(1);
      if (!response) return null;
      return { ...response, responses: JSON.parse(response.responses) as Record<string, string> };
    }),

  getExerciseDefinitions: protectedProcedure.query(() => EXERCISE_DEFINITIONS),
});

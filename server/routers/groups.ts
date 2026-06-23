/**
 * Router: courseGroups
 * Agrupamento de aulas dentro de um curso
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { courseGroups, courseGroupLessons, lessons } from "../../drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const courseGroupsRouter = router({

  // ── Leitura ────────────────────────────────────────────────────────────────

  /** Lista todos os grupos de um curso com suas aulas */
  listByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const groups = await db
        .select()
        .from(courseGroups)
        .where(and(
          eq(courseGroups.courseId, input.courseId),
          eq(courseGroups.isPublished, 1)
        ))
        .orderBy(asc(courseGroups.order));

      // Para cada grupo, busca as aulas vinculadas
      const result = await Promise.all(
        groups.map(async (group) => {
          const groupLessons = await db
            .select({ lessonId: courseGroupLessons.lessonId, order: courseGroupLessons.order })
            .from(courseGroupLessons)
            .where(eq(courseGroupLessons.groupId, group.id))
            .orderBy(asc(courseGroupLessons.order));

          return {
            ...group,
            lessonIds: groupLessons.map((gl) => gl.lessonId),
            lessonCount: groupLessons.length,
          };
        })
      );

      return result;
    }),

  /** Admin: lista grupos com detalhes completos */
  adminListByCourse: adminProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const groups = await db
        .select()
        .from(courseGroups)
        .where(eq(courseGroups.courseId, input.courseId))
        .orderBy(asc(courseGroups.order));

      const result = await Promise.all(
        groups.map(async (group) => {
          const groupLessons = await db
            .select({
              id: courseGroupLessons.id,
              lessonId: courseGroupLessons.lessonId,
              order: courseGroupLessons.order,
            })
            .from(courseGroupLessons)
            .where(eq(courseGroupLessons.groupId, group.id))
            .orderBy(asc(courseGroupLessons.order));

          // Busca detalhes das aulas
          const lessonDetails = groupLessons.length > 0
            ? await db
                .select({ id: lessons.id, title: lessons.title, duration: lessons.duration, order: lessons.order })
                .from(lessons)
                .where(inArray(lessons.id, groupLessons.map((gl) => gl.lessonId)))
            : [];

          return {
            ...group,
            lessons: groupLessons.map((gl) => ({
              ...gl,
              ...lessonDetails.find((l) => l.id === gl.lessonId),
            })),
            lessonCount: groupLessons.length,
          };
        })
      );

      return result;
    }),

  /** Admin: lista todas as aulas do curso incluindo não publicadas */
  adminListLessons: adminProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({ id: lessons.id, title: lessons.title, duration: lessons.duration, order: lessons.order, isPublished: lessons.isPublished })
        .from(lessons)
        .where(eq(lessons.courseId, input.courseId))
        .orderBy(asc(lessons.order));
    }),

  // ── Criação e edição ────────────────────────────────────────────────────────

  /** Cria novo grupo e vincula aulas selecionadas */
  create: adminProcedure
    .input(z.object({
      courseId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      lessonIds: z.array(z.number()).min(1, "Selecione ao menos uma aula"),
      order: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [group] = await db
        .insert(courseGroups)
        .values({
          courseId: input.courseId,
          title: input.title,
          description: input.description,
          order: input.order,
        })
        .returning();

      // Vincula as aulas ao grupo
      await db.insert(courseGroupLessons).values(
        input.lessonIds.map((lessonId, idx) => ({
          groupId: group.id,
          lessonId,
          order: idx,
        }))
      );

      return group;
    }),

  /** Edita título/descrição de um grupo */
  update: adminProcedure
    .input(z.object({
      groupId: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      order: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [updated] = await db
        .update(courseGroups)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.order !== undefined && { order: input.order }),
          updatedAt: new Date(),
        })
        .where(eq(courseGroups.id, input.groupId))
        .returning();

      return updated;
    }),

  /** Adiciona aulas a um grupo existente */
  addLessons: adminProcedure
    .input(z.object({
      groupId: z.number(),
      lessonIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Descobre a ordem atual máxima
      const existing = await db
        .select()
        .from(courseGroupLessons)
        .where(eq(courseGroupLessons.groupId, input.groupId));

      const maxOrder = existing.length;

      // Remove duplicatas — não adiciona aula que já está no grupo
      const existingIds = existing.map((e) => e.lessonId);
      const newLessonIds = input.lessonIds.filter((id) => !existingIds.includes(id));

      if (newLessonIds.length === 0) return { added: 0 };

      await db.insert(courseGroupLessons).values(
        newLessonIds.map((lessonId, idx) => ({
          groupId: input.groupId,
          lessonId,
          order: maxOrder + idx,
        }))
      );

      return { added: newLessonIds.length };
    }),

  /** Remove uma aula de um grupo */
  removeLesson: adminProcedure
    .input(z.object({
      groupId: z.number(),
      lessonId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .delete(courseGroupLessons)
        .where(and(
          eq(courseGroupLessons.groupId, input.groupId),
          eq(courseGroupLessons.lessonId, input.lessonId)
        ));

      return { success: true };
    }),

  /** Reordena aulas dentro de um grupo */
  reorderLessons: adminProcedure
    .input(z.object({
      groupId: z.number(),
      lessonIds: z.array(z.number()), // ordem nova
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await Promise.all(
        input.lessonIds.map((lessonId, idx) =>
          db
            .update(courseGroupLessons)
            .set({ order: idx })
            .where(and(
              eq(courseGroupLessons.groupId, input.groupId),
              eq(courseGroupLessons.lessonId, lessonId)
            ))
        )
      );

      return { success: true };
    }),

  /** Reordena grupos dentro de um curso */
  reorderGroups: adminProcedure
    .input(z.object({
      groupIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await Promise.all(
        input.groupIds.map((groupId, idx) =>
          db
            .update(courseGroups)
            .set({ order: idx, updatedAt: new Date() })
            .where(eq(courseGroups.id, groupId))
        )
      );

      return { success: true };
    }),

  /** Desfaz agrupamento (deleta grupo mas mantém as aulas intactas) */
  delete: adminProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Remove vínculos
      await db
        .delete(courseGroupLessons)
        .where(eq(courseGroupLessons.groupId, input.groupId));

      // Remove o grupo
      await db
        .delete(courseGroups)
        .where(eq(courseGroups.id, input.groupId));

      return { success: true };
    }),
});

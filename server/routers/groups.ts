/**
 * Router: courseGroups
 * Agrupamento de aulas dentro de um curso
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { courseGroups, courseGroupLessons, lessons, courses } from "../../drizzle/schema";
import { eq, and, asc, inArray, sql } from "drizzle-orm";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const COURSE_GROUPS_SCHEMA_MESSAGE =
  "Os agrupamentos de aulas ainda não foram inicializados no banco de dados. Tente novamente em alguns segundos ou execute a sincronização do schema.";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

function isCourseGroupsSchemaError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    (message.includes("coursegroups") || message.includes("coursegrouplessons")) &&
    (message.includes("does not exist") || message.includes("relation") || message.includes("undefined table"))
  );
}

function createSchemaUnavailableError() {
  return new TRPCError({ code: "PRECONDITION_FAILED", message: COURSE_GROUPS_SCHEMA_MESSAGE });
}

function isDataUrl(value?: string | null) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("data:");
}

async function ensureCourseGroupsSchema(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "courseGroups" (
        "id" serial PRIMARY KEY,
        "courseId" integer NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "coverUrl" text,
        "order" integer NOT NULL DEFAULT 0,
        "isPublished" integer NOT NULL DEFAULT 1,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE "courseGroups" ADD COLUMN IF NOT EXISTS "coverUrl" text`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "courseGroupLessons" (
        "id" serial PRIMARY KEY,
        "groupId" integer NOT NULL,
        "lessonId" integer NOT NULL,
        "order" integer NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "courseGroups_courseId_order_idx"
      ON "courseGroups" ("courseId", "order")
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "courseGroupLessons_groupId_order_idx"
      ON "courseGroupLessons" ("groupId", "order")
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "courseGroupLessons_group_lesson_uidx"
      ON "courseGroupLessons" ("groupId", "lessonId")
    `);
    return true;
  } catch (error) {
    console.error("[courseGroups] schema init failed", error);
    return false;
  }
}

async function runReadWithSchema<T>(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: () => Promise<T>,
  fallback: T,
) {
  const ready = await ensureCourseGroupsSchema(db);
  if (!ready) return fallback;
  try {
    return await operation();
  } catch (error) {
    if (isCourseGroupsSchemaError(error)) {
      const healed = await ensureCourseGroupsSchema(db);
      if (healed) return await operation();
      return fallback;
    }
    throw error;
  }
}

async function runWriteWithSchema<T>(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  operation: () => Promise<T>,
) {
  const ready = await ensureCourseGroupsSchema(db);
  if (!ready) throw createSchemaUnavailableError();
  try {
    return await operation();
  } catch (error) {
    if (isCourseGroupsSchemaError(error)) {
      const healed = await ensureCourseGroupsSchema(db);
      if (healed) return await operation();
      throw createSchemaUnavailableError();
    }
    throw error;
  }
}

export const courseGroupsRouter = router({

  // ── Leitura ────────────────────────────────────────────────────────────────

  /** Lista todos os grupos publicados de um curso com suas aulas */
  listByCourse: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return runReadWithSchema(db, async () => {
        const groups = await db
          .select()
          .from(courseGroups)
          .where(and(
            eq(courseGroups.courseId, input.courseId),
            eq(courseGroups.isPublished, 1),
          ))
          .orderBy(asc(courseGroups.order));

        const result = await Promise.all(
          groups.map(async (group) => {
            const groupLessons = await db
              .select({ lessonId: courseGroupLessons.lessonId, groupOrder: courseGroupLessons.order })
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
      }, [] as Array<Record<string, unknown>>);
    }),

  /** Admin: lista grupos com detalhes completos (inclui despublicados) */
  adminListByCourse: adminProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return runReadWithSchema(db, async () => {
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
                groupOrder: courseGroupLessons.order,
              })
              .from(courseGroupLessons)
              .where(eq(courseGroupLessons.groupId, group.id))
              .orderBy(asc(courseGroupLessons.order));

            const lessonDetails = groupLessons.length > 0
              ? await db
                  .select({ id: lessons.id, title: lessons.title, duration: lessons.duration })
                  .from(lessons)
                  .where(inArray(lessons.id, groupLessons.map((gl) => gl.lessonId)))
              : [];

            return {
              ...group,
              lessons: groupLessons.map((gl) => ({
                id: gl.id,
                lessonId: gl.lessonId,
                order: gl.groupOrder,
                title: lessonDetails.find((l) => l.id === gl.lessonId)?.title ?? "",
                duration: lessonDetails.find((l) => l.id === gl.lessonId)?.duration ?? null,
              })),
              lessonCount: groupLessons.length,
            };
          })
        );

        return result;
      }, [] as Array<Record<string, unknown>>);
    }),

  /** Admin: lista aulas do curso atual para seleção no agrupamento */
  adminListLessons: adminProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return runReadWithSchema(db, async () => {
        const allLessons = await db
          .select({
            id: lessons.id,
            title: lessons.title,
            duration: lessons.duration,
            order: lessons.order,
            isPublished: lessons.isPublished,
            courseId: lessons.courseId,
            courseTitle: courses.title,
          })
          .from(lessons)
          .leftJoin(courses, eq(lessons.courseId, courses.id))
          .where(eq(lessons.courseId, input.courseId))
          .orderBy(asc(lessons.order));

        return allLessons;
      }, [] as Array<Record<string, unknown>>);
    }),

  // ── Criação e edição ────────────────────────────────────────────────────────

  /** Cria novo grupo e vincula aulas selecionadas */
  create: adminProcedure
    .input(z.object({
      courseId: z.number(),
      title: z.string().min(1),
      description: z.string().optional(),
      coverUrl: z.string().optional().refine(
        (value) => !value || !isDataUrl(value),
        { message: "coverUrl deve ser uma URL pública de imagem, não base64." }
      ),
      lessonIds: z.array(z.number()).min(1, "Selecione ao menos uma aula"),
      order: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return runWriteWithSchema(db, async () => {
        if (isDataUrl(input.coverUrl)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A capa do agrupamento precisa ser uma URL de arquivo enviada previamente, não uma imagem base64.",
          });
        }

        const [group] = await db
          .insert(courseGroups)
          .values({
            courseId: input.courseId,
            title: input.title,
            description: input.description,
            coverUrl: input.coverUrl?.trim() || null,
            order: input.order,
          })
          .returning();

        await db.insert(courseGroupLessons).values(
          input.lessonIds.map((lessonId, idx) => ({
            groupId: group.id,
            lessonId,
            order: idx,
          }))
        );

        return group;
      });
    }),

  /** Edita título, descrição, capa e opcionalmente substitui as aulas do grupo */
  update: adminProcedure
    .input(z.object({
      groupId: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      coverUrl: z.string().optional().nullable(),
      order: z.number().optional(),
      isPublished: z.number().min(0).max(1).optional(),
      lessonIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return runWriteWithSchema(db, async () => {
        const [updated] = await db
          .update(courseGroups)
          .set({
            ...(input.title && { title: input.title }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.coverUrl !== undefined && { coverUrl: input.coverUrl }),
            ...(input.order !== undefined && { order: input.order }),
            ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
            updatedAt: new Date(),
          })
          .where(eq(courseGroups.id, input.groupId))
          .returning();

        if (input.lessonIds !== undefined) {
          await db.delete(courseGroupLessons).where(eq(courseGroupLessons.groupId, input.groupId));
          if (input.lessonIds.length > 0) {
            await db.insert(courseGroupLessons).values(
              input.lessonIds.map((lessonId, idx) => ({
                groupId: input.groupId,
                lessonId,
                order: idx,
              }))
            );
          }
        }

        return updated;
      });
    }),

  /** Adiciona aulas a um grupo existente (sem duplicar) */
  addLessons: adminProcedure
    .input(z.object({
      groupId: z.number(),
      lessonIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return runWriteWithSchema(db, async () => {
        const existing = await db
          .select()
          .from(courseGroupLessons)
          .where(eq(courseGroupLessons.groupId, input.groupId));

        const maxOrder = existing.length;
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
      });
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

      return runWriteWithSchema(db, async () => {
        await db
          .delete(courseGroupLessons)
          .where(and(
            eq(courseGroupLessons.groupId, input.groupId),
            eq(courseGroupLessons.lessonId, input.lessonId),
          ));
        return { success: true };
      });
    }),

  /** Reordena aulas dentro de um grupo */
  reorderLessons: adminProcedure
    .input(z.object({
      groupId: z.number(),
      lessonIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return runWriteWithSchema(db, async () => {
        await Promise.all(
          input.lessonIds.map((lessonId, idx) =>
            db
              .update(courseGroupLessons)
              .set({ order: idx })
              .where(and(
                eq(courseGroupLessons.groupId, input.groupId),
                eq(courseGroupLessons.lessonId, lessonId),
              ))
          )
        );
        return { success: true };
      });
    }),

  /** Reordena grupos dentro de um curso */
  reorderGroups: adminProcedure
    .input(z.object({
      groupIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return runWriteWithSchema(db, async () => {
        await Promise.all(
          input.groupIds.map((groupId, idx) =>
            db
              .update(courseGroups)
              .set({ order: idx, updatedAt: new Date() })
              .where(eq(courseGroups.id, groupId))
          )
        );
        return { success: true };
      });
    }),

  /** Desfaz agrupamento (deleta grupo mas mantém as aulas intactas) */
  delete: adminProcedure
    .input(z.object({ groupId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return runWriteWithSchema(db, async () => {
        await db.delete(courseGroupLessons).where(eq(courseGroupLessons.groupId, input.groupId));
        await db.delete(courseGroups).where(eq(courseGroups.id, input.groupId));
        return { success: true };
      });
    }),
});

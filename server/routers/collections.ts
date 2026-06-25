/**
 * Router: contentCollections
 * Agrupamentos independentes de conteúdo — podem conter aulas de qualquer curso
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import {
  contentCollections,
  contentCollectionItems,
  contentCollectionHistory,
  lessons,
  courses,
} from "../../drizzle/schema";
import { eq, and, asc, inArray, sql, ilike, or } from "drizzle-orm";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

async function ensureSchema(db: any) {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "contentCollections" (
        "id" serial PRIMARY KEY,
        "title" varchar(255) NOT NULL,
        "subtitle" varchar(255),
        "description" text,
        "coverUrl" text,
        "order" integer NOT NULL DEFAULT 0,
        "isActive" integer NOT NULL DEFAULT 1,
        "totalDuration" integer NOT NULL DEFAULT 0,
        "createdBy" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "contentCollectionItems" (
        "id" serial PRIMARY KEY,
        "collectionId" integer NOT NULL,
        "lessonId" integer NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "addedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "contentCollectionHistory" (
        "id" serial PRIMARY KEY,
        "collectionId" integer NOT NULL,
        "action" varchar(50) NOT NULL,
        "detail" text,
        "performedBy" integer,
        "performedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "cci_col_lesson_uidx" ON "contentCollectionItems" ("collectionId","lessonId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "cci_col_order_idx" ON "contentCollectionItems" ("collectionId","order")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "cch_col_idx" ON "contentCollectionHistory" ("collectionId")`);
    return true;
  } catch (e) {
    console.error("[collections] schema init failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

async function logHistory(db: any, collectionId: number, action: string, detail: string, userId?: number) {
  try {
    await db.insert(contentCollectionHistory).values({ collectionId, action, detail, performedBy: userId });
  } catch {}
}

async function calcDuration(db: any, collectionId: number): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(l.duration), 0) as total
      FROM "contentCollectionItems" cci
      JOIN lessons l ON l.id = cci."lessonId"
      WHERE cci."collectionId" = ${collectionId}
    `);
    return Number(result.rows?.[0]?.total ?? 0);
  } catch { return 0; }
}

async function withSchema<T>(db: any, fn: () => Promise<T>, fallback: T): Promise<T> {
  const ok = await ensureSchema(db);
  if (!ok) return fallback;
  try { return await fn(); } catch (e) { console.error("[collections]", e); return fallback; }
}

export const contentCollectionsRouter = router({

  // ── Leitura pública ───────────────────────────────────────────────────────

  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return withSchema(db, async () => {
      const cols = await db
        .select()
        .from(contentCollections)
        .where(sql`"contentCollections"."isActive" = 1`)
        .orderBy(asc(contentCollections.order));

      return Promise.all(cols.map(async (col: any) => {
        const items = await db
          .select({ lessonId: contentCollectionItems.lessonId })
          .from(contentCollectionItems)
          .where(eq(contentCollectionItems.collectionId, col.id));
        return { ...col, lessonCount: items.length };
      }));
    }, []);
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      return withSchema(db, async () => {
        const [col] = await db
          .select()
          .from(contentCollections)
          .where(eq(contentCollections.id, input.id))
          .limit(1);
        if (!col) return null;

        const items = await db
          .select({
            id: contentCollectionItems.id,
            lessonId: contentCollectionItems.lessonId,
            order: contentCollectionItems.order,
          })
          .from(contentCollectionItems)
          .where(eq(contentCollectionItems.collectionId, col.id))
          .orderBy(asc(contentCollectionItems.order));

        const lessonIds = items.map((i: any) => i.lessonId);
        const lessonDetails = lessonIds.length > 0
          ? await db
              .select({
                id: lessons.id,
                title: lessons.title,
                duration: lessons.duration,
                courseId: lessons.courseId,
                isPublished: lessons.isPublished,
                videoPlaybackUrl: lessons.videoPlaybackUrl,
                description: lessons.description,
                order: lessons.order,
              })
              .from(lessons)
              .where(inArray(lessons.id, lessonIds))
          : [];

        const courseIds = [...new Set(lessonDetails.map((l: any) => l.courseId))];
        const courseDetails = courseIds.length > 0
          ? await db
              .select({ id: courses.id, title: courses.title, thumbnail: courses.thumbnail, slug: courses.slug })
              .from(courses)
              .where(inArray(courses.id, courseIds))
          : [];

        return {
          ...col,
          lessons: items.map((item: any) => {
            const lesson = lessonDetails.find((l: any) => l.id === item.lessonId);
            const course = lesson ? courseDetails.find((c: any) => c.id === lesson.courseId) : null;
            return { ...item, lesson, course };
          }),
          lessonCount: items.length,
        };
      }, null);
    }),

  // ── Admin — leitura ───────────────────────────────────────────────────────

  adminList: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return withSchema(db, async () => {
      const cols = await db
        .select()
        .from(contentCollections)
        .orderBy(asc(contentCollections.order));

      return Promise.all(cols.map(async (col: any) => {
        const items = await db
          .select({ lessonId: contentCollectionItems.lessonId })
          .from(contentCollectionItems)
          .where(eq(contentCollectionItems.collectionId, col.id));
        return { ...col, lessonCount: items.length };
      }));
    }, []);
  }),

  searchLessons: adminProcedure
    .input(z.object({ query: z.string().optional(), courseId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return withSchema(db, async () => {
        const conditions: any[] = [];
        if (input.query?.trim()) {
          conditions.push(ilike(lessons.title, `%${input.query.trim()}%`));
        }
        if (input.courseId) {
          conditions.push(eq(lessons.courseId, input.courseId));
        }

        const result = await db
          .select({
            id: lessons.id,
            title: lessons.title,
            duration: lessons.duration,
            courseId: lessons.courseId,
            courseTitle: courses.title,
            isPublished: lessons.isPublished,
            order: lessons.order,
          })
          .from(lessons)
          .leftJoin(courses, eq(lessons.courseId, courses.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(asc(courses.title), asc(lessons.order))
          .limit(100);

        return result;
      }, []);
    }),

  getHistory: adminProcedure
    .input(z.object({ collectionId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return withSchema(db, async () => {
        return db
          .select()
          .from(contentCollectionHistory)
          .where(eq(contentCollectionHistory.collectionId, input.collectionId))
          .orderBy(sql`"contentCollectionHistory"."performedAt" DESC`)
          .limit(50);
      }, []);
    }),

  // ── Admin — escrita ───────────────────────────────────────────────────────

  create: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      coverUrl: z.string().optional(),
      order: z.number().default(0),
      lessonIds: z.array(z.number()).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Schema indisponível" });

      const [col] = await db
        .insert(contentCollections)
        .values({
          title: input.title.trim(),
          subtitle: input.subtitle?.trim(),
          description: input.description?.trim(),
          coverUrl: input.coverUrl?.trim() || null,
          order: input.order,
          createdBy: ctx.user.id,
        })
        .returning();

      if (input.lessonIds.length > 0) {
        await db.insert(contentCollectionItems).values(
          input.lessonIds.map((lessonId, idx) => ({ collectionId: col.id, lessonId, order: idx }))
        );
        const dur = await calcDuration(db, col.id);
        await db.update(contentCollections).set({ totalDuration: dur }).where(eq(contentCollections.id, col.id));
      }

      await logHistory(db, col.id, "created", `Coleção "${col.title}" criada com ${input.lessonIds.length} aula(s)`, ctx.user.id);
      return col;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).optional(),
      subtitle: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      coverUrl: z.string().optional().nullable(),
      order: z.number().optional(),
      isActive: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      const updates: any = { updatedAt: new Date() };
      if (input.title) updates.title = input.title.trim();
      if (input.subtitle !== undefined) updates.subtitle = input.subtitle;
      if (input.description !== undefined) updates.description = input.description;
      if (input.coverUrl !== undefined) updates.coverUrl = input.coverUrl;
      if (input.order !== undefined) updates.order = input.order;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      const [updated] = await db
        .update(contentCollections)
        .set(updates)
        .where(eq(contentCollections.id, input.id))
        .returning();

      await logHistory(db, input.id, "updated", `Metadados atualizados`, ctx.user.id);
      return updated;
    }),

  addLessons: adminProcedure
    .input(z.object({
      collectionId: z.number().int().positive(),
      lessonIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      const existing = await db
        .select({ lessonId: contentCollectionItems.lessonId, order: contentCollectionItems.order })
        .from(contentCollectionItems)
        .where(eq(contentCollectionItems.collectionId, input.collectionId));

      const existingIds = new Set(existing.map((e: any) => e.lessonId));
      const newIds = input.lessonIds.filter((id) => !existingIds.has(id));
      const maxOrder = existing.length;

      if (newIds.length > 0) {
        await db.insert(contentCollectionItems).values(
          newIds.map((lessonId, idx) => ({ collectionId: input.collectionId, lessonId, order: maxOrder + idx }))
        );
        const dur = await calcDuration(db, input.collectionId);
        await db.update(contentCollections).set({ totalDuration: dur, updatedAt: new Date() }).where(eq(contentCollections.id, input.collectionId));
        await logHistory(db, input.collectionId, "lessons_added", `${newIds.length} aula(s) adicionada(s)`, ctx.user.id);
      }

      return { added: newIds.length, skipped: input.lessonIds.length - newIds.length };
    }),

  removeLesson: adminProcedure
    .input(z.object({ collectionId: z.number(), lessonId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      await db.delete(contentCollectionItems).where(
        and(eq(contentCollectionItems.collectionId, input.collectionId), eq(contentCollectionItems.lessonId, input.lessonId))
      );
      const dur = await calcDuration(db, input.collectionId);
      await db.update(contentCollections).set({ totalDuration: dur, updatedAt: new Date() }).where(eq(contentCollections.id, input.collectionId));
      await logHistory(db, input.collectionId, "lesson_removed", `Aula ${input.lessonId} removida`, ctx.user.id);
      return { success: true };
    }),

  reorderItems: adminProcedure
    .input(z.object({ collectionId: z.number(), lessonIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      await Promise.all(
        input.lessonIds.map((lessonId, idx) =>
          db.update(contentCollectionItems)
            .set({ order: idx })
            .where(and(eq(contentCollectionItems.collectionId, input.collectionId), eq(contentCollectionItems.lessonId, lessonId)))
        )
      );
      await logHistory(db, input.collectionId, "reordered", `Itens reordenados`, ctx.user.id);
      return { success: true };
    }),

  reorderCollections: adminProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      await Promise.all(
        input.ids.map((id, idx) =>
          db.update(contentCollections).set({ order: idx, updatedAt: new Date() }).where(eq(contentCollections.id, id))
        )
      );
      return { success: true };
    }),

  duplicate: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      const [orig] = await db.select().from(contentCollections).where(eq(contentCollections.id, input.id)).limit(1);
      if (!orig) throw new TRPCError({ code: "NOT_FOUND" });

      const [copy] = await db
        .insert(contentCollections)
        .values({
          title: `${orig.title} (cópia)`,
          subtitle: orig.subtitle,
          description: orig.description,
          coverUrl: orig.coverUrl,
          order: orig.order + 1,
          isActive: 0,
          createdBy: ctx.user.id,
        })
        .returning();

      const items = await db
        .select()
        .from(contentCollectionItems)
        .where(eq(contentCollectionItems.collectionId, input.id))
        .orderBy(asc(contentCollectionItems.order));

      if (items.length > 0) {
        await db.insert(contentCollectionItems).values(
          items.map((item: any) => ({ collectionId: copy.id, lessonId: item.lessonId, order: item.order }))
        );
        const dur = await calcDuration(db, copy.id);
        await db.update(contentCollections).set({ totalDuration: dur }).where(eq(contentCollections.id, copy.id));
      }

      await logHistory(db, copy.id, "duplicated", `Duplicado de #${input.id} "${orig.title}"`, ctx.user.id);
      return copy;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const ok = await ensureSchema(db);
      if (!ok) throw new TRPCError({ code: "PRECONDITION_FAILED" });

      await db.delete(contentCollectionItems).where(eq(contentCollectionItems.collectionId, input.id));
      await db.delete(contentCollectionHistory).where(eq(contentCollectionHistory.collectionId, input.id));
      await db.delete(contentCollections).where(eq(contentCollections.id, input.id));
      return { success: true };
    }),
});

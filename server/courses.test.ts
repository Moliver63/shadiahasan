import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@shadia.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@shadia.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("courses router", () => {
  it("should allow admin to access stats", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.courses.stats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalCourses).toBe("number");
    expect(typeof stats.totalLessons).toBe("number");
    expect(typeof stats.totalEnrollments).toBe("number");
  });

  it("should prevent non-admin from accessing stats", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.courses.stats()).rejects.toThrow("FORBIDDEN");
  });

  it("should allow public access to course list", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    const courses = await caller.courses.list();

    expect(Array.isArray(courses)).toBe(true);
  });

  it("should allow admin to create course", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.courses.create({
      title: "Test Course",
      slug: "test-course-" + Date.now(),
      description: "Test description",
      isPublished: 0,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("should prevent non-admin from creating course", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.courses.create({
        title: "Test Course",
        slug: "test-course",
        description: "Test description",
        isPublished: 0,
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("enrollments router", () => {
  it("should allow authenticated user to check enrollment", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.enrollments.checkEnrollment({
      courseId: 1,
    });

    expect(result).toBeDefined();
    expect(typeof result.enrolled).toBe("boolean");
  });

  it("should allow authenticated user to view their enrollments", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const enrollments = await caller.enrollments.myEnrollments();

    expect(Array.isArray(enrollments)).toBe(true);
  });
});

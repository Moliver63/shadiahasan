import { eq, ne, or, and, gte, desc, isNull, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser, users, subscriptions, paymentHistory, referrals,
  pointsTransactions, cashbackRequests, adminAuditLogs, adminInvites,
  courses, courseModules, lessons, enrollments,
  Course, CourseModule, Lesson, Enrollment,
  InsertCourse, InsertCourseModule, InsertLesson, InsertEnrollment,
  subscriptionPlans, userSubscriptions, SubscriptionPlan, UserSubscription,
  InsertSubscriptionPlan, InsertUserSubscription,
  courseReviews, CourseReview, InsertCourseReview,
  ebooks, Ebook, InsertEbook,
  userBadges, UserBadge, InsertUserBadge,
  certificates, Certificate, InsertCertificate,
  userProfiles, UserProfile, InsertUserProfile,
  connections, connectionRequests,
  reports, moderationLogs,
  conversations, messages,
  emailVerificationTokens, passwordResetTokens, refreshTokens,
  coursePurchases, adminPermissions,
  userSettings, activityLogs, notifications,
  InsertSubscription, Subscription,
  InsertPaymentHistory, InsertReferral, InsertPointsTransaction,
  InsertCashbackRequest, InsertAdminAuditLog, InsertAdminInvite,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USERS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId && !user.email) {
    throw new Error("User openId or email is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId || null,
      email: user.email || '',
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      values[field] = value ?? undefined;
      updateSet[field] = value ?? undefined;
    };

    textFields.forEach(assignNullable);

    if (user.email !== undefined) {
      values.email = user.email;
      updateSet.email = user.email;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Check if user exists
    const existingUser = user.openId
      ? await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
      : await db.select().from(users).where(eq(users.email, user.email!)).limit(1);
    const isNewUser = existingUser.length === 0;

    // PostgreSQL: usar onConflictDoUpdate em vez de onDuplicateKeyUpdate
    if (user.openId) {
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.openId,
        set: updateSet,
      });
    } else {
      await db.insert(users).values(values).onConflictDoUpdate({
        target: users.email,
        set: updateSet,
      });
    }

    if (isNewUser && user.name) {
      const newUser = user.openId
        ? await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
        : await db.select().from(users).where(eq(users.email, user.email!)).limit(1);
      if (newUser.length > 0) {
        sendWelcomeMessage(newUser[0].id, user.name).catch(err => {
          console.error("[Welcome Message] Failed to send:", err);
        });
      }
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

// ============ COURSES ============

export async function getAllCourses(includeUnpublished = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(courses);
  if (!includeUnpublished) {
    return await query.where(eq(courses.isPublished, 1)).orderBy(desc(courses.createdAt));
  }
  return await query.orderBy(desc(courses.createdAt));
}

export async function getCourseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCourseBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courses).where(eq(courses.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCourse(course: InsertCourse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // PostgreSQL: usar returning() para obter o ID inserido
  const result = await db.insert(courses).values(course).returning({ id: courses.id });
  return result[0]?.id;
}

export async function updateCourse(id: number, updates: Partial<InsertCourse>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courses).set(updates).where(eq(courses.id, id));
}

export async function deleteCourse(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(lessons).where(eq(lessons.courseId, id));
  await db.delete(enrollments).where(eq(enrollments.courseId, id));
  await db.delete(courses).where(eq(courses.id, id));
}

// ============ LESSONS ============

export async function getLessonsByCourseId(courseId: number, includeUnpublished = false) {
  const db = await getDb();
  if (!db) return [];
  if (!includeUnpublished) {
    return await db.select().from(lessons)
      .where(and(eq(lessons.courseId, courseId), eq(lessons.isPublished, 1)))
      .orderBy(lessons.order);
  }
  return await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(lessons.order);
}

export async function getLessonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLesson(lesson: InsertLesson) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(lessons).values(lesson).returning({ id: lessons.id });
  return result[0]?.id;
}

export async function updateLesson(id: number, updates: Partial<InsertLesson>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(lessons).set(updates).where(eq(lessons.id, id));
}

export async function deleteLesson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(lessons).where(eq(lessons.id, id));
}

// ============ ENROLLMENTS ============

export async function getEnrollmentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(enrollments).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.enrolledAt));
}

export async function getEnrollmentByCourseAndUser(courseId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createEnrollment(enrollment: InsertEnrollment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(enrollments).values(enrollment).returning({ id: enrollments.id });
  return result[0]?.id;
}

export async function updateEnrollment(id: number, updates: Partial<InsertEnrollment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(enrollments).set(updates).where(eq(enrollments.id, id));
}

export async function deleteEnrollment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(enrollments).where(eq(enrollments.id, id));
}

export async function getAllEnrollments() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(enrollments);
}

export async function getCourseStats() {
  const db = await getDb();
  if (!db) return { totalCourses: 0, totalLessons: 0, totalEnrollments: 0 };
  const [courseCount] = await db.select({ count: sql<number>`count(*)` }).from(courses);
  const [lessonCount] = await db.select({ count: sql<number>`count(*)` }).from(lessons);
  const [enrollmentCount] = await db.select({ count: sql<number>`count(*)` }).from(enrollments);
  return {
    totalCourses: courseCount?.count || 0,
    totalLessons: lessonCount?.count || 0,
    totalEnrollments: enrollmentCount?.count || 0,
  };
}

// ============ SUBSCRIPTION PLANS ============

export async function getAllPlans() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1));
}

export async function getAllPlansAdmin() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subscriptionPlans);
}

export async function getPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPlanBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPlan(plan: InsertSubscriptionPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptionPlans).values(plan).returning({ id: subscriptionPlans.id });
  return result[0]?.id;
}

export async function updatePlan(id: number, updates: Partial<InsertSubscriptionPlan>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptionPlans).set(updates).where(eq(subscriptionPlans.id, id));
}

export async function deletePlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
}

// ============ USER SUBSCRIPTIONS ============

export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userSubscriptions)
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, "active")))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserSubscription(subscription: InsertUserSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userSubscriptions).values(subscription);
}

export async function updateUserSubscription(id: number, updates: Partial<InsertUserSubscription>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userSubscriptions).set(updates).where(eq(userSubscriptions.id, id));
}

export async function getUserSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ COURSE REVIEWS ============

export async function getReviewsByCourseId(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(courseReviews).where(eq(courseReviews.courseId, courseId)).orderBy(desc(courseReviews.createdAt));
}

export async function getCourseAverageRating(courseId: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  const [result] = await db.select({
    average: sql<number>`AVG(${courseReviews.rating})`,
    count: sql<number>`COUNT(*)`
  }).from(courseReviews).where(eq(courseReviews.courseId, courseId));
  return {
    average: result?.average ? Math.round(result.average * 10) / 10 : 0,
    count: result?.count || 0
  };
}

export async function createReview(review: InsertCourseReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(courseReviews).values(review);
}

export async function getUserReviewForCourse(courseId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(courseReviews)
    .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.userId, userId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ EBOOKS ============

export async function getAllEbooks(includeUnpublished = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(ebooks);
  if (!includeUnpublished) {
    return await query.where(eq(ebooks.isPublished, 1)).orderBy(desc(ebooks.createdAt));
  }
  return await query.orderBy(desc(ebooks.createdAt));
}

export async function getEbookById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ebooks).where(eq(ebooks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createEbook(ebook: InsertEbook) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(ebooks).values(ebook);
}

export async function updateEbook(id: number, updates: Partial<InsertEbook>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ebooks).set(updates).where(eq(ebooks.id, id));
}

export async function deleteEbook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(ebooks).where(eq(ebooks.id, id));
}

// ============ USER BADGES ============

export async function getUserBadges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(userBadges).where(eq(userBadges.userId, userId)).orderBy(desc(userBadges.earnedAt));
}

export async function awardBadge(badge: InsertUserBadge) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(userBadges)
    .where(and(eq(userBadges.userId, badge.userId), eq(userBadges.badgeType, badge.badgeType)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(userBadges).values(badge);
  }
}

// ============ CERTIFICATES ============

export async function getUserCertificates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
}

export async function getCertificateByNumber(certificateNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates).where(eq(certificates.certificateNumber, certificateNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCertificate(certificate: InsertCertificate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(certificates).values(certificate);
}

export async function getUserCertificateForCourse(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ USER PROFILES ============

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateUserProfile(userId: number, data: Partial<InsertUserProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserProfile(userId);
  if (!existing) {
    await db.insert(userProfiles).values({
      userId,
      ...data,
      isPublic: data.isPublic ? 1 : 0,
      showCity: data.showCity ? 1 : 0,
      interests: data.interests ? JSON.stringify(data.interests) : null,
      goals: data.goals ? JSON.stringify(data.goals) : null,
    } as any);
  } else {
    const updates: any = {};
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.city !== undefined) updates.city = data.city;
    if (data.interests !== undefined) updates.interests = JSON.stringify(data.interests);
    if (data.goals !== undefined) updates.goals = JSON.stringify(data.goals);
    if (data.isPublic !== undefined) updates.isPublic = data.isPublic ? 1 : 0;
    if (data.showCity !== undefined) updates.showCity = data.showCity ? 1 : 0;
    await db.update(userProfiles).set(updates).where(eq(userProfiles.userId, userId));
  }
}

// ============ ADMIN ============

export async function promoteToAdmin(targetUserId: number, performedByUserId: number, ip?: string, userAgent?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.update(users).set({ role: "admin" }).where(eq(users.id, targetUserId));
  await logAdminAction({ action: "PROMOTE_ADMIN", performedByUserId, targetUserId, ip, userAgent });
}

export async function demoteFromAdmin(targetUserId: number, performedByUserId: number, ip?: string, userAgent?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const superadmins = await db.select().from(users).where(eq(users.role, "superadmin"));
  const targetUser = await getUserById(targetUserId);
  if (targetUser?.role === "superadmin" && superadmins.length === 1) {
    throw new Error("Cannot demote the last superadmin");
  }
  await db.update(users).set({ role: "user" }).where(eq(users.id, targetUserId));
  await logAdminAction({
    action: targetUser?.role === "superadmin" ? "DEMOTE_SUPERADMIN" : "DEMOTE_ADMIN",
    performedByUserId, targetUserId, ip, userAgent,
  });
}

export async function promoteToSuperAdmin(targetUserId: number, performedByUserId: number, ip?: string, userAgent?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.update(users).set({ role: "superadmin" }).where(eq(users.id, targetUserId));
  await logAdminAction({ action: "PROMOTE_SUPERADMIN", performedByUserId, targetUserId, ip, userAgent });
}

export async function listAllAdminsAndSuperAdmins() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return await db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
  }).from(users).where(or(eq(users.role, "admin"), eq(users.role, "superadmin"))).orderBy(desc(users.createdAt));
}

export async function countSuperAdmins() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "superadmin"));
  return result[0]?.count || 0;
}

export async function logAdminAction(data: {
  action: "PROMOTE_ADMIN" | "DEMOTE_ADMIN" | "PROMOTE_SUPERADMIN" | "DEMOTE_SUPERADMIN";
  performedByUserId: number;
  targetUserId: number;
  ip?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAuditLogs).values(data);
}

// ============ ADMIN INVITES ============

export async function createAdminInvite(email: string, role: "admin" | "superadmin", invitedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const existingUser = await getUserByEmail(email);
  if (existingUser) throw new Error("User with this email already exists");
  const existingInvite = await db.select().from(adminInvites)
    .where(and(eq(adminInvites.email, email), isNull(adminInvites.acceptedAt), gt(adminInvites.expiresAt, new Date())))
    .limit(1);
  if (existingInvite.length > 0) throw new Error("Active invite already exists for this email");
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);
  const result = await db.insert(adminInvites).values({ email, role, token, expiresAt, invitedBy }).returning({ id: adminInvites.id });
  return { token, expiresAt, inviteId: result[0]?.id };
}

export async function getAdminInviteByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const invite = await db.select().from(adminInvites).where(eq(adminInvites.token, token)).limit(1);
  return invite[0] || null;
}

export async function acceptAdminInvite(token: string, password: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const invite = await getAdminInviteByToken(token);
  if (!invite) throw new Error("Invalid invite token");
  if (invite.acceptedAt) throw new Error("Invite has already been accepted");
  if (new Date() > invite.expiresAt) throw new Error("Invite has expired");
  const existingUser = await getUserByEmail(invite.email);
  if (existingUser) throw new Error("User with this email already exists");
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash(password, 10);
  const userResult = await db.insert(users).values({
    email: invite.email, name, passwordHash,
    role: invite.role, emailVerified: 1, loginMethod: "email",
  }).returning({ id: users.id });
  const userId = userResult[0]?.id;
  await db.update(adminInvites).set({ acceptedAt: new Date() }).where(eq(adminInvites.id, invite.id));
  await logAdminAction({
    action: invite.role === "superadmin" ? "PROMOTE_SUPERADMIN" : "PROMOTE_ADMIN",
    performedByUserId: invite.invitedBy,
    targetUserId: userId,
  });
  return await getUserById(userId);
}

export async function listAdminInvites() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return await db.select({
    id: adminInvites.id, email: adminInvites.email, role: adminInvites.role,
    expiresAt: adminInvites.expiresAt, acceptedAt: adminInvites.acceptedAt,
    createdAt: adminInvites.createdAt,
    invitedByName: users.name, invitedByEmail: users.email,
  }).from(adminInvites).leftJoin(users, eq(adminInvites.invitedBy, users.id)).orderBy(desc(adminInvites.createdAt));
}

// ============ WELCOME MESSAGE (stub) ============
async function sendWelcomeMessage(userId: number, name: string) {
  // Implementar envio de mensagem de boas-vindas aqui
  console.log(`[Welcome] Sending welcome message to user ${userId} (${name})`);
}

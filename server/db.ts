import { eq, ne, or, and, gte, desc, isNull, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser, users, subscriptions, paymentHistory, referrals,
  pointsTransactions, cashbackRequests, adminAuditLogs, adminInvites,
  courses, courseModules, lessons, enrollments, courseReviews, ebooks,
  userBadges, certificates, userProfiles, connections, connectionRequests,
  reports, moderationLogs, conversations, messages, userSubscriptions,
  subscriptionPlans, adminPermissions, emailVerificationTokens, passwordResetTokens,
  Course, CourseModule, Lesson, Enrollment, SubscriptionPlan, UserSubscription,
  InsertCourse, InsertCourseModule, InsertLesson, InsertEnrollment,
  InsertSubscriptionPlan, InsertUserSubscription, InsertCourseReview,
  InsertEbook, InsertUserBadge, InsertCertificate, InsertUserProfile,
  InsertConnection, InsertConnectionRequest, InsertReport, InsertModerationLog,
  InsertConversation, InsertMessage, AdminPermission, InsertAdminPermission,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ UPSERT USER ============

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
      const normalized = value ?? undefined;
      values[field] = normalized;
      updateSet[field] = normalized;
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

    const existingUser = user.openId
      ? await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
      : await db.select().from(users).where(eq(users.email, user.email!)).limit(1);
    const isNewUser = existingUser.length === 0;

    await db.insert(users).values(values).onConflictDoUpdate({ set: updateSet });

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
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  await db.insert(courses).values(course);
  const [newCourse] = await db.select().from(courses).where(eq(courses.slug, course.slug)).limit(1);
  return newCourse?.id;
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

// ============ MODULES ============

export async function getModulesByCourseId(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(courseModules.order);
}

export async function getModuleById(moduleId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(courseModules).where(eq(courseModules.id, moduleId));
  return result[0] || null;
}

export async function createModule(data: InsertCourseModule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(courseModules).values(data);
  return { id: Number(result[0]?.id), ...data };
}

export async function updateModule(moduleId: number, data: Partial<InsertCourseModule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(courseModules).set(data).where(eq(courseModules.id, moduleId));
  return { success: true };
}

export async function deleteModule(moduleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(courseModules).where(eq(courseModules.id, moduleId));
  return { success: true };
}

export async function getLessonsByModuleId(moduleId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(lessons).where(eq(lessons.moduleId, moduleId)).orderBy(lessons.order);
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
  await db.insert(lessons).values(lesson);
  const [newLesson] = await db.select().from(lessons)
    .where(and(eq(lessons.courseId, lesson.courseId), eq(lessons.title, lesson.title)))
    .orderBy(desc(lessons.id))
    .limit(1);
  return newLesson?.id;
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
  await db.insert(enrollments).values(enrollment);
  const [newEnrollment] = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, enrollment.userId), eq(enrollments.courseId, enrollment.courseId)))
    .limit(1);
  return newEnrollment?.id;
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

// ============ SUBSCRIPTION PLANS ============

export async function getAllPlans() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1));
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
  const result = await db.insert(subscriptionPlans).values(plan);
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

export async function getAllPlansAdmin() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(subscriptionPlans);
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
  return await db.select().from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))
    .orderBy(desc(courseReviews.createdAt));
}

export async function getCourseAverageRating(courseId: number) {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  const [result] = await db.select({
    average: sql<number>`AVG(${courseReviews.rating})`,
    count: sql<number>`COUNT(*)`,
  }).from(courseReviews).where(eq(courseReviews.courseId, courseId));
  return {
    average: result?.average ? Math.round(result.average * 10) / 10 : 0,
    count: result?.count || 0,
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
  return await db.select().from(userBadges)
    .where(eq(userBadges.userId, userId))
    .orderBy(desc(userBadges.earnedAt));
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
  return await db.select().from(certificates)
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedAt));
}

export async function getCertificateByNumber(certificateNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificates)
    .where(eq(certificates.certificateNumber, certificateNumber))
    .limit(1);
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

// ============ ADMIN QUERIES ============

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ USER PROFILES ============

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
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
  return await getUserProfile(userId);
}

export async function getPublicProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userProfiles)
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.isPublic, 1)))
    .limit(1);
  if (result.length === 0) return null;
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (userResult.length === 0) return null;
  return { ...result[0], user: userResult[0] };
}

// ============ CONNECTIONS ============

export async function getConnectionSuggestions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const publicProfiles = await db.select().from(userProfiles)
    .where(and(eq(userProfiles.isPublic, 1), ne(userProfiles.userId, userId)))
    .limit(20);
  return publicProfiles;
}

export async function createConnectionRequest(fromUserId: number, toUserId: number, message?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(connectionRequests)
    .where(and(
      eq(connectionRequests.fromUserId, fromUserId),
      eq(connectionRequests.toUserId, toUserId),
      eq(connectionRequests.status, 'pending'),
    )).limit(1);
  if (existing.length > 0) throw new Error("Connection request already sent");
  await db.insert(connectionRequests).values({ fromUserId, toUserId, message: message || null, status: 'pending' } as any);
  return { success: true };
}

export async function acceptConnectionRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const request = await db.select().from(connectionRequests).where(eq(connectionRequests.id, requestId)).limit(1);
  if (request.length === 0) throw new Error("Request not found");
  if (request[0].toUserId !== userId) throw new Error("Unauthorized");
  if (request[0].status !== 'pending') throw new Error("Request already processed");
  await db.update(connectionRequests).set({ status: 'accepted', respondedAt: new Date() } as any).where(eq(connectionRequests.id, requestId));
  const userId1 = Math.min(request[0].fromUserId, request[0].toUserId);
  const userId2 = Math.max(request[0].fromUserId, request[0].toUserId);
  await db.insert(connections).values({ userId1, userId2, status: 'active' } as any);
  return { success: true };
}

export async function rejectConnectionRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const request = await db.select().from(connectionRequests).where(eq(connectionRequests.id, requestId)).limit(1);
  if (request.length === 0) throw new Error("Request not found");
  if (request[0].toUserId !== userId) throw new Error("Unauthorized");
  await db.update(connectionRequests).set({ status: 'rejected', respondedAt: new Date() } as any).where(eq(connectionRequests.id, requestId));
  return { success: true };
}

export async function getUserConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(connections)
    .where(or(eq(connections.userId1, userId), eq(connections.userId2, userId)));
}

export async function getPendingConnectionRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(connectionRequests)
    .where(and(eq(connectionRequests.toUserId, userId), eq(connectionRequests.status, 'pending')))
    .orderBy(desc(connectionRequests.createdAt));
}

export async function blockUser(userId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const userId1 = Math.min(userId, targetUserId);
  const userId2 = Math.max(userId, targetUserId);
  const existing = await db.select().from(connections)
    .where(and(eq(connections.userId1, userId1), eq(connections.userId2, userId2))).limit(1);
  if (existing.length > 0) {
    await db.update(connections).set({ status: 'blocked' } as any)
      .where(and(eq(connections.userId1, userId1), eq(connections.userId2, userId2)));
  } else {
    await db.insert(connections).values({ userId1, userId2, status: 'blocked' } as any);
  }
  return { success: true };
}

// ============ REPORTS & MODERATION ============

export async function createReport(reporterId: number, reportedUserId: number, reason: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reports).values({ reporterId, reportedUserId, reason, description: description || null, status: 'pending' } as any);
  return { success: true };
}

export async function getAllReports() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(reports).orderBy(desc(reports.createdAt));
}

export async function reviewReport(reportId: number, adminId: number, action: 'resolved' | 'dismissed') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reports)
    .set({ status: action, reviewedAt: new Date(), reviewedBy: adminId } as any)
    .where(eq(reports.id, reportId));
  return { success: true };
}

/**
 * FIX: moderateUser now actually updates user status in the database.
 * Previously it only logged the moderation action but never suspended/banned the user.
 */
export async function moderateUser(
  adminId: number,
  targetUserId: number,
  action: string,
  reason: string,
  duration?: number,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Log moderation action
  await db.insert(moderationLogs).values({
    adminId,
    targetUserId,
    action,
    reason,
    duration: duration || null,
  } as any);

  // Actually update user status based on action
  if (action === 'suspend' || action === 'ban') {
    await db.update(users).set({
      status: 'suspended',
      suspendedAt: new Date(),
      suspendReason: reason,
    } as any).where(eq(users.id, targetUserId));
  } else if (action === 'unban') {
    await db.update(users).set({
      status: 'active',
      suspendedAt: null,
      suspendReason: null,
    } as any).where(eq(users.id, targetUserId));
  }
  // 'warning' action: only logs, does not change status

  return { success: true };
}

// ============ MESSAGING ============

export async function getOrCreateConversation(user1Id: number, user2Id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [smallerId, largerId] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
  const existing = await db.select().from(conversations)
    .where(and(eq(conversations.user1Id, smallerId), eq(conversations.user2Id, largerId)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [newConv] = await db.insert(conversations).values({ user1Id: smallerId, user2Id: largerId } as any).$returningId();
  return await db.select().from(conversations).where(eq(conversations.id, newConv.id)).limit(1).then(rows => rows[0]);
}

export async function sendMessage(senderId: number, receiverId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conversation = await getOrCreateConversation(senderId, receiverId);
  await db.insert(messages).values({ conversationId: conversation.id, senderId, receiverId, content, isRead: 0 } as any);
  await db.update(conversations).set({ lastMessageAt: new Date() } as any).where(eq(conversations.id, conversation.id));
  return { success: true, conversationId: conversation.id };
}

export async function getMyConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const convs = await db.select().from(conversations)
    .where(or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId)))
    .orderBy(desc(conversations.lastMessageAt));
  const conversationsWithDetails = await Promise.all(
    convs.map(async (conv) => {
      const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const [otherUser] = await db.select({ id: users.id, name: users.name, email: users.email })
        .from(users).where(eq(users.id, otherUserId)).limit(1);
      const [lastMessage] = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt)).limit(1);
      const unreadCount = await db.select({ count: sql<number>`count(*)` }).from(messages)
        .where(and(eq(messages.conversationId, conv.id), eq(messages.receiverId, userId), eq(messages.isRead, 0)))
        .then(rows => rows[0]?.count || 0);
      return { ...conv, otherUser, lastMessage, unreadCount };
    })
  );
  return conversationsWithDetails;
}

export async function getConversationMessages(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
    throw new Error("Unauthorized access to conversation");
  }
  return await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
}

export async function markMessagesAsRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(messages).set({ isRead: 1 } as any)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.receiverId, userId), eq(messages.isRead, 0)));
  return { success: true };
}

export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(and(eq(messages.receiverId, userId), eq(messages.isRead, 0)));
  return result[0]?.count || 0;
}

// ============ ADMIN USER MANAGEMENT ============

export async function updateUserEmail(userId: number, newEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ email: newEmail } as any).where(eq(users.id, userId));
  return { success: true };
}

export async function updateUserPassword(userId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash } as any).where(eq(users.id, userId));
  return { success: true };
}

export async function updateOwnEmail(userId: number, newEmail: string, currentPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");
  const bcrypt = await import('bcryptjs');
  if (!user.passwordHash) throw new Error("Password authentication not enabled for this user");
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");
  const [existing] = await db.select().from(users).where(eq(users.email, newEmail)).limit(1);
  if (existing && existing.id !== userId) throw new Error("Email already in use");
  await db.update(users).set({ email: newEmail } as any).where(eq(users.id, userId));
  return { success: true };
}

export async function updateOwnPassword(userId: number, currentPassword: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");
  const bcrypt = await import('bcryptjs');
  if (!user.passwordHash) throw new Error("Password authentication not enabled for this user");
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash } as any).where(eq(users.id, userId));
  return { success: true };
}

export async function updateUserData(userId: number, data: { name?: string; email?: string; plan?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.plan !== undefined) updateData.plan = data.plan;
  await db.update(users).set(updateData).where(eq(users.id, userId));
  return { success: true };
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role } as any).where(eq(users.id, userId));
  return { success: true };
}

// ============ WELCOME MESSAGE ============

export async function sendWelcomeMessage(userId: number, userName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const adminUsers = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
  if (adminUsers.length === 0) {
    console.warn("[Welcome Message] No admin user found to send welcome message");
    return { success: false };
  }
  const adminId = adminUsers[0].id;
  const welcomeMessage = `Olá ${userName}! 🌟\n\nSeja muito bem-vindo(a) à plataforma Shadia Hasan!\n\nParabéns pela iniciativa de participar dos nossos programas de transformação e desenvolvimento humano. Você está dando um passo importante em direção ao seu crescimento pessoal e à descoberta do seu verdadeiro potencial.\n\nAqui você encontrará:\n✨ Experiências imersivas em realidade virtual\n🧠 Programas estruturados de autoconhecimento\n💜 Uma comunidade de pessoas na mesma jornada de evolução\n🎯 Ferramentas práticas para sua transformação interior\n\nExplore os programas disponíveis, conecte-se com a comunidade e não hesite em me enviar uma mensagem se tiver qualquer dúvida.\n\nSua jornada de transformação começa agora! 🚀\n\nCom carinho,\nShadia Hasan\nPsicóloga - CRP 12/27052`;
  try {
    await sendMessage(adminId, userId, welcomeMessage);
    return { success: true };
  } catch (error) {
    console.error("[Welcome Message] Failed to send:", error);
    return { success: false };
  }
}

// ============ CUSTOM AUTH ============

import { hashPassword, comparePassword } from "./_core/auth";
import { sendVerificationEmail, sendWelcomeEmail } from "./_core/email";

export async function registerUser(email: string, password: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new Error("Email already registered");
  const passwordHash = await hashPassword(password);
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let referralCode = "";
  for (let i = 0; i < 8; i++) referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
  await db.insert(users).values({ email, passwordHash, name, emailVerified: 0, role: "user", plan: "free", referralCode });
  const [newUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!newUser) throw new Error("Failed to create user");
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({ userId: newUser.id, token, expiresAt });
  await sendVerificationEmail(email, name, token);
  return { userId: newUser.id, email: newUser.email };
}

export async function loginUser(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("Invalid email or password");
  if (!user.passwordHash) throw new Error("Please use social login (Google/Apple)");
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) throw new Error("Invalid email or password");
  return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan };
}

export async function verifyEmail(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [verificationToken] = await db.select().from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token)).limit(1);
  if (!verificationToken) throw new Error("Invalid or expired verification token");
  if (new Date() > verificationToken.expiresAt) throw new Error("Verification token has expired");
  const [user] = await db.select().from(users).where(eq(users.id, verificationToken.userId)).limit(1);
  if (!user) throw new Error("User not found");
  await db.update(users).set({ emailVerified: 1 }).where(eq(users.id, user.id));
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
  await sendWelcomeEmail(user.email, user.name || "");
  return { email: user.email, name: user.name };
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user || null;
}

export async function requestPasswordReset(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalizedEmail = email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!user || !user.passwordHash) return { success: true };
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
  await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
  const { sendPasswordResetEmail } = await import("./_core/email");
  await sendPasswordResetEmail(email, user.name || "", token);
  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [resetToken] = await db.select().from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token)).limit(1);
  if (!resetToken) throw new Error("Invalid or expired reset token");
  if (new Date() > resetToken.expiresAt) throw new Error("Reset token has expired");
  if (resetToken.used) throw new Error("Reset token has already been used");
  const [user] = await db.select().from(users).where(eq(users.id, resetToken.userId)).limit(1);
  if (!user) throw new Error("User not found");
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  await db.update(passwordResetTokens).set({ used: 1 }).where(eq(passwordResetTokens.token, token));
  return { success: true, email: user.email };
}

// ============ COURSE PURCHASES ============

export async function createCoursePurchase(purchase: { userId: number; courseId: number; amount: number; currency?: string; stripePaymentIntentId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { coursePurchases } = await import("../drizzle/schema");
  const result = await db.insert(coursePurchases).values({ ...purchase, status: "pending" });
  return result[0]?.id;
}

export async function updateCoursePurchaseStatus(id: number, status: "pending" | "completed" | "failed" | "refunded") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { coursePurchases } = await import("../drizzle/schema");
  await db.update(coursePurchases).set({ status }).where(eq(coursePurchases.id, id));
}

export async function getUserCoursePurchases(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { coursePurchases } = await import("../drizzle/schema");
  return await db.select().from(coursePurchases).where(eq(coursePurchases.userId, userId));
}

export async function hasUserPurchasedCourse(userId: number, courseId: number) {
  const db = await getDb();
  if (!db) return false;
  const { coursePurchases } = await import("../drizzle/schema");
  const result = await db.select().from(coursePurchases)
    .where(and(eq(coursePurchases.userId, userId), eq(coursePurchases.courseId, courseId), eq(coursePurchases.status, "completed")))
    .limit(1);
  return result.length > 0;
}

export async function getCoursePurchaseByStripePaymentIntent(stripePaymentIntentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const { coursePurchases } = await import("../drizzle/schema");
  const result = await db.select().from(coursePurchases)
    .where(eq(coursePurchases.stripePaymentIntentId, stripePaymentIntentId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ OAUTH ============

export async function findOrCreateUserByProvider(data: { provider: 'google' | 'apple'; providerId: string; email: string; name: string }) {
  const normalizedEmail = data.email.toLowerCase().trim();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existingUser = await getUserByEmail(normalizedEmail);
  if (existingUser) {
    if (existingUser.loginMethod === 'email') {
      await db.update(users).set({ loginMethod: data.provider, emailVerified: 1, lastSignedIn: new Date() }).where(eq(users.id, existingUser.id));
    } else {
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, existingUser.id));
    }
    return existingUser;
  }
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let referralCode = "";
  for (let i = 0; i < 8; i++) referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
  const result = await db.insert(users).values({
    email: normalizedEmail, name: data.name, loginMethod: data.provider,
    emailVerified: 1, role: 'user', plan: 'free', referralCode, lastSignedIn: new Date(),
  });
  const newUser = await getUserById(result[0]?.id);
  if (!newUser) throw new Error("Failed to create user");
  return newUser;
}

// ============ ADMIN MANAGEMENT ============

export async function getAdminPermissions(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [permissions] = await db.select().from(adminPermissions).where(eq(adminPermissions.userId, userId));
  return permissions || null;
}

export async function listAllAdmins() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, permissions: adminPermissions,
  }).from(users).leftJoin(adminPermissions, eq(users.id, adminPermissions.userId)).where(eq(users.role, 'admin'));
}

export async function addNewAdmin(email: string, name: string, permissions: { manageCourses: boolean; manageStudents: boolean; manageContent: boolean; manageAdmins: boolean; manageSettings: boolean; viewAnalytics: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  let userId: number;
  if (existingUser) {
    if (existingUser.role === 'admin') throw new Error('User is already an admin');
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, existingUser.id));
    userId = existingUser.id;
  } else {
    const [newUser] = await db.insert(users).values({ email, name, role: 'admin', emailVerified: 0, loginMethod: 'email' }).returning({ id: users.id });
    userId = newUser.id;
  }
  await db.insert(adminPermissions).values({
    userId,
    manageCourses: permissions.manageCourses ? 1 : 0,
    manageStudents: permissions.manageStudents ? 1 : 0,
    manageContent: permissions.manageContent ? 1 : 0,
    manageAdmins: permissions.manageAdmins ? 1 : 0,
    manageSettings: permissions.manageSettings ? 1 : 0,
    viewAnalytics: permissions.viewAnalytics ? 1 : 0,
  });
  return { success: true, userId };
}

export async function updateAdminPermissions(userId: number, permissions: { manageCourses: boolean; manageStudents: boolean; manageContent: boolean; manageAdmins: boolean; manageSettings: boolean; viewAnalytics: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.role !== 'admin') throw new Error('User is not an admin');
  await db.update(adminPermissions).set({
    manageCourses: permissions.manageCourses ? 1 : 0,
    manageStudents: permissions.manageStudents ? 1 : 0,
    manageContent: permissions.manageContent ? 1 : 0,
    manageAdmins: permissions.manageAdmins ? 1 : 0,
    manageSettings: permissions.manageSettings ? 1 : 0,
    viewAnalytics: permissions.viewAnalytics ? 1 : 0,
  }).where(eq(adminPermissions.userId, userId));
  return { success: true };
}

export async function removeAdmin(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role: 'user' }).where(eq(users.id, userId));
  await db.delete(adminPermissions).where(eq(adminPermissions.userId, userId));
  return { success: true };
}

export async function updateAdminEmail(userId: number, newEmail: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');
  if (user.passwordHash) {
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new Error('Invalid password');
  }
  const [existing] = await db.select().from(users).where(eq(users.email, newEmail));
  if (existing && existing.id !== userId) throw new Error('Email already in use');
  await db.update(users).set({ email: newEmail, emailVerified: 0 }).where(eq(users.id, userId));
  return { success: true };
}

// ============ SUBSCRIPTIONS MANAGEMENT ============

export async function getAllSubscriptions() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({ subscription: subscriptions, user: { id: users.id, name: users.name, email: users.email } })
    .from(subscriptions).leftJoin(users, eq(subscriptions.userId, users.id)).orderBy(desc(subscriptions.createdAt));
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  return subscription || null;
}

export async function upsertSubscription(data: { userId: number; plan: string; status: string; startDate?: Date; endDate?: Date | null; trialEndDate?: Date | null; autoRenew?: number; stripeSubscriptionId?: string | null; stripePriceId?: string | null; stripeCustomerId?: string | null; notes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSubscriptionByUserId(data.userId);
  if (existing) {
    await db.update(subscriptions).set({ plan: data.plan as any, status: data.status as any, endDate: data.endDate, trialEndDate: data.trialEndDate, autoRenew: data.autoRenew ?? existing.autoRenew, stripeSubscriptionId: data.stripeSubscriptionId, stripePriceId: data.stripePriceId, stripeCustomerId: data.stripeCustomerId, notes: data.notes }).where(eq(subscriptions.id, existing.id));
    return { id: existing.id, isNew: false };
  } else {
    const [result] = await db.insert(subscriptions).values({ userId: data.userId, plan: data.plan as any, status: data.status as any, startDate: data.startDate || new Date(), endDate: data.endDate, trialEndDate: data.trialEndDate, autoRenew: data.autoRenew ?? 1, stripeSubscriptionId: data.stripeSubscriptionId, stripePriceId: data.stripePriceId, stripeCustomerId: data.stripeCustomerId, notes: data.notes });
    return { id: result[0]?.id, isNew: true };
  }
}

export async function updateSubscriptionStatus(subscriptionId: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(subscriptions).set({ status: status as any }).where(eq(subscriptions.id, subscriptionId));
  return { success: true };
}

export async function getPaymentHistoryByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(paymentHistory).where(eq(paymentHistory.userId, userId)).orderBy(desc(paymentHistory.createdAt));
}

export async function getAllPaymentHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({ payment: paymentHistory, user: { id: users.id, name: users.name, email: users.email } })
    .from(paymentHistory).leftJoin(users, eq(paymentHistory.userId, users.id)).orderBy(desc(paymentHistory.createdAt));
}

export async function createPaymentRecord(data: { userId: number; subscriptionId?: number | null; amount: number; currency?: string; status: string; paymentMethod?: string | null; stripePaymentIntentId?: string | null; stripeInvoiceId?: string | null; description?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(paymentHistory).values({ userId: data.userId, subscriptionId: data.subscriptionId, amount: data.amount, currency: data.currency || "BRL", status: data.status as any, paymentMethod: data.paymentMethod, stripePaymentIntentId: data.stripePaymentIntentId, stripeInvoiceId: data.stripeInvoiceId, description: data.description });
  return { id: result[0]?.id };
}

// ============ REFERRALS ============

export async function generateReferralCode(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "", isUnique = false;
  while (!isUnique) {
    code = "";
    for (let i = 0; i < 8; i++) code += characters.charAt(Math.floor(Math.random() * characters.length));
    const existing = await db.select().from(users).where(eq(users.referralCode, code)).limit(1);
    if (existing.length === 0) isUnique = true;
  }
  await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
  return code;
}

export async function getUserByReferralCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.referralCode, code)).limit(1);
  return user || null;
}

export async function getReferralsByReferrerId(referrerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(referrals).where(eq(referrals.referrerId, referrerId)).orderBy(desc(referrals.createdAt));
}

export async function getMonthlyReferralCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const result = await db.select().from(referrals)
    .where(and(eq(referrals.referrerId, userId), eq(referrals.status, "confirmed"), gte(referrals.confirmedAt, startOfMonth)));
  return result.length;
}

export async function createReferral(data: { referrerId: number; referredUserId?: number; referralCode: string; status?: string; planPurchased?: string; pointsAwarded?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(referrals).values({ referrerId: data.referrerId, referredUserId: data.referredUserId, referralCode: data.referralCode, status: (data.status as any) || "pending", planPurchased: data.planPurchased as any, pointsAwarded: data.pointsAwarded || 0 });
  return { id: result[0]?.id };
}

export async function confirmReferral(referralId: number, planPurchased: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [referral] = await db.select().from(referrals).where(eq(referrals.id, referralId)).limit(1);
  if (!referral) throw new Error("Referral not found");
  const pointsConfig: Record<string, number> = { basic: 100, premium: 200, vip: 600 };
  const basePoints = pointsConfig[planPurchased.toLowerCase()] || 0;
  const monthlyCount = await getMonthlyReferralCount(referral.referrerId);
  let bonusPoints = 0;
  if (monthlyCount >= 5) bonusPoints = 250;
  else if (monthlyCount === 4) bonusPoints = 200;
  else if (monthlyCount === 3) bonusPoints = 150;
  const totalPoints = basePoints + bonusPoints;
  await db.update(referrals).set({ status: "confirmed", planPurchased: planPurchased as any, pointsAwarded: totalPoints, confirmedAt: new Date() }).where(eq(referrals.id, referralId));
  await updateUserPoints(referral.referrerId, totalPoints);
  await createPointsTransaction({ userId: referral.referrerId, amount: totalPoints, type: "referral_bonus", description: `Referral confirmed - ${planPurchased} plan (${basePoints} base + ${bonusPoints} bonus)`, referralId });
  const updatedMonthlyCount = await getMonthlyReferralCount(referral.referrerId);
  if (updatedMonthlyCount % 2 === 0) await grantFreeMonth(referral.referrerId);
  return { pointsAwarded: totalPoints, bonusPoints };
}

export async function updateUserPoints(userId: number, pointsDelta: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select({ pointsBalance: users.pointsBalance }).from(users).where(eq(users.id, userId)).limit(1);
  const currentBalance = user?.pointsBalance || 0;
  const newBalance = Math.max(0, currentBalance + pointsDelta);
  await db.update(users).set({ pointsBalance: newBalance }).where(eq(users.id, userId));
  return newBalance;
}

export async function getUserByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId)).limit(1);
  return user || null;
}

export async function incrementFreeMonths(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select({ freeMonthsRemaining: users.freeMonthsRemaining }).from(users).where(eq(users.id, userId)).limit(1);
  const newVal = (user?.freeMonthsRemaining || 0) + 1;
  await db.update(users).set({ freeMonthsRemaining: newVal }).where(eq(users.id, userId));
  return newVal;
}

export async function grantFreeMonth(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select({ freeMonthsRemaining: users.freeMonthsRemaining }).from(users).where(eq(users.id, userId)).limit(1);
  const newVal = (user?.freeMonthsRemaining || 0) + 1;
  await db.update(users).set({ freeMonthsRemaining: newVal }).where(eq(users.id, userId));
  await createPointsTransaction({ userId, amount: 0, type: "free_month_applied", description: "Free month earned from 2 referrals" });
  return newVal;
}

export async function createPointsTransaction(data: { userId: number; amount: number; type: string; description?: string; referralId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(pointsTransactions).values({ userId: data.userId, amount: data.amount, type: data.type as any, description: data.description, referralId: data.referralId });
  return { id: result[0]?.id };
}

export async function getPointsTransactionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(pointsTransactions).where(eq(pointsTransactions.userId, userId)).orderBy(desc(pointsTransactions.createdAt)).limit(50);
}

export async function createCashbackRequest(data: { userId: number; pointsAmount: number; cashAmount: number; paymentMethod: string; pixKey?: string; bankDetails?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(cashbackRequests).values({ userId: data.userId, pointsAmount: data.pointsAmount, cashAmount: data.cashAmount, paymentMethod: data.paymentMethod as any, pixKey: data.pixKey, bankDetails: data.bankDetails, status: "pending" });
  return result[0]?.id;
}

export async function getAllCashbackRequests(status?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (status) return await db.select().from(cashbackRequests).where(eq(cashbackRequests.status, status as any)).orderBy(desc(cashbackRequests.createdAt));
  return await db.select().from(cashbackRequests).orderBy(desc(cashbackRequests.createdAt));
}

export async function getCashbackRequestById(requestId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(cashbackRequests).where(eq(cashbackRequests.id, requestId));
  return request;
}

export async function updateCashbackRequestStatus(requestId: number, status: string, adminId: number, adminNotes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(cashbackRequests).where(eq(cashbackRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Cashback request not found");
  if (status === "rejected") {
    await updateUserPoints(request.userId, request.pointsAmount);
    await createPointsTransaction({ userId: request.userId, amount: request.pointsAmount, type: "admin_adjustment", description: `Cashback request #${requestId} rejected - points refunded` });
  }
  await db.update(cashbackRequests).set({ status: status as any, processedAt: new Date(), processedBy: adminId, adminNotes }).where(eq(cashbackRequests.id, requestId));
  return { success: true };
}

// ============ ADMIN AUDIT & MANAGEMENT ============

export async function logAdminAction(data: { action: "PROMOTE_ADMIN" | "DEMOTE_ADMIN" | "PROMOTE_SUPERADMIN" | "DEMOTE_SUPERADMIN"; performedByUserId: number; targetUserId: number; ip?: string; userAgent?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  await db.insert(adminAuditLogs).values(data);
}

export async function getAdminAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return await db.select({
    id: adminAuditLogs.id, action: adminAuditLogs.action,
    performedByUserId: adminAuditLogs.performedByUserId, performedByName: users.name, performedByEmail: users.email,
    targetUserId: adminAuditLogs.targetUserId,
    targetName: sql<string>`target.name`, targetEmail: sql<string>`target.email`,
    ip: adminAuditLogs.ip, userAgent: adminAuditLogs.userAgent, createdAt: adminAuditLogs.createdAt,
  }).from(adminAuditLogs)
    .leftJoin(users, eq(adminAuditLogs.performedByUserId, users.id))
    .leftJoin(sql`users as target`, sql`${adminAuditLogs.targetUserId} = target.id`)
    .orderBy(desc(adminAuditLogs.createdAt)).limit(limit);
}

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
  if (targetUser?.role === "superadmin" && superadmins.length === 1) throw new Error("Cannot demote the last superadmin");
  await db.update(users).set({ role: "user" }).where(eq(users.id, targetUserId));
  await logAdminAction({ action: targetUser?.role === "superadmin" ? "DEMOTE_SUPERADMIN" : "DEMOTE_ADMIN", performedByUserId, targetUserId, ip, userAgent });
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
  return await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn })
    .from(users).where(or(eq(users.role, "admin"), eq(users.role, "superadmin"))).orderBy(desc(users.createdAt));
}

export async function countSuperAdmins() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "superadmin"));
  return result[0]?.count || 0;
}

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
  const result = await db.insert(adminInvites).values({ email, role, token, expiresAt, invitedBy });
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
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);
  const userResult = await db.insert(users).values({ email: invite.email, name, passwordHash, role: invite.role, emailVerified: 1, loginMethod: "email" });
  const userId = userResult[0]?.id;
  await db.update(adminInvites).set({ acceptedAt: new Date() }).where(eq(adminInvites.id, invite.id));
  await logAdminAction({ action: invite.role === "superadmin" ? "PROMOTE_SUPERADMIN" : "PROMOTE_ADMIN", performedByUserId: invite.invitedBy, targetUserId: userId });
  return await getUserById(userId);
}

export async function listAdminInvites() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return await db.select({
    id: adminInvites.id, email: adminInvites.email, role: adminInvites.role,
    expiresAt: adminInvites.expiresAt, acceptedAt: adminInvites.acceptedAt, createdAt: adminInvites.createdAt,
    invitedByName: users.name, invitedByEmail: users.email,
  }).from(adminInvites).leftJoin(users, eq(adminInvites.invitedBy, users.id)).orderBy(desc(adminInvites.createdAt));
}

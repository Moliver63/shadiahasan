import { eq, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

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
    
    // Handle email separately since it's required
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

    // Check if user is new (doesn't exist yet)
    const existingUser = user.openId 
      ? await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
      : await db.select().from(users).where(eq(users.email, user.email!)).limit(1);
    const isNewUser = existingUser.length === 0;
    
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
    
    // Send welcome message to new users
    if (isNewUser && user.name) {
      // Get the newly created user ID
      const newUser = user.openId
        ? await db.select().from(users).where(eq(users.openId, user.openId)).limit(1)
        : await db.select().from(users).where(eq(users.email, user.email!)).limit(1);
      if (newUser.length > 0) {
        // Send welcome message asynchronously (don't wait)
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

import { courses, courseModules, lessons, enrollments, Course, CourseModule, Lesson, Enrollment, InsertCourse, InsertCourseModule, InsertLesson, InsertEnrollment } from "../drizzle/schema";
import { desc, and, sql } from "drizzle-orm";

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
  
  // Delete related lessons and enrollments first
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
  return await db.select().from(lessons)
    .where(eq(lessons.courseId, courseId))
    .orderBy(lessons.order);
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

import { subscriptionPlans, userSubscriptions, SubscriptionPlan, UserSubscription, InsertSubscriptionPlan, InsertUserSubscription } from "../drizzle/schema";

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
  return result[0].insertId;
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
  
  return await db.select().from(subscriptionPlans); // Include inactive for admin
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

import { courseReviews, CourseReview, InsertCourseReview } from "../drizzle/schema";

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

import { ebooks, Ebook, InsertEbook } from "../drizzle/schema";

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

import { userBadges, UserBadge, InsertUserBadge } from "../drizzle/schema";

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
  
  // Check if user already has this badge
  const existing = await db.select().from(userBadges)
    .where(and(eq(userBadges.userId, badge.userId), eq(userBadges.badgeType, badge.badgeType)))
    .limit(1);
  
  if (existing.length === 0) {
    await db.insert(userBadges).values(badge);
  }
}

// ============ CERTIFICATES ============

import { certificates, Certificate, InsertCertificate } from "../drizzle/schema";

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

export async function getAllEnrollments() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(enrollments);
}

// ============ USER PROFILES ============

import { userProfiles, UserProfile, InsertUserProfile } from "../drizzle/schema";

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
  
  // Check if profile exists
  const existing = await getUserProfile(userId);
  
  if (!existing) {
    // Create new profile
    await db.insert(userProfiles).values({
      userId,
      ...data,
      isPublic: data.isPublic ? 1 : 0,
      showCity: data.showCity ? 1 : 0,
      interests: data.interests ? JSON.stringify(data.interests) : null,
      goals: data.goals ? JSON.stringify(data.goals) : null,
    } as any);
  } else {
    // Update existing profile
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
  
  // Also get user basic info
  const userResult = await db.select().from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (userResult.length === 0) return null;
  
  return {
    ...result[0],
    user: userResult[0],
  };
}

// ============ CONNECTIONS ============

import { connections, Connection, InsertConnection, connectionRequests, ConnectionRequest, InsertConnectionRequest } from "../drizzle/schema";

export async function getConnectionSuggestions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get public profiles excluding self and existing connections
  const publicProfiles = await db.select().from(userProfiles)
    .where(and(eq(userProfiles.isPublic, 1), ne(userProfiles.userId, userId)))
    .limit(20);
  
  // TODO: Implement smart matching based on common courses/interests
  // For now, return random public profiles
  return publicProfiles;
}

export async function createConnectionRequest(fromUserId: number, toUserId: number, message?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if request already exists
  const existing = await db.select().from(connectionRequests)
    .where(and(
      eq(connectionRequests.fromUserId, fromUserId),
      eq(connectionRequests.toUserId, toUserId),
      eq(connectionRequests.status, 'pending')
    ))
    .limit(1);
  
  if (existing.length > 0) {
    throw new Error("Connection request already sent");
  }
  
  await db.insert(connectionRequests).values({
    fromUserId,
    toUserId,
    message: message || null,
    status: 'pending',
  } as any);
  
  return { success: true };
}

export async function acceptConnectionRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get request
  const request = await db.select().from(connectionRequests)
    .where(eq(connectionRequests.id, requestId))
    .limit(1);
  
  if (request.length === 0) throw new Error("Request not found");
  if (request[0].toUserId !== userId) throw new Error("Unauthorized");
  if (request[0].status !== 'pending') throw new Error("Request already processed");
  
  // Update request status
  await db.update(connectionRequests)
    .set({ status: 'accepted', respondedAt: new Date() } as any)
    .where(eq(connectionRequests.id, requestId));
  
  // Create connection (store with lower ID first for consistency)
  const userId1 = Math.min(request[0].fromUserId, request[0].toUserId);
  const userId2 = Math.max(request[0].fromUserId, request[0].toUserId);
  
  await db.insert(connections).values({
    userId1,
    userId2,
    status: 'active',
  } as any);
  
  return { success: true };
}

export async function rejectConnectionRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get request
  const request = await db.select().from(connectionRequests)
    .where(eq(connectionRequests.id, requestId))
    .limit(1);
  
  if (request.length === 0) throw new Error("Request not found");
  if (request[0].toUserId !== userId) throw new Error("Unauthorized");
  
  // Update request status
  await db.update(connectionRequests)
    .set({ status: 'rejected', respondedAt: new Date() } as any)
    .where(eq(connectionRequests.id, requestId));
  
  return { success: true };
}

export async function getUserConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get connections where user is either userId1 or userId2
  const userConnections = await db.select().from(connections)
    .where(or(eq(connections.userId1, userId), eq(connections.userId2, userId)));
  
  return userConnections;
}

export async function getPendingConnectionRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get requests sent to this user
  return await db.select().from(connectionRequests)
    .where(and(eq(connectionRequests.toUserId, userId), eq(connectionRequests.status, 'pending')))
    .orderBy(desc(connectionRequests.createdAt));
}

export async function blockUser(userId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Find existing connection
  const userId1 = Math.min(userId, targetUserId);
  const userId2 = Math.max(userId, targetUserId);
  
  const existing = await db.select().from(connections)
    .where(and(eq(connections.userId1, userId1), eq(connections.userId2, userId2)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update to blocked
    await db.update(connections)
      .set({ status: 'blocked' } as any)
      .where(and(eq(connections.userId1, userId1), eq(connections.userId2, userId2)));
  } else {
    // Create blocked connection
    await db.insert(connections).values({
      userId1,
      userId2,
      status: 'blocked',
    } as any);
  }
  
  return { success: true };
}

// ============ REPORTS & MODERATION ============

import { reports, Report, InsertReport, moderationLogs, ModerationLog, InsertModerationLog } from "../drizzle/schema";
import { conversations, Conversation, InsertConversation, messages, Message, InsertMessage } from "../drizzle/schema";

export async function createReport(reporterId: number, reportedUserId: number, reason: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(reports).values({
    reporterId,
    reportedUserId,
    reason,
    description: description || null,
    status: 'pending',
  } as any);
  
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
    .set({ 
      status: action, 
      reviewedAt: new Date(),
      reviewedBy: adminId 
    } as any)
    .where(eq(reports.id, reportId));
  
  return { success: true };
}

export async function moderateUser(adminId: number, targetUserId: number, action: string, reason: string, duration?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(moderationLogs).values({
    adminId,
    targetUserId,
    action,
    reason,
    duration: duration || null,
  } as any);
  
  // TODO: Implement actual user suspension/ban logic
  // This could involve adding a 'status' field to users table
  
  return { success: true };
}

// ============================================
// MESSAGING FUNCTIONS
// ============================================

export async function getOrCreateConversation(user1Id: number, user2Id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Ensure consistent ordering (smaller ID first)
  const [smallerId, largerId] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
  
  // Try to find existing conversation
  const existing = await db.select().from(conversations)
    .where(
      and(
        eq(conversations.user1Id, smallerId),
        eq(conversations.user2Id, largerId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create new conversation
  const [newConv] = await db.insert(conversations).values({
    user1Id: smallerId,
    user2Id: largerId,
  } as any).$returningId();
  
  return await db.select().from(conversations)
    .where(eq(conversations.id, newConv.id))
    .limit(1)
    .then(rows => rows[0]);
}

export async function sendMessage(senderId: number, receiverId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get or create conversation
  const conversation = await getOrCreateConversation(senderId, receiverId);
  
  // Insert message
  await db.insert(messages).values({
    conversationId: conversation.id,
    senderId,
    receiverId,
    content,
    isRead: 0,
  } as any);
  
  // Update conversation's lastMessageAt
  await db.update(conversations)
    .set({ lastMessageAt: new Date() } as any)
    .where(eq(conversations.id, conversation.id));
  
  return { success: true, conversationId: conversation.id };
}

export async function getMyConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const convs = await db.select().from(conversations)
    .where(
      or(
        eq(conversations.user1Id, userId),
        eq(conversations.user2Id, userId)
      )
    )
    .orderBy(desc(conversations.lastMessageAt));
  
  // For each conversation, get the other user's info and last message
  const conversationsWithDetails = await Promise.all(
    convs.map(async (conv) => {
      const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      
      const [otherUser] = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
      }).from(users).where(eq(users.id, otherUserId)).limit(1);
      
      const [lastMessage] = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      
      const unreadCount = await db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            eq(messages.receiverId, userId),
            eq(messages.isRead, 0)
          )
        )
        .then(rows => rows[0]?.count || 0);
      
      return {
        ...conv,
        otherUser,
        lastMessage,
        unreadCount,
      };
    })
  );
  
  return conversationsWithDetails;
}

export async function getConversationMessages(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Verify user is part of this conversation
  const [conv] = await db.select().from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  
  if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
    throw new Error("Unauthorized access to conversation");
  }
  
  return await db.select().from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function markMessagesAsRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(messages)
    .set({ isRead: 1 } as any)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.receiverId, userId),
        eq(messages.isRead, 0)
      )
    );
  
  return { success: true };
}

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

export async function updateUserEmail(userId: number, newEmail: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({ email: newEmail } as any)
    .where(eq(users.id, userId));
  
  return { success: true };
}

export async function updateUserPassword(userId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  await db.update(users)
    .set({ passwordHash } as any)
    .where(eq(users.id, userId));
  
  return { success: true };
}

export async function updateUserData(userId: number, data: { name?: string; email?: string; plan?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.plan !== undefined) updateData.plan = data.plan;
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  return { success: true };
}

// ============================================
// WELCOME MESSAGE
// ============================================

export async function sendWelcomeMessage(userId: number, userName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get admin user (owner)
  const adminUsers = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
  
  if (adminUsers.length === 0) {
    console.warn("[Welcome Message] No admin user found to send welcome message");
    return { success: false };
  }
  
  const adminId = adminUsers[0].id;
  
  const welcomeMessage = `Olá ${userName}! 🌟

Seja muito bem-vindo(a) à plataforma Shadia Hasan!

Parabéns pela iniciativa de participar dos nossos programas de transformação e desenvolvimento humano. Você está dando um passo importante em direção ao seu crescimento pessoal e à descoberta do seu verdadeiro potencial.

Aqui você encontrará:
✨ Experiências imersivas em realidade virtual
🧠 Programas estruturados de autoconhecimento
💜 Uma comunidade de pessoas na mesma jornada de evolução
🎯 Ferramentas práticas para sua transformação interior

Explore os programas disponíveis, conecte-se com a comunidade e não hesite em me enviar uma mensagem se tiver qualquer dúvida.

Sua jornada de transformação começa agora! 🚀

Com carinho,
Shadia Hasan
Psicóloga - CRP 12/27052`;
  
  try {
    await sendMessage(adminId, userId, welcomeMessage);
    return { success: true };
  } catch (error) {
    console.error("[Welcome Message] Failed to send:", error);
    return { success: false };
  }
}

export async function getUnreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.receiverId, userId),
        eq(messages.isRead, 0)
      )
    );
  
  return result[0]?.count || 0;
}

// ============================================
// Custom Authentication Functions
// ============================================

import { hashPassword, comparePassword } from "./_core/auth";
import { sendVerificationEmail, sendWelcomeEmail } from "./_core/email";
import { emailVerificationTokens, passwordResetTokens } from "../drizzle/schema";

/**
 * Register a new user with email and password
 */
export async function registerUser(email: string, password: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  await db.insert(users).values({
    email,
    passwordHash,
    name,
    emailVerified: 0,
    role: "user",
    plan: "free",
  });
  
  // Get the newly created user
  const [newUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!newUser) throw new Error("Failed to create user");

  // Generate verification token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(emailVerificationTokens).values({
    userId: newUser.id,
    token,
    expiresAt,
  });

  // Send verification email
  await sendVerificationEmail(email, name, token);

  return { userId: newUser.id, email: newUser.email };
}

/**
 * Login user with email and password
 */
export async function loginUser(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Check if user has password (might be OAuth-only user)
  if (!user.passwordHash) {
    throw new Error("Please use social login (Google/Apple)");
  }

  // Verify password
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  // Check if email is verified
  if (!user.emailVerified) {
    throw new Error("Please verify your email before logging in");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
  };
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find token
  const [verificationToken] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);

  if (!verificationToken) {
    throw new Error("Invalid or expired verification token");
  }

  // Check if expired
  if (new Date() > verificationToken.expiresAt) {
    throw new Error("Verification token has expired");
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, verificationToken.userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  // Mark email as verified
  await db.update(users).set({ emailVerified: 1 }).where(eq(users.id, user.id));

  // Delete used token
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));

  // Send welcome email
  await sendWelcomeEmail(user.email, user.name || "");

  return { email: user.email, name: user.name };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user || null;
}

/**
 * Request password reset - sends email with reset token
 */
export async function requestPasswordReset(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    // Don't reveal if email exists or not (security)
    return { success: true };
  }

  // Generate reset token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete any existing tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

  // Create new token
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  // Send reset email
  const { sendPasswordResetEmail } = await import("./_core/email");
  await sendPasswordResetEmail(email, user.name || "", token);

  return { success: true };
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find token
  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!resetToken) {
    throw new Error("Invalid or expired reset token");
  }

  // Check if expired
  if (new Date() > resetToken.expiresAt) {
    throw new Error("Reset token has expired");
  }

  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, resetToken.userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  // Delete used token
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));

  return { success: true, email: user.email };
}

// ==================== COURSE MANAGEMENT ====================

/**
 * Get all courses

// ==================== MODULE MANAGEMENT ====================

/**
 * Get modules by course ID
 */
export async function getModulesByCourseId(courseId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(courseModules).where(eq(courseModules.courseId, courseId)).orderBy(courseModules.order);
}

/**
 * Get module by ID
 */
export async function getModuleById(moduleId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(courseModules).where(eq(courseModules.id, moduleId));
  return result[0] || null;
}

/**
 * Create module
 */
export async function createModule(data: InsertCourseModule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(courseModules).values(data);
  return { id: Number(result[0].insertId), ...data };
}

/**
 * Update module
 */
export async function updateModule(moduleId: number, data: Partial<InsertCourseModule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(courseModules).set(data).where(eq(courseModules.id, moduleId));
  return { success: true };
}

/**
 * Delete module
 */
export async function deleteModule(moduleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(courseModules).where(eq(courseModules.id, moduleId));
  return { success: true };
}

/**
 * Get lessons by module ID
 */
export async function getLessonsByModuleId(moduleId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(lessons).where(eq(lessons.moduleId, moduleId)).orderBy(lessons.order);
}

// ============ COURSE PURCHASES ============

export async function createCoursePurchase(purchase: { userId: number; courseId: number; amount: number; currency?: string; stripePaymentIntentId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { coursePurchases } = await import("../drizzle/schema");
  const result = await db.insert(coursePurchases).values({
    ...purchase,
    status: "pending",
  });
  return result[0].insertId;
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
    .where(and(
      eq(coursePurchases.userId, userId),
      eq(coursePurchases.courseId, courseId),
      eq(coursePurchases.status, "completed")
    ))
    .limit(1);
  return result.length > 0;
}

export async function getCoursePurchaseByStripePaymentIntent(stripePaymentIntentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { coursePurchases } = await import("../drizzle/schema");
  const result = await db.select().from(coursePurchases)
    .where(eq(coursePurchases.stripePaymentIntentId, stripePaymentIntentId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) - optional for OAuth users */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** Password hash (bcrypt) - only for email/password users */
  passwordHash: varchar("passwordHash", { length: 255 }),
  /** Email verification status */
  emailVerified: int("emailVerified").default(0).notNull(),
  /** OAuth provider: 'email', 'google', 'apple' */
  loginMethod: varchar("loginMethod", { length: 64 }).default("email").notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "premium"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Courses table - stores course information
 */
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  instructorId: int("instructorId").notNull(),
  price: int("price"), // Price in cents for standalone purchase (null = not available for purchase)
  isPublished: int("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * Course modules table - organizes lessons into sections
 */
export const courseModules = mysqlTable("course_modules", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  order: int("order").notNull(),
  isPublished: int("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseModule = typeof courseModules.$inferSelect;
export type InsertCourseModule = typeof courseModules.$inferInsert;

/**
 * Lessons table - stores individual lessons within courses
 */
export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  moduleId: int("moduleId"),
  title: varchar("title", { length: 255 }).notNull(),
  order: int("order").notNull(),
  description: text("description"),
  videoProvider: varchar("videoProvider", { length: 50 }),
  videoAssetId: varchar("videoAssetId", { length: 255 }),
  videoPlaybackUrl: text("videoPlaybackUrl"),
  duration: int("duration"),
  isPublished: int("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

/**
 * Enrollments table - tracks user enrollments in courses
 */
export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  progress: int("progress").default(0).notNull(),
  completedLessons: text("completedLessons"),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().onUpdateNow().notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

/**
 * Subscription Plans table - defines available subscription tiers
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  price: int("price").notNull(), // Price in cents
  interval: mysqlEnum("interval", ["month", "year"]).notNull(),
  features: text("features"), // JSON string of features
  maxCourses: int("maxCourses"), // null = unlimited
  hasVRAccess: int("hasVRAccess").default(0).notNull(),
  hasLiveSupport: int("hasLiveSupport").default(0).notNull(),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * User Subscriptions table - tracks active user subscriptions
 * Stores only essential Stripe identifiers as per best practices
 */
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  planId: int("planId").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  status: mysqlEnum("status", ["active", "canceled", "past_due", "trialing"]).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: int("cancelAtPeriodEnd").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

/**
 * Course Reviews table - stores student reviews and ratings
 */
export const courseReviews = mysqlTable("course_reviews", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  userId: int("userId").notNull(),
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CourseReview = typeof courseReviews.$inferSelect;
export type InsertCourseReview = typeof courseReviews.$inferInsert;

/**
 * Ebooks table - stores downloadable PDF materials
 */
export const ebooks = mysqlTable("ebooks", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  thumbnail: text("thumbnail"),
  courseId: int("courseId"), // Optional: link to course
  isPublished: int("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Ebook = typeof ebooks.$inferSelect;
export type InsertEbook = typeof ebooks.$inferInsert;

/**
 * User Badges table - gamification achievements
 */
export const userBadges = mysqlTable("user_badges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  badgeType: varchar("badgeType", { length: 100 }).notNull(), // e.g., "first_course", "5_courses", "perfect_score"
  badgeName: varchar("badgeName", { length: 255 }).notNull(),
  badgeDescription: text("badgeDescription"),
  badgeIcon: text("badgeIcon"),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

/**
 * Certificates table - course completion certificates
 */
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  certificateNumber: varchar("certificateNumber", { length: 100 }).notNull().unique(),
  pdfUrl: text("pdfUrl"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

/**
 * User Profiles table - extended public profile information for community
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  bio: text("bio"),
  city: varchar("city", { length: 100 }),
  interests: text("interests"), // JSON array of interests
  goals: text("goals"), // JSON array of development goals
  isPublic: int("isPublic").default(0).notNull(), // Opt-in for community visibility
  showCity: int("showCity").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Connections table - tracks connections between users
 */
export const connections = mysqlTable("connections", {
  id: int("id").autoincrement().primaryKey(),
  userId1: int("userId1").notNull(), // Lower user ID
  userId2: int("userId2").notNull(), // Higher user ID
  status: mysqlEnum("status", ["active", "blocked"]).default("active").notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
});

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = typeof connections.$inferInsert;

/**
 * Connection Requests table - pending connection invitations
 */
export const connectionRequests = mysqlTable("connection_requests", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),
  message: text("message"), // Optional message with request
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
});

export type ConnectionRequest = typeof connectionRequests.$inferSelect;
export type InsertConnectionRequest = typeof connectionRequests.$inferInsert;

/**
 * Reports table - user reports for moderation
 */
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  reporterId: int("reporterId").notNull(), // User who made the report
  reportedUserId: int("reportedUserId").notNull(), // User being reported
  reason: varchar("reason", { length: 100 }).notNull(), // e.g., "harassment", "spam", "inappropriate"
  description: text("description"),
  status: mysqlEnum("status", ["pending", "reviewed", "resolved", "dismissed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"), // Admin user ID
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Moderation Logs table - tracks moderation actions
 */
export const moderationLogs = mysqlTable("moderation_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("adminId").notNull(),
  targetUserId: int("targetUserId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g., "warning", "suspend", "ban", "unban"
  reason: text("reason"),
  duration: int("duration"), // Duration in days for temporary actions
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModerationLog = typeof moderationLogs.$inferSelect;
export type InsertModerationLog = typeof moderationLogs.$inferInsert;

/**
 * Conversations table - tracks message threads between users
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  user1Id: int("user1Id").notNull(),
  user2Id: int("user2Id").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Messages table - stores individual messages within conversations
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderId: int("senderId").notNull(),
  receiverId: int("receiverId").notNull(),
  content: text("content").notNull(),
  isRead: int("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Email verification tokens
 */
export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

/**
 * Password reset tokens
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: int("used").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Refresh tokens for JWT authentication
 */
export const refreshTokens = mysqlTable("refresh_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  revoked: int("revoked").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

/**
 * Course Purchases table - tracks standalone course purchases
 */
export const coursePurchases = mysqlTable("course_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  amount: int("amount").notNull(), // Amount paid in cents
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
});

export type CoursePurchase = typeof coursePurchases.$inferSelect;
export type InsertCoursePurchase = typeof coursePurchases.$inferInsert;

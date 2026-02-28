import { date, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Primary login method: 'email', 'google', 'apple' */
  loginMethod: varchar("loginMethod", { length: 64 }).default("email").notNull(),
  role: mysqlEnum("role", ["user", "admin", "superadmin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "premium"]).default("free").notNull(),
  /** Stripe integration */
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).unique(), // Stripe customer ID
  /** Referral system fields */
  referralCode: varchar("referralCode", { length: 32 }).unique(), // Unique referral code for this user
  referredBy: varchar("referredBy", { length: 32 }), // Referral code of the user who referred them
  pointsBalance: int("pointsBalance").default(0).notNull(), // Current points balance
  freeMonthsRemaining: int("freeMonthsRemaining").default(0).notNull(), // Number of free months earned
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Admin Audit Logs - tracks all admin promotion/demotion actions
 */
export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  action: mysqlEnum("action", ["PROMOTE_ADMIN", "DEMOTE_ADMIN", "PROMOTE_SUPERADMIN", "DEMOTE_SUPERADMIN"]).notNull(),
  performedByUserId: int("performedByUserId").notNull(), // Who performed the action
  targetUserId: int("targetUserId").notNull(), // Who was promoted/demoted
  ip: varchar("ip", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;

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
  avatar: text("avatar"), // URL to avatar image
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  birthDate: date("birthDate"),
  gender: mysqlEnum("gender", ["male", "female", "other", "prefer_not_to_say"]),
  // Address
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  country: varchar("country", { length: 100 }).default("Brazil").notNull(),
  // Community
  interests: text("interests"), // JSON array of interests
  goals: text("goals"), // JSON array of development goals
  isPublic: int("isPublic").default(0).notNull(), // Opt-in for community visibility
  showCity: int("showCity").default(0).notNull(),
  // Emergency contact
  emergencyContactName: varchar("emergencyContactName", { length: 255 }),
  emergencyContactPhone: varchar("emergencyContactPhone", { length: 20 }),
  // Medical information (encrypted)
  medicalNotes: text("medicalNotes"), // Sensitive - should be encrypted
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

/**
 * Admin Permissions table - granular permissions for admin users
 */
export const adminPermissions = mysqlTable("admin_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // Foreign key to users table
  manageCourses: int("manageCourses").default(0).notNull(), // Create, edit, delete courses
  manageStudents: int("manageStudents").default(0).notNull(), // View and manage students
  manageContent: int("manageContent").default(0).notNull(), // Manage lessons and content
  manageAdmins: int("manageAdmins").default(0).notNull(), // Add and remove other admins
  manageSettings: int("manageSettings").default(0).notNull(), // Change site settings
  viewAnalytics: int("viewAnalytics").default(0).notNull(), // View reports and analytics
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = typeof adminPermissions.$inferInsert;

/**
 * Subscriptions table - stores user subscription information
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  plan: mysqlEnum("plan", ["free", "basic", "premium", "vip"]).default("free").notNull(),
  status: mysqlEnum("status", ["active", "paused", "cancelled", "expired", "trial"]).default("active").notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate"), // Null = no expiration
  trialEndDate: timestamp("trialEndDate"), // For trial periods
  autoRenew: int("autoRenew").default(1).notNull(), // 1 = auto-renew, 0 = manual
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  notes: text("notes"), // Admin notes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Payment history table - stores all payment transactions
 */
export const paymentHistory = mysqlTable("payment_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  subscriptionId: int("subscriptionId"),
  amount: int("amount").notNull(), // Amount in cents
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }), // credit_card, pix, boleto, etc.
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type InsertPaymentHistory = typeof paymentHistory.$inferInsert;

/**
 * Referrals table - tracks user referrals
 */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrerId").notNull(), // User who referred
  referredUserId: int("referredUserId"), // User who was referred (null until they sign up)
  referralCode: varchar("referralCode", { length: 32 }).notNull(), // Code used for referral
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled"]).default("pending").notNull(),
  planPurchased: mysqlEnum("planPurchased", ["basic", "premium", "vip"]), // Plan the referred user purchased
  pointsAwarded: int("pointsAwarded").default(0).notNull(), // Points given to referrer
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"), // When the referral was confirmed (payment received)
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

/**
 * Points transactions table - tracks all point movements
 */
export const pointsTransactions = mysqlTable("pointsTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: int("amount").notNull(), // Positive for earning, negative for spending
  type: mysqlEnum("type", ["referral_bonus", "monthly_bonus", "cashback_redeemed", "admin_adjustment", "free_month_applied"]).notNull(),
  description: text("description"),
  referralId: int("referralId"), // Link to referral if applicable
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type InsertPointsTransaction = typeof pointsTransactions.$inferInsert;

/**
 * Cashback requests table - tracks cashback redemption requests
 */
export const cashbackRequests = mysqlTable("cashbackRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  pointsAmount: int("pointsAmount").notNull(), // Points being redeemed
  cashAmount: int("cashAmount").notNull(), // Cash value in cents (R$)
  status: mysqlEnum("status", ["pending", "approved", "rejected", "paid"]).default("pending").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["pix", "bank_transfer", "credit_account"]).notNull(),
  pixKey: varchar("pixKey", { length: 255 }), // PIX key if payment method is PIX
  bankDetails: text("bankDetails"), // JSON with bank account details
  adminNotes: text("adminNotes"), // Admin notes for approval/rejection
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"), // When admin processed the request
  processedBy: int("processedBy"), // Admin user ID who processed
});

export type CashbackRequest = typeof cashbackRequests.$inferSelect;
export type InsertCashbackRequest = typeof cashbackRequests.$inferInsert;

/**
 * Admin invites table - tracks admin invitation tokens
 */
export const adminInvites = mysqlTable("adminInvites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "superadmin"]).default("admin").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  invitedBy: int("invitedBy").notNull(), // User ID of the super admin who sent the invite
  acceptedAt: timestamp("acceptedAt"), // Null until invite is accepted
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminInvite = typeof adminInvites.$inferSelect;
export type InsertAdminInvite = typeof adminInvites.$inferInsert;

/**
 * Appointments table - stores session/appointment bookings
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  programType: varchar("programType", { length: 100 }), // VR program type
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  duration: int("duration").notNull(), // Duration in minutes
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  location: varchar("location", { length: 255 }), // Physical location or "Online"
  notes: text("notes"), // Admin notes about the session
  reminderSent: int("reminderSent").default(0).notNull(), // 1 if reminder was sent
  cancelledBy: int("cancelledBy"), // User ID who cancelled (null if not cancelled)
  cancelReason: text("cancelReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * User Settings table - stores user preferences and configurations
 */
export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Notification preferences
  emailNotifications: int("emailNotifications").default(1).notNull(),
  smsNotifications: int("smsNotifications").default(0).notNull(),
  pushNotifications: int("pushNotifications").default(1).notNull(),
  reminderEmail: int("reminderEmail").default(1).notNull(),
  reminderSms: int("reminderSms").default(0).notNull(),
  marketingEmails: int("marketingEmails").default(0).notNull(),
  // Privacy preferences
  profilePublic: int("profilePublic").default(0).notNull(),
  shareProgress: int("shareProgress").default(0).notNull(),
  allowAnalytics: int("allowAnalytics").default(1).notNull(),
  // Accessibility
  darkMode: int("darkMode").default(0).notNull(),
  fontSize: varchar("fontSize", { length: 20 }).default("medium").notNull(),
  highContrast: int("highContrast").default(0).notNull(),
  reduceMotion: int("reduceMotion").default(0).notNull(),
  // Other
  language: varchar("language", { length: 10 }).default("pt-BR").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("America/Sao_Paulo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = typeof userSettings.$inferInsert;

/**
 * Activity Logs table - tracks user and admin activities for LGPD compliance
 */
export const activityLogs = mysqlTable("activityLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(), // e.g., "login", "data_export", "profile_update"
  entity: varchar("entity", { length: 100 }), // e.g., "user", "appointment", "course"
  entityId: int("entityId"), // ID of the affected entity
  details: text("details"), // JSON with additional details
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv4 or IPv6
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * Notifications table - stores user notifications
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "success", "warning", "error", "appointment"]).default("info").notNull(),
  read: int("read").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 500 }), // Optional link for the notification
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

import { pgTable, pgEnum, serial, text, varchar, integer, timestamp, date, boolean } from "drizzle-orm/pg-core";

// ============ ENUMS ============
export const roleEnum = pgEnum("role", ["user", "admin", "superadmin"]);
export const planEnum = pgEnum("plan", ["free", "premium"]);
export const intervalEnum = pgEnum("interval", ["month", "year"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "canceled", "past_due", "trialing"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["free", "basic", "premium", "vip"]);
export const subscriptionStateEnum = pgEnum("subscription_state", ["active", "paused", "cancelled", "expired", "trial"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed", "refunded"]);
export const referralStatusEnum = pgEnum("referral_status", ["pending", "confirmed", "cancelled"]);
export const referralPlanEnum = pgEnum("referral_plan", ["basic", "premium", "vip"]);
export const pointsTypeEnum = pgEnum("points_type", ["referral_bonus", "monthly_bonus", "cashback_redeemed", "admin_adjustment", "free_month_applied"]);
export const cashbackStatusEnum = pgEnum("cashback_status", ["pending", "approved", "rejected", "paid"]);
export const cashbackPaymentEnum = pgEnum("cashback_payment", ["pix", "bank_transfer", "credit_account"]);
export const adminRoleEnum = pgEnum("admin_role", ["admin", "superadmin"]);
export const adminActionEnum = pgEnum("admin_action", ["PROMOTE_ADMIN", "DEMOTE_ADMIN", "PROMOTE_SUPERADMIN", "DEMOTE_SUPERADMIN"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);
export const connectionStatusEnum = pgEnum("connection_status", ["active", "blocked"]);
export const connectionRequestStatusEnum = pgEnum("connection_request_status", ["pending", "accepted", "rejected"]);
export const reportStatusEnum = pgEnum("report_status", ["pending", "reviewed", "resolved", "dismissed"]);
export const notificationTypeEnum = pgEnum("notification_type", ["info", "success", "warning", "error", "appointment"]);
export const coursePurchaseStatusEnum = pgEnum("course_purchase_status", ["pending", "completed", "failed", "refunded"]);

// ============ TABLES ============

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerified: integer("emailVerified").default(0).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }).default("email").notNull(),
  role: roleEnum("role").default("user").notNull(),
  plan: planEnum("plan").default("free").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).unique(),
  referralCode: varchar("referralCode", { length: 32 }).unique(),
  referredBy: varchar("referredBy", { length: 32 }),
  pointsBalance: integer("pointsBalance").default(0).notNull(),
  freeMonthsRemaining: integer("freeMonthsRemaining").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  suspendedAt: timestamp("suspendedAt"),
  suspendReason: text("suspendReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  action: adminActionEnum("action").notNull(),
  performedByUserId: integer("performedByUserId").notNull(),
  targetUserId: integer("targetUserId").notNull(),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  instructorId: integer("instructorId").notNull(),
  price: integer("price"),
  isPublished: integer("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

export const courseModules = pgTable("course_modules", {
  id: serial("id").primaryKey(),
  courseId: integer("courseId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  isPublished: integer("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CourseModule = typeof courseModules.$inferSelect;
export type InsertCourseModule = typeof courseModules.$inferInsert;

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("courseId").notNull(),
  moduleId: integer("moduleId"),
  title: varchar("title", { length: 255 }).notNull(),
  order: integer("order").notNull(),
  description: text("description"),
  videoProvider: varchar("videoProvider", { length: 50 }),
  videoAssetId: varchar("videoAssetId", { length: 255 }),
  videoPlaybackUrl: text("videoPlaybackUrl"),
  duration: integer("duration"),
  isPublished: integer("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;

export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  progress: integer("progress").default(0).notNull(),
  completedLessons: text("completedLessons"),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
});

export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = typeof enrollments.$inferInsert;

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  price: integer("price").notNull(),
  interval: intervalEnum("interval").notNull(),
  features: text("features"),
  maxCourses: integer("maxCourses"),
  hasVRAccess: integer("hasVRAccess").default(0).notNull(),
  hasLiveSupport: integer("hasLiveSupport").default(0).notNull(),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  isActive: integer("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  planId: integer("planId").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  status: subscriptionStatusEnum("status").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: integer("cancelAtPeriodEnd").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

export const courseReviews = pgTable("course_reviews", {
  id: serial("id").primaryKey(),
  courseId: integer("courseId").notNull(),
  userId: integer("userId").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CourseReview = typeof courseReviews.$inferSelect;
export type InsertCourseReview = typeof courseReviews.$inferInsert;

export const ebooks = pgTable("ebooks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  thumbnail: text("thumbnail"),
  courseId: integer("courseId"),
  isPublished: integer("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Ebook = typeof ebooks.$inferSelect;
export type InsertEbook = typeof ebooks.$inferInsert;

export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  badgeType: varchar("badgeType", { length: 100 }).notNull(),
  badgeName: varchar("badgeName", { length: 255 }).notNull(),
  badgeDescription: text("badgeDescription"),
  badgeIcon: text("badgeIcon"),
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  certificateNumber: varchar("certificateNumber", { length: 100 }).notNull().unique(),
  pdfUrl: text("pdfUrl"),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
});

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  bio: text("bio"),
  avatar: text("avatar"),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  birthDate: date("birthDate"),
  gender: genderEnum("gender"),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  country: varchar("country", { length: 100 }).default("Brazil").notNull(),
  interests: text("interests"),
  goals: text("goals"),
  isPublic: integer("isPublic").default(0).notNull(),
  showCity: integer("showCity").default(0).notNull(),
  emergencyContactName: varchar("emergencyContactName", { length: 255 }),
  emergencyContactPhone: varchar("emergencyContactPhone", { length: 20 }),
  medicalNotes: text("medicalNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  userId1: integer("userId1").notNull(),
  userId2: integer("userId2").notNull(),
  status: connectionStatusEnum("status").default("active").notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
});

export type Connection = typeof connections.$inferSelect;
export type InsertConnection = typeof connections.$inferInsert;

export const connectionRequests = pgTable("connection_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("fromUserId").notNull(),
  toUserId: integer("toUserId").notNull(),
  message: text("message"),
  status: connectionRequestStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  respondedAt: timestamp("respondedAt"),
});

export type ConnectionRequest = typeof connectionRequests.$inferSelect;
export type InsertConnectionRequest = typeof connectionRequests.$inferInsert;

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporterId").notNull(),
  reportedUserId: integer("reportedUserId").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  status: reportStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: integer("reviewedBy"),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

export const moderationLogs = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("adminId").notNull(),
  targetUserId: integer("targetUserId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  reason: text("reason"),
  duration: integer("duration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ModerationLog = typeof moderationLogs.$inferSelect;
export type InsertModerationLog = typeof moderationLogs.$inferInsert;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1Id").notNull(),
  user2Id: integer("user2Id").notNull(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  content: text("content").notNull(),
  isRead: integer("isRead").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: integer("used").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  revoked: integer("revoked").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

export const coursePurchases = pgTable("course_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  courseId: integer("courseId").notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  status: coursePurchaseStatusEnum("status").default("pending").notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
});

export type CoursePurchase = typeof coursePurchases.$inferSelect;
export type InsertCoursePurchase = typeof coursePurchases.$inferInsert;

export const adminPermissions = pgTable("admin_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  manageCourses: integer("manageCourses").default(0).notNull(),
  manageStudents: integer("manageStudents").default(0).notNull(),
  manageContent: integer("manageContent").default(0).notNull(),
  manageAdmins: integer("manageAdmins").default(0).notNull(),
  manageSettings: integer("manageSettings").default(0).notNull(),
  viewAnalytics: integer("viewAnalytics").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AdminPermission = typeof adminPermissions.$inferSelect;
export type InsertAdminPermission = typeof adminPermissions.$inferInsert;

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  plan: subscriptionPlanEnum("plan").default("free").notNull(),
  status: subscriptionStateEnum("status").default("active").notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  endDate: timestamp("endDate"),
  trialEndDate: timestamp("trialEndDate"),
  autoRenew: integer("autoRenew").default(1).notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export const paymentHistory = pgTable("payment_history", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  subscriptionId: integer("subscriptionId"),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type InsertPaymentHistory = typeof paymentHistory.$inferInsert;

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrerId").notNull(),
  referredUserId: integer("referredUserId"),
  referralCode: varchar("referralCode", { length: 32 }).notNull(),
  status: referralStatusEnum("status").default("pending").notNull(),
  planPurchased: referralPlanEnum("planPurchased"),
  pointsAwarded: integer("pointsAwarded").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

export const pointsTransactions = pgTable("pointsTransactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  amount: integer("amount").notNull(),
  type: pointsTypeEnum("type").notNull(),
  description: text("description"),
  referralId: integer("referralId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type InsertPointsTransaction = typeof pointsTransactions.$inferInsert;

export const cashbackRequests = pgTable("cashbackRequests", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  pointsAmount: integer("pointsAmount").notNull(),
  cashAmount: integer("cashAmount").notNull(),
  status: cashbackStatusEnum("status").default("pending").notNull(),
  paymentMethod: cashbackPaymentEnum("paymentMethod").notNull(),
  pixKey: varchar("pixKey", { length: 255 }),
  bankDetails: text("bankDetails"),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
  processedBy: integer("processedBy"),
});

export type CashbackRequest = typeof cashbackRequests.$inferSelect;
export type InsertCashbackRequest = typeof cashbackRequests.$inferInsert;

export const adminInvites = pgTable("adminInvites", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  role: adminRoleEnum("role").default("admin").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  invitedBy: integer("invitedBy").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminInvite = typeof adminInvites.$inferSelect;
export type InsertAdminInvite = typeof adminInvites.$inferInsert;

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  programType: varchar("programType", { length: 100 }),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  duration: integer("duration").notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  location: varchar("location", { length: 255 }),
  notes: text("notes"),
  reminderSent: integer("reminderSent").default(0).notNull(),
  cancelledBy: integer("cancelledBy"),
  cancelReason: text("cancelReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

export const userSettings = pgTable("userSettings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  emailNotifications: integer("emailNotifications").default(1).notNull(),
  smsNotifications: integer("smsNotifications").default(0).notNull(),
  pushNotifications: integer("pushNotifications").default(1).notNull(),
  reminderEmail: integer("reminderEmail").default(1).notNull(),
  reminderSms: integer("reminderSms").default(0).notNull(),
  marketingEmails: integer("marketingEmails").default(0).notNull(),
  profilePublic: integer("profilePublic").default(0).notNull(),
  shareProgress: integer("shareProgress").default(0).notNull(),
  allowAnalytics: integer("allowAnalytics").default(1).notNull(),
  darkMode: integer("darkMode").default(0).notNull(),
  fontSize: varchar("fontSize", { length: 20 }).default("medium").notNull(),
  highContrast: integer("highContrast").default(0).notNull(),
  reduceMotion: integer("reduceMotion").default(0).notNull(),
  language: varchar("language", { length: 10 }).default("pt-BR").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("America/Sao_Paulo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = typeof userSettings.$inferInsert;

export const activityLogs = pgTable("activityLogs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }),
  entityId: integer("entityId"),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").default("info").notNull(),
  read: integer("read").default(0).notNull(),
  actionUrl: varchar("actionUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

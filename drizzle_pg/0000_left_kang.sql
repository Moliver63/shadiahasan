DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'admin_action' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."admin_action" AS ENUM('PROMOTE_ADMIN', 'DEMOTE_ADMIN', 'PROMOTE_SUPERADMIN', 'DEMOTE_SUPERADMIN');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'admin_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."admin_role" AS ENUM('admin', 'superadmin');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'appointment_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cashback_payment' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."cashback_payment" AS ENUM('pix', 'bank_transfer', 'credit_account');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'cashback_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."cashback_status" AS ENUM('pending', 'approved', 'rejected', 'paid');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'connection_request_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."connection_request_status" AS ENUM('pending', 'accepted', 'rejected');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'connection_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."connection_status" AS ENUM('active', 'blocked');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'course_purchase_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."course_purchase_status" AS ENUM('pending', 'completed', 'failed', 'refunded');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'gender' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'interval' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."interval" AS ENUM('month', 'year');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'notification_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."notification_type" AS ENUM('info', 'success', 'warning', 'error', 'appointment');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payment_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'plan' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."plan" AS ENUM('free', 'premium');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'points_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."points_type" AS ENUM('referral_bonus', 'monthly_bonus', 'cashback_redeemed', 'admin_adjustment', 'free_month_applied');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'referral_plan' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."referral_plan" AS ENUM('basic', 'premium', 'vip');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'referral_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."referral_status" AS ENUM('pending', 'confirmed', 'cancelled');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'report_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'resolved', 'dismissed');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."role" AS ENUM('user', 'admin', 'superadmin');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_plan' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'basic', 'premium', 'vip');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_state' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."subscription_state" AS ENUM('active', 'paused', 'cancelled', 'expired', 'trial');
  END IF;
END$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'subscription_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."subscription_status" AS ENUM('active', 'canceled', 'past_due', 'trialing');
  END IF;
END$$;
--> statement-breakpoint
CREATE TABLE "activityLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity" varchar(100),
	"entityId" integer,
	"details" text,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" "admin_action" NOT NULL,
	"performedByUserId" integer NOT NULL,
	"targetUserId" integer NOT NULL,
	"ip" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adminInvites" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"token" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"invitedBy" integer NOT NULL,
	"acceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "adminInvites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "admin_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"manageCourses" integer DEFAULT 0 NOT NULL,
	"manageStudents" integer DEFAULT 0 NOT NULL,
	"manageContent" integer DEFAULT 0 NOT NULL,
	"manageAdmins" integer DEFAULT 0 NOT NULL,
	"manageSettings" integer DEFAULT 0 NOT NULL,
	"viewAnalytics" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_permissions_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"programType" varchar(100),
	"startTime" timestamp NOT NULL,
	"endTime" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"location" varchar(255),
	"notes" text,
	"reminderSent" integer DEFAULT 0 NOT NULL,
	"cancelledBy" integer,
	"cancelReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashbackRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"pointsAmount" integer NOT NULL,
	"cashAmount" integer NOT NULL,
	"status" "cashback_status" DEFAULT 'pending' NOT NULL,
	"paymentMethod" "cashback_payment" NOT NULL,
	"pixKey" varchar(255),
	"bankDetails" text,
	"adminNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"processedAt" timestamp,
	"processedBy" integer
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"certificateNumber" varchar(100) NOT NULL,
	"pdfUrl" text,
	"issuedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_certificateNumber_unique" UNIQUE("certificateNumber")
);
--> statement-breakpoint
CREATE TABLE "connection_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"fromUserId" integer NOT NULL,
	"toUserId" integer NOT NULL,
	"message" text,
	"status" "connection_request_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"respondedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId1" integer NOT NULL,
	"userId2" integer NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"connectedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user1Id" integer NOT NULL,
	"user2Id" integer NOT NULL,
	"lastMessageAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"isPublished" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"stripePaymentIntentId" varchar(255),
	"status" "course_purchase_status" DEFAULT 'pending' NOT NULL,
	"purchasedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" integer NOT NULL,
	"userId" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"thumbnail" text,
	"instructorId" integer NOT NULL,
	"price" integer,
	"isPublished" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ebooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"fileUrl" text NOT NULL,
	"fileKey" varchar(500) NOT NULL,
	"thumbnail" text,
	"courseId" integer,
	"isPublished" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"courseId" integer NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completedLessons" text,
	"enrolledAt" timestamp DEFAULT now() NOT NULL,
	"lastAccessedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"courseId" integer NOT NULL,
	"moduleId" integer,
	"title" varchar(255) NOT NULL,
	"order" integer NOT NULL,
	"description" text,
	"videoProvider" varchar(50),
	"videoAssetId" varchar(255),
	"videoPlaybackUrl" text,
	"duration" integer,
	"isPublished" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversationId" integer NOT NULL,
	"senderId" integer NOT NULL,
	"receiverId" integer NOT NULL,
	"content" text NOT NULL,
	"isRead" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminId" integer NOT NULL,
	"targetUserId" integer NOT NULL,
	"action" varchar(100) NOT NULL,
	"reason" text,
	"duration" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" DEFAULT 'info' NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"actionUrl" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "payment_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subscriptionId" integer,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paymentMethod" varchar(64),
	"stripePaymentIntentId" varchar(255),
	"stripeInvoiceId" varchar(255),
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pointsTransactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"amount" integer NOT NULL,
	"type" "points_type" NOT NULL,
	"description" text,
	"referralId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrerId" integer NOT NULL,
	"referredUserId" integer,
	"referralCode" varchar(32) NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"planPurchased" "referral_plan",
	"pointsAwarded" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"confirmedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(500) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"revoked" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporterId" integer NOT NULL,
	"reportedUserId" integer NOT NULL,
	"reason" varchar(100) NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"reviewedAt" timestamp,
	"reviewedBy" integer
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"price" integer NOT NULL,
	"interval" interval NOT NULL,
	"features" text,
	"maxCourses" integer,
	"hasVRAccess" integer DEFAULT 0 NOT NULL,
	"hasLiveSupport" integer DEFAULT 0 NOT NULL,
	"stripePriceId" varchar(255),
	"isActive" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_state" DEFAULT 'active' NOT NULL,
	"startDate" timestamp DEFAULT now() NOT NULL,
	"endDate" timestamp,
	"trialEndDate" timestamp,
	"autoRenew" integer DEFAULT 1 NOT NULL,
	"stripeSubscriptionId" varchar(255),
	"stripePriceId" varchar(255),
	"stripeCustomerId" varchar(255),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"badgeType" varchar(100) NOT NULL,
	"badgeName" varchar(255) NOT NULL,
	"badgeDescription" text,
	"badgeIcon" text,
	"earnedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"bio" text,
	"avatar" text,
	"phoneNumber" varchar(20),
	"birthDate" date,
	"gender" "gender",
	"address" varchar(255),
	"city" varchar(100),
	"state" varchar(2),
	"zipCode" varchar(10),
	"country" varchar(100) DEFAULT 'Brazil' NOT NULL,
	"interests" text,
	"goals" text,
	"isPublic" integer DEFAULT 0 NOT NULL,
	"showCity" integer DEFAULT 0 NOT NULL,
	"emergencyContactName" varchar(255),
	"emergencyContactPhone" varchar(20),
	"medicalNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "userSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"emailNotifications" integer DEFAULT 1 NOT NULL,
	"smsNotifications" integer DEFAULT 0 NOT NULL,
	"pushNotifications" integer DEFAULT 1 NOT NULL,
	"reminderEmail" integer DEFAULT 1 NOT NULL,
	"reminderSms" integer DEFAULT 0 NOT NULL,
	"marketingEmails" integer DEFAULT 0 NOT NULL,
	"profilePublic" integer DEFAULT 0 NOT NULL,
	"shareProgress" integer DEFAULT 0 NOT NULL,
	"allowAnalytics" integer DEFAULT 1 NOT NULL,
	"darkMode" integer DEFAULT 0 NOT NULL,
	"fontSize" varchar(20) DEFAULT 'medium' NOT NULL,
	"highContrast" integer DEFAULT 0 NOT NULL,
	"reduceMotion" integer DEFAULT 0 NOT NULL,
	"language" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"timezone" varchar(50) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"planId" integer NOT NULL,
	"stripeCustomerId" varchar(255),
	"stripeSubscriptionId" varchar(255),
	"status" "subscription_status" NOT NULL,
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelAtPeriodEnd" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64),
	"name" text,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(255),
	"emailVerified" integer DEFAULT 0 NOT NULL,
	"loginMethod" varchar(64) DEFAULT 'email' NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"stripeCustomerId" varchar(255),
	"referralCode" varchar(32),
	"referredBy" varchar(32),
	"pointsBalance" integer DEFAULT 0 NOT NULL,
	"freeMonthsRemaining" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"suspendedAt" timestamp,
	"suspendReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripeCustomerId_unique" UNIQUE("stripeCustomerId"),
	CONSTRAINT "users_referralCode_unique" UNIQUE("referralCode")
);

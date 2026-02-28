import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminRouter } from "./routers/admin";
import { subscriptionsRouter } from "./routers/subscriptions";
import { referralsRouter } from "./routers/referrals";
import { publicProcedure, router, protectedProcedure, superAdminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

// Admin-only procedure helper
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    
    // Custom email/password authentication
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await db.registerUser(input.email, input.password, input.name);
          return { success: true, ...result };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : 'Registration failed',
          });
        }
      }),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await db.loginUser(input.email, input.password);
          
          // Set session cookie with user data
          const cookieOptions = getSessionCookieOptions(ctx.req);
          const userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
          ctx.res.cookie(COOKIE_NAME, JSON.stringify(userData), cookieOptions);
          
          return { success: true, user: userData };
        } catch (error) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error instanceof Error ? error.message : 'Login failed',
          });
        }
      }),
    
    verifyEmail: publicProcedure
      .input(z.object({
        token: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await db.verifyEmail(input.token);
          return { success: true, ...result };
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : 'Verification failed',
          });
        }
      }),
    
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        try {
          await db.requestPasswordReset(input.email);
          return { success: true };
        } catch (error) {
          // Always return success to prevent email enumeration
          return { success: true };
        }
      }),
    
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string(),
        password: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await db.resetPassword(input.token, input.password);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : 'Password reset failed',
          });
        }
      }),
    
    // Update own email (protected)
    updateOwnEmail: protectedProcedure
      .input(z.object({
        newEmail: z.string().email(),
        currentPassword: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await db.updateOwnEmail(ctx.user.id, input.newEmail, input.currentPassword);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : 'Email update failed',
          });
        }
      }),
    
    // Update own password (protected)
    updateOwnPassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const result = await db.updateOwnPassword(ctx.user.id, input.currentPassword, input.newPassword);
          return result;
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : 'Password update failed',
          });
        }
      }),
  }),

  courses: router({
    list: publicProcedure.query(async () => {
      return await db.getAllCourses();
    }),
    
    listAll: protectedProcedure.query(async ({ ctx }) => {
      const includeUnpublished = ctx.user.role === 'admin';
      return await db.getAllCourses(includeUnpublished);
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCourseById(input.id);
      }),
    
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return await db.getCourseBySlug(input.slug);
      }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        thumbnail: z.string().optional(),
        isPublished: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const courseId = await db.createCourse({
          ...input,
          instructorId: ctx.user.id,
        });
        return { id: courseId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        thumbnail: z.string().optional(),
        isPublished: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...updates } = input;
        await db.updateCourse(id, updates);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.deleteCourse(input.id);
        return { success: true };
      }),
    
    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return await db.getCourseStats();
    }),
  }),

  lessons: router({
    listByCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input, ctx }) => {
        const includeUnpublished = ctx.user?.role === 'admin';
        return await db.getLessonsByCourseId(input.courseId, includeUnpublished);
      }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getLessonById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        title: z.string().min(1),
        order: z.number(),
        description: z.string().optional(),
        videoProvider: z.string().optional(),
        videoAssetId: z.string().optional(),
        videoPlaybackUrl: z.string().optional(),
        duration: z.number().optional(),
        isPublished: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const lessonId = await db.createLesson(input);
        return { id: lessonId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        order: z.number().optional(),
        description: z.string().optional(),
        videoProvider: z.string().optional(),
        videoAssetId: z.string().optional(),
        videoPlaybackUrl: z.string().optional(),
        duration: z.number().optional(),
        isPublished: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...updates } = input;
        await db.updateLesson(id, updates);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.deleteLesson(input.id);
        return { success: true };
      }),
  }),

  subscriptions: router({
    listPlans: publicProcedure.query(async () => {
      return await db.getAllPlans();
    }),
    
    mySubscription: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSubscription(ctx.user.id);
    }),
    
    createCheckout: protectedProcedure
      .input(z.object({ planSlug: z.enum(["basic", "premium", "vip"]) }))
      .mutation(async ({ input, ctx }) => {
        const { createCheckoutSession, isStripeConfigured } = await import('./stripe');
        const { getStripePriceId, isPlanStripeConfigured } = await import('../shared/stripe-config');
        
        if (!isStripeConfigured()) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Stripe não está configurado. Entre em contato com o suporte.",
          });
        }

        const priceId = getStripePriceId(input.planSlug);
        
        if (!priceId || !isPlanStripeConfigured(input.planSlug)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Plano ${input.planSlug} não está configurado no Stripe. Entre em contato com o suporte.`,
          });
        }

        const origin = ctx.req.headers.origin || 'https://shadia-vr-platform.manus.space';
        
        const session = await createCheckoutSession({
          priceId,
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name || undefined,
          successUrl: origin + "/checkout/success?session_id={CHECKOUT_SESSION_ID}",
          cancelUrl: `${origin}/pricing`,
          metadata: {
            plan_slug: input.planSlug,
          },
        });

        return {
          sessionId: session.id,
          url: session.url,
        };
      }),
    
    getPortalUrl: protectedProcedure.mutation(async ({ ctx }) => {
      const { createCustomerPortalSession, isStripeConfigured } = await import('./stripe');
      
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe não está configurado.",
        });
      }

      const subscription = await db.getSubscriptionByUserId(ctx.user.id);
      
      if (!subscription?.stripeCustomerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Você ainda não possui uma assinatura ativa.",
        });
      }

      const origin = ctx.req.headers.origin || 'https://shadia-vr-platform.manus.space';
      const portalUrl = await createCustomerPortalSession(
        subscription.stripeCustomerId,
        `${origin}/dashboard`
      );

      return { url: portalUrl };
    }),
  }),

  enrollments: router({
    myEnrollments: protectedProcedure.query(async ({ ctx }) => {
      return await db.getEnrollmentsByUserId(ctx.user.id);
    }),
    
    checkEnrollment: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input, ctx }) => {
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        return { enrolled: !!enrollment, enrollment };
      }),
    
    enroll: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already enrolled' });
        }
        const enrollmentId = await db.createEnrollment({
          userId: ctx.user.id,
          courseId: input.courseId,
          progress: 0,
        });
        return { id: enrollmentId };
      }),
    
    updateProgress: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        progress: z.number(),
        completedLessons: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }
        await db.updateEnrollment(enrollment.id, {
          progress: input.progress,
          completedLessons: input.completedLessons,
        });
        return { success: true };
      }),
  }),

  reviews: router({
    getByCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => {
        const reviews = await db.getReviewsByCourseId(input.courseId);
        const stats = await db.getCourseAverageRating(input.courseId);
        return { reviews, stats };
      }),
    
    create: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if user is enrolled
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Must be enrolled to review' });
        }
        
        // Check if user already reviewed
        const existing = await db.getUserReviewForCourse(input.courseId, ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already reviewed this course' });
        }
        
        await db.createReview({
          courseId: input.courseId,
          userId: ctx.user.id,
          rating: input.rating,
          comment: input.comment,
        });
        return { success: true };
      }),
  }),

  ebooks: router({
    list: publicProcedure.query(async () => {
      return await db.getAllEbooks();
    }),
    
    listAll: adminProcedure.query(async () => {
      return await db.getAllEbooks(true);
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getEbookById(input.id);
      }),
    
    create: adminProcedure
      .input(z.object({
        title: z.string(),
        description: z.string().optional(),
        fileUrl: z.string(),
        fileKey: z.string(),
        thumbnail: z.string().optional(),
        courseId: z.number().optional(),
        isPublished: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        await db.createEbook(input);
        return { success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        isPublished: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updateEbook(id, updates);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteEbook(input.id);
        return { success: true };
      }),
  }),

  certificates: router({
    getUserCertificates: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserCertificates(ctx.user.id);
    }),
    
    generate: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Check if course is completed (100% progress)
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment || enrollment.progress < 100) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Course not completed' });
        }
        
        // Check if certificate already exists
        const existing = await db.getUserCertificateForCourse(ctx.user.id, input.courseId);
        if (existing) {
          return { certificateNumber: existing.certificateNumber };
        }
        
        // Generate unique certificate number
        const certificateNumber = `SH-${Date.now()}-${ctx.user.id}-${input.courseId}`;
        
        await db.createCertificate({
          userId: ctx.user.id,
          courseId: input.courseId,
          certificateNumber,
        });
        
        // Award badge for first certificate
        const userCerts = await db.getUserCertificates(ctx.user.id);
        if (userCerts.length === 1) {
          await db.awardBadge({
            userId: ctx.user.id,
            badgeType: 'first_certificate',
            badgeName: 'Primeiro Certificado',
            badgeDescription: 'Completou seu primeiro curso!',
            badgeIcon: '🏆',
          });
        }
        
        return { certificateNumber };
      }),
    
    verify: publicProcedure
      .input(z.object({ certificateNumber: z.string() }))
      .query(async ({ input }) => {
        const certificate = await db.getCertificateByNumber(input.certificateNumber);
        if (!certificate) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Certificate not found' });
        }
        const course = await db.getCourseById(certificate.courseId);
        const user = await db.getUserByOpenId(String(certificate.userId));
        return { certificate, course, user };
      }),
  }),

  badges: router({
    getUserBadges: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserBadges(ctx.user.id);
    }),
  }),

  profiles: router({
    // Get user's own profile
    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserProfile(ctx.user.id);
    }),
    
    // Update user's own profile
    updateMyProfile: protectedProcedure
      .input(z.object({
        bio: z.string().optional(),
        city: z.string().optional(),
        interests: z.array(z.string()).optional(),
        goals: z.array(z.string()).optional(),
        isPublic: z.boolean().optional(),
        showCity: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.updateUserProfile(ctx.user.id, input as any);
      }),
    
    // Get public profile by user ID (only if profile is public)
    getPublicProfile: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPublicProfile(input.userId);
      }),
  }),
  
  community: router({
    // Get suggested connections based on common interests/courses
    getSuggestions: protectedProcedure.query(async ({ ctx }) => {
      return await db.getConnectionSuggestions(ctx.user.id);
    }),
    
    // Send connection request
    sendRequest: protectedProcedure
      .input(z.object({
        toUserId: z.number(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createConnectionRequest(ctx.user.id, input.toUserId, input.message);
      }),
    
    // Accept connection request
    acceptRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.acceptConnectionRequest(input.requestId, ctx.user.id);
      }),
    
    // Reject connection request
    rejectRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.rejectConnectionRequest(input.requestId, ctx.user.id);
      }),
    
    // Get my connections
    getMyConnections: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserConnections(ctx.user.id);
    }),
    
    // Get pending connection requests
    getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPendingConnectionRequests(ctx.user.id);
    }),
    
    // Block user
    blockUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.blockUser(ctx.user.id, input.userId);
      }),
    
    // Report user
    reportUser: protectedProcedure
      .input(z.object({
        userId: z.number(),
        reason: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createReport(ctx.user.id, input.userId, input.reason, input.description);
      }),
  }),

  messaging: router({
    // Get my conversations
    getConversations: protectedProcedure.query(async ({ ctx }) => {
      return await db.getMyConversations(ctx.user.id);
    }),
    
    // Get unread message count
    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadMessageCount(ctx.user.id);
    }),
    
    // Get messages from a conversation
    getMessages: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getConversationMessages(input.conversationId, ctx.user.id);
      }),
    
    // Send message with plan restrictions
    sendMessage: protectedProcedure
      .input(z.object({
        receiverId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if sender is on free plan
        if (ctx.user.plan === 'free') {
          // Free users can only send to admin
          const receiver = await db.getUserById(input.receiverId);
          if (!receiver || receiver.role !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Usuários do plano gratuito só podem enviar mensagens para administradores. Faça upgrade para o plano premium para conversar com outros usuários.',
            });
          }
        }
        
        return await db.sendMessage(ctx.user.id, input.receiverId, input.content);
      }),
    
    // Mark messages as read
    markAsRead: protectedProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.markMessagesAsRead(input.conversationId, ctx.user.id);
      }),
  }),

  admin: router({
    listUsers: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),
    
    getStats: adminProcedure.query(async () => {
      const courses = await db.getAllCourses(true);
      const users = await db.getAllUsers();
      const enrollments = await db.getAllEnrollments();
      
      return {
        totalCourses: courses.length,
        totalStudents: users.filter(u => u.role === 'user').length,
        totalEnrollments: enrollments.length,
      };
    }),
    
    // Get all reports for moderation
    getReports: adminProcedure.query(async () => {
      return await db.getAllReports();
    }),
    
    // Review report
    reviewReport: adminProcedure
      .input(z.object({
        reportId: z.number(),
        action: z.enum(['resolved', 'dismissed']),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.reviewReport(input.reportId, ctx.user.id, input.action);
      }),
    
    // Moderate user (warning, suspend, ban)
    moderateUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        action: z.enum(['warning', 'suspend', 'ban', 'unban']),
        reason: z.string(),
        duration: z.number().optional(), // Duration in days for temporary actions
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.moderateUser(ctx.user.id, input.userId, input.action, input.reason, input.duration);
      }),
    
    // Update user email
    updateUserEmail: adminProcedure
      .input(z.object({
        userId: z.number(),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserEmail(input.userId, input.email);
      }),
    
    // Update user data (name, email, plan)
    updateUserData: adminProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        plan: z.enum(['free', 'premium']).optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserData(input.userId, input);
      }),
    
    // Update user password
    updateUserPassword: adminProcedure
      .input(z.object({
        userId: z.number(),
        password: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserPassword(input.userId, input.password);
      }),
    
    // Update user plan
    updateUserPlan: adminProcedure
      .input(z.object({
        userId: z.number(),
        plan: z.enum(['free', 'premium']),
      }))
      .mutation(async ({ input }) => {
        return await db.updateUserData(input.userId, { plan: input.plan });
      }),

    // Update user role — any admin can promote/demote regular users
    // Superadmin promotion still requires superAdminProcedure (promoteToAdmin)
    updateUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['user', 'admin']),
      }))
      .mutation(async ({ input, ctx }) => {
        // Prevent self-modification
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode alterar seu próprio role.' });
        }
        // Prevent demoting superadmins (only superadmin can do that)
        const target = await db.getUserById(input.userId);
        if (target?.role === 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas superadmins podem alterar o role de outros superadmins.' });
        }
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    
    // List all admins and superadmins
    listAdmins: superAdminProcedure.query(async () => {
      return await db.listAllAdminsAndSuperAdmins();
    }),
    
    // Promote user to admin
    promoteToAdmin: superAdminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket.remoteAddress;
        const userAgent = ctx.req.headers['user-agent'];
        
        await db.promoteToAdmin(input.userId, ctx.user.id, ip, userAgent);
        return { success: true };
      }),
    
    // Demote admin to user
    demoteFromAdmin: superAdminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Prevent self-demotion
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot demote yourself' });
        }
        
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket.remoteAddress;
        const userAgent = ctx.req.headers['user-agent'];
        
        await db.demoteFromAdmin(input.userId, ctx.user.id, ip, userAgent);
        return { success: true };
      }),
    
    // Promote admin to superadmin
    promoteToSuperAdmin: superAdminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const ip = ctx.req.headers['x-forwarded-for'] as string || ctx.req.socket.remoteAddress;
        const userAgent = ctx.req.headers['user-agent'];
        
        await db.promoteToSuperAdmin(input.userId, ctx.user.id, ip, userAgent);
        return { success: true };
      }),
    
    // Get admin audit logs
    getAuditLogs: superAdminProcedure
      .input(z.object({ limit: z.number().optional().default(100) }))
      .query(async ({ input }) => {
        return await db.getAdminAuditLogs(input.limit);
      }),
  }),

  // Plans management (admin only)
  plans: router({
    // List all plans (admin sees all, including inactive)
    listAll: adminProcedure
      .query(async () => {
        return await db.getAllPlansAdmin();
      }),
    
    // Get plan by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPlanById(input.id);
      }),
    
    // Create new plan
    create: adminProcedure
      .input(z.object({
        name: z.string(),
        slug: z.string(),
        description: z.string().optional(),
        price: z.number(),
        interval: z.enum(['month', 'year']),
        features: z.string().optional(),
        maxCourses: z.number().optional(),
        hasVRAccess: z.number().default(0),
        hasLiveSupport: z.number().default(0),
        stripePriceId: z.string().optional(),
        isActive: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        return await db.createPlan(input);
      }),
    
    // Update plan
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.number().optional(),
        features: z.string().optional(),
        maxCourses: z.number().optional(),
        hasVRAccess: z.number().optional(),
        hasLiveSupport: z.number().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await db.updatePlan(id, updates);
        return { success: true };
      }),
    
    // Delete plan
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlan(input.id);
        return { success: true };
      }),
  }),

  // AI Course Recommendation
  ai: router({
    // Chat with AI to get course recommendations
    chat: publicProcedure
      .input(z.object({
        message: z.string(),
        conversationHistory: z.array(z.object({
          role: z.string(),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        // Get all available courses
        const courses = await db.getAllCourses();
        
        // Build system prompt with course information
        const coursesInfo = courses.map(c => 
          `- ${c.title}: ${c.description || 'Curso de desenvolvimento pessoal'}`
        ).join('\n');
        
        const systemPrompt = `Voc\u00ea \u00e9 uma consultora especializada em desenvolvimento pessoal e transforma\u00e7\u00e3o interior da Shadia Hasan. Seu objetivo \u00e9 entender os desafios, objetivos e interesses do usu\u00e1rio e recomendar os cursos mais adequados.

Cursos dispon\u00edveis:
${coursesInfo}

Sua abordagem:
1. Fa\u00e7a perguntas abertas e emp\u00e1ticas sobre os objetivos e desafios do usu\u00e1rio
2. Escute ativamente e demonstre compreens\u00e3o
3. Ap\u00f3s 2-3 trocas de mensagens, recomende 1-2 cursos espec\u00edficos que melhor atendem \u00e0s necessidades
4. Explique por que cada curso \u00e9 ideal para o perfil do usu\u00e1rio
5. Seja calorosa, acolhedora e motivadora

Formato de recomenda\u00e7\u00e3o (use exatamente este formato quando recomendar):
**Recomendo para voc\u00ea:**
\n\ud83c\udf1f **[Nome do Curso]**
[Explica\u00e7\u00e3o de por que este curso \u00e9 ideal]
[Link: /courses/slug-do-curso]

Seja breve e direta nas respostas (m\u00e1ximo 3-4 linhas por mensagem).`;
        
        // Build conversation messages
        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...(input.conversationHistory || []).map(msg => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: input.message },
        ];
        
        // Call LLM
        const response = await invokeLLM({ messages });
        const assistantMessage = response.choices[0]?.message?.content || "Desculpe, n\u00e3o consegui processar sua mensagem.";
        
        return {
          message: assistantMessage,
          courses: courses, // Return all courses for reference
        };
      }),
  }),

  // Appointments management (admin)
  appointments: router({
    // List all appointments
    listAll: adminProcedure
      .input(z.object({
        status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { db: database } = await import('./db');
        const { appointments } = await import('../drizzle/schema');
        const { eq, and, gte, lte } = await import('drizzle-orm');
        
        let query = database.select().from(appointments);
        const conditions = [];
        
        if (input?.status) {
          conditions.push(eq(appointments.status, input.status));
        }
        if (input?.startDate) {
          conditions.push(gte(appointments.startTime, new Date(input.startDate)));
        }
        if (input?.endDate) {
          conditions.push(lte(appointments.startTime, new Date(input.endDate)));
        }
        
        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }
        
        return await query.orderBy(appointments.startTime);
      }),
    
    // Get appointment by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { db: database } = await import('./db');
        const { appointments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        
        const result = await database.select().from(appointments).where(eq(appointments.id, input.id));
        return result[0] || null;
      }),
    
    // Create appointment
    create: adminProcedure
      .input(z.object({
        userId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        programType: z.string().optional(),
        startTime: z.string(),
        endTime: z.string(),
        duration: z.number(),
        location: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { db: database } = await import('./db');
        const { appointments } = await import('../drizzle/schema');
        
        const result = await database.insert(appointments).values({
          ...input,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          status: 'scheduled',
        });
        
        return { success: true, id: result[0].insertId };
      }),
    
    // Update appointment
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        programType: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        duration: z.number().optional(),
        status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { db: database } = await import('./db');
        const { appointments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        
        const { id, ...updates } = input;
        const updateData: any = { ...updates };
        
        if (updates.startTime) {
          updateData.startTime = new Date(updates.startTime);
        }
        if (updates.endTime) {
          updateData.endTime = new Date(updates.endTime);
        }
        
        await database.update(appointments).set(updateData).where(eq(appointments.id, id));
        return { success: true };
      }),
    
    // Delete appointment
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { db: database } = await import('./db');
        const { appointments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        
        await database.delete(appointments).where(eq(appointments.id, input.id));
        return { success: true };
      }),
    
    // Get statistics
    getStats: adminProcedure.query(async () => {
      const { db: database } = await import('./db');
      const { appointments } = await import('../drizzle/schema');
      const { eq, count, and, gte } = await import('drizzle-orm');
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const allAppointments = await database.select().from(appointments);
      const recentAppointments = allAppointments.filter(a => new Date(a.createdAt) >= thirtyDaysAgo);
      
      return {
        total: allAppointments.length,
        scheduled: allAppointments.filter(a => a.status === 'scheduled').length,
        confirmed: allAppointments.filter(a => a.status === 'confirmed').length,
        completed: allAppointments.filter(a => a.status === 'completed').length,
        cancelled: allAppointments.filter(a => a.status === 'cancelled').length,
        recentCount: recentAppointments.length,
      };
    }),
  }),

  // Admin management router
  adminManagement: adminRouter,
  
  // Subscriptions management router
  subscriptionManagement: subscriptionsRouter,
  
  // Referrals system router
  referrals: referralsRouter,
});

export type AppRouter = typeof appRouter;

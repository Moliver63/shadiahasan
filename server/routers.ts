import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminRouter } from "./routers/admin";
import { subscriptionsRouter } from "./routers/subscriptions";
import { referralsRouter } from "./routers/referrals";
import { videosRouter } from "./routers/videos";
import { profileRouter } from "./routers/profile";
import { materialsRouter } from "./routers/materials";
import { publicProcedure, router, protectedProcedure, superAdminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

// Admin-only procedure helper
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

type ChatCourse = Awaited<ReturnType<typeof db.getAllCourses>>[number];

type MentalHealthIntent =
  | "emotional_regulation"
  | "self_esteem"
  | "relationships"
  | "communication"
  | "purpose"
  | "grief"
  | "burnout";

type CourseSegment = {
  slugHints: string[];
  titleHints: string[];
  intents: MentalHealthIntent[];
  keywords: string[];
  summary: string;
  rationaleByIntent: Partial<Record<MentalHealthIntent, string>>;
};

const normalizeMentalHealthText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const includesAnyTerm = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

const CRISIS_TERMS = [
  "suicid",
  "me matar",
  "morrer",
  "tirar minha vida",
  "nao quero viver",
  "não quero viver",
  "sem vontade de viver",
  "autoagress",
  "me machucar",
  "me cortar",
  "acabar com tudo",
];

const HIGH_DISTRESS_TERMS = [
  "depress",
  "ansied",
  "panico",
  "pânico",
  "crise",
  "angust",
  "vazio",
  "sem sentido",
  "luto",
  "trauma",
  "exaust",
  "burnout",
  "estresse",
  "stress",
  "sozinh",
  "culpa",
  "desanimo",
  "desânimo",
  "triste",
  "chor",
  "insonia",
  "insônia",
  "medo intenso",
  "desesper",
];

const INTENT_RULES: Array<{ intent: MentalHealthIntent; triggers: string[] }> = [
  {
    intent: "emotional_regulation",
    triggers: [
      "ansied",
      "panico",
      "pânico",
      "crise",
      "angust",
      "estresse",
      "stress",
      "medo",
      "triste",
      "vazio",
      "depress",
      "trauma",
      "emoc",
      "insonia",
      "insônia",
    ],
  },
  {
    intent: "self_esteem",
    triggers: [
      "autoestima",
      "insegur",
      "autoconfi",
      "autocrit",
      "culpa",
      "vergon",
      "rejei",
      "nao sou bom",
      "não sou bom",
      "fracasso",
      "comparacao",
      "comparação",
    ],
  },
  {
    intent: "relationships",
    triggers: [
      "relacion",
      "casamento",
      "familia",
      "família",
      "termino",
      "término",
      "abandono",
      "ciume",
      "ciúme",
      "conflito",
      "briga",
      "solidao",
      "solidão",
    ],
  },
  {
    intent: "communication",
    triggers: [
      "comunica",
      "nao consigo falar",
      "não consigo falar",
      "nao consigo me expressar",
      "não consigo me expressar",
      "limite",
      "assertiv",
      "timidez",
      "ansiedade social",
      "conversa dificil",
      "conversa difícil",
    ],
  },
  {
    intent: "purpose",
    triggers: [
      "proposito",
      "propósito",
      "sentido",
      "direcao",
      "direção",
      "clareza",
      "carreira",
      "travado",
      "travada",
      "sem rumo",
    ],
  },
  {
    intent: "grief",
    triggers: ["luto", "perda", "saudade", "rompimento", "separacao", "separação"],
  },
  {
    intent: "burnout",
    triggers: ["burnout", "exaust", "esgot", "sobrecarga", "cansaco", "cansaço", "trabalho"],
  },
];

const COURSE_SEGMENTS: CourseSegment[] = [
  {
    slugHints: ["permita-se"],
    titleHints: ["permita-se ser livre", "permita se ser livre", "permita-se"],
    intents: ["emotional_regulation", "self_esteem", "grief"],
    keywords: ["leveza", "liberdade emocional", "autocuidado", "culpa", "autoaceitacao", "autoaceitação"],
    summary: "Introdução voltada a acolhimento, autocuidado e permissão para sair de padrões de rigidez emocional.",
    rationaleByIntent: {
      emotional_regulation: "Pode ser um ponto de partida gentil para quem está precisando reduzir a rigidez interna, ganhar fôlego emocional e retomar autocuidado.",
      self_esteem: "Pode ajudar quando a pessoa está muito presa à culpa, autoexigência ou dificuldade de se tratar com mais gentileza.",
      grief: "Pode funcionar como apoio inicial para quem está tentando atravessar perdas sem se cobrar tanto por estar mal.",
    },
  },
  {
    slugHints: ["jornada-do-codigo-interno"],
    titleHints: ["jornada do codigo interno", "jornada do código interno"],
    intents: ["self_esteem", "purpose", "emotional_regulation", "burnout"],
    keywords: ["autoconhecimento", "identidade", "padroes internos", "padrões internos", "clareza", "valor pessoal"],
    summary: "Trilha mais alinhada a autoconhecimento, revisão de padrões internos, autoestima e clareza de direção.",
    rationaleByIntent: {
      self_esteem: "Pode apoiar quem está lidando com insegurança, autocrítica e necessidade de reconstruir a relação consigo.",
      purpose: "Faz mais sentido quando a dor principal envolve confusão interna, sensação de travamento ou falta de direção.",
      emotional_regulation: "Pode ajudar como apoio complementar para reconhecer padrões emocionais e desenvolver mais consciência sobre o que dispara sofrimento.",
      burnout: "Pode contribuir quando a exaustão vem acompanhada de cobrança interna, perda de sentido e desconexão de si.",
    },
  },
  {
    slugHints: ["o-poder-da-comunicacao"],
    titleHints: ["o poder da comunicacao", "o poder da comunicação"],
    intents: ["communication", "relationships", "self_esteem"],
    keywords: ["comunicacao", "comunicação", "dialogo", "diálogo", "limites", "assertividade", "relacionamentos"],
    summary: "Curso mais indicado para comunicação, limites, vínculos, expressão emocional e posicionamento com segurança.",
    rationaleByIntent: {
      communication: "É o curso mais aderente quando a dor passa por dificuldade de se expressar, dizer não, pedir ajuda ou conversar sem travar.",
      relationships: "Pode ajudar em conflitos de relacionamento, porque trabalha clareza, escuta e forma de se posicionar com mais segurança.",
      self_esteem: "Também pode servir de apoio quando a insegurança aparece na hora de falar, se impor ou sustentar a própria voz.",
    },
  },
];

const detectUserIntents = (userMessage: string): MentalHealthIntent[] => {
  const normalized = normalizeMentalHealthText(userMessage);
  return INTENT_RULES.filter((rule) => includesAnyTerm(normalized, rule.triggers)).map((rule) => rule.intent);
};

const getCourseSegment = (course: ChatCourse) => {
  const slug = normalizeMentalHealthText(course.slug || "");
  const title = normalizeMentalHealthText(course.title || "");

  return COURSE_SEGMENTS.find((segment) =>
    segment.slugHints.some((hint) => slug.includes(normalizeMentalHealthText(hint))) ||
    segment.titleHints.some((hint) => title.includes(normalizeMentalHealthText(hint)))
  );
};

const scoreCourseForMessage = (course: ChatCourse, userMessage: string) => {
  const message = normalizeMentalHealthText(userMessage);
  const haystack = normalizeMentalHealthText(`${course.title} ${course.description || ""}`);
  const userTerms = message.split(/[^a-z0-9]+/).filter((term) => term.length >= 4);
  const intents = detectUserIntents(userMessage);
  const segment = getCourseSegment(course);

  let score = 0;

  for (const term of userTerms) {
    if (haystack.includes(term)) score += 2;
  }

  if (segment) {
    for (const intent of intents) {
      if (segment.intents.includes(intent)) score += 10;
    }

    for (const keyword of segment.keywords) {
      if (message.includes(normalizeMentalHealthText(keyword))) score += 3;
    }
  }

  return score;
};

const pickRelevantCourses = (courses: ChatCourse[], userMessage: string) => {
  const normalized = normalizeMentalHealthText(userMessage);
  if (includesAnyTerm(normalized, CRISIS_TERMS)) {
    return [];
  }

  const ranked = courses
    .map((course) => ({ course, score: scoreCourseForMessage(course, userMessage) }))
    .sort((a, b) => b.score - a.score);

  return ranked
    .filter((entry) => entry.score >= 6)
    .slice(0, 2)
    .map((entry) => entry.course);
};

const buildCourseLink = (course: ChatCourse) => `[Link: /courses/${course.slug}]`;

const buildCourseReason = (course: ChatCourse, userMessage: string) => {
  const segment = getCourseSegment(course);
  const intents = detectUserIntents(userMessage);

  if (segment) {
    const matchedIntent = intents.find((intent) => segment.intents.includes(intent));
    if (matchedIntent && segment.rationaleByIntent[matchedIntent]) {
      return segment.rationaleByIntent[matchedIntent] as string;
    }
    return segment.summary;
  }

  return course.description || "Conteúdo de desenvolvimento pessoal com a abordagem acolhedora da Shadia Hasan, para apoio complementar com responsabilidade.";
};

const buildCourseRecommendationBlock = (courses: ChatCourse[], userMessage: string) => {
  if (courses.length === 0) return "";

  const items = courses.map((course) =>
    `🌿 **${course.title}**\n${buildCourseReason(course, userMessage)}\n${buildCourseLink(course)}`
  );

  return `\n\n**Sugestão de apoio complementar:**\n\n${items.join("\n\n")}`;
};

const buildFallbackPsychologyReply = (userMessage: string, courses: ChatCourse[]) => {
  const normalized = normalizeMentalHealthText(userMessage);
  const suggestions = buildCourseRecommendationBlock(pickRelevantCourses(courses, userMessage), userMessage);

  if (includesAnyTerm(normalized, CRISIS_TERMS)) {
    return `Sinto muito que você esteja passando por algo tão pesado. Sua segurança vem em primeiro lugar. Se houver risco imediato ou vontade de se machucar, procure ajuda agora: CVV 188, SAMU 192 ou alguém de confiança que possa ficar com você neste momento.\n\nEu posso te acolher e orientar próximos passos, mas não substituo atendimento psicológico ou psiquiátrico.`;
  }

  if (includesAnyTerm(normalized, HIGH_DISTRESS_TERMS)) {
    return `Sinto muito que você esteja vivendo isso. O que você descreve merece acolhimento sério e, idealmente, acompanhamento com psicóloga(o) e, se necessário, psiquiatra. Os conteúdos da Shadia podem servir como apoio complementar, mas não como substituto de tratamento.\n\nSe quiser, eu posso te ajudar agora de forma prática: pensar em um primeiro passo de cuidado para hoje, sugerir como buscar ajuda profissional, ou indicar um conteúdo da Shadia mais alinhado ao que está pesando agora.${suggestions}`;
  }

  return `Estou aqui para te acolher com a abordagem humana e cuidadosa da Shadia Hasan. Posso te ajudar a entender o que você está vivendo, sugerir próximos passos com responsabilidade e indicar conteúdos que façam sentido para o seu momento.\n\nSe você quiser, me conte em uma frase: o que mais está pesando hoje — ansiedade, autoestima, relacionamentos, comunicação, propósito ou outro tema?${suggestions}`;
};

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  profile: profileRouter,
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

    // Atualiza nome/e-mail do próprio perfil (sem confirmação de senha).
    // Para troca de e-mail com verificação de senha, usar updateOwnEmail.
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await db.updateUserData(ctx.user.id, input);
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : 'Profile update failed',
          });
        }
      }),
  }),

  courses: router({
    /**
     * Upload de thumbnail do curso (imagem) via storage proxy interno.
     * Recebe a imagem em base64 (data URL ou string base64 pura) e o
     * content-type, salva no storage e retorna a URL pública.
     */
    uploadThumbnail: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1),
          contentType: z.string().min(1),
          base64Data: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        // Aceita tanto "data:image/png;base64,XXXX" quanto "XXXX" puro
        const base64 = input.base64Data.includes(',')
          ? input.base64Data.split(',')[1]
          : input.base64Data;

        const buffer = Buffer.from(base64, 'base64');

        // Limite de 2MB para thumbnails armazenadas como data URL no banco
        const MAX_SIZE = 2 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
          throw new TRPCError({
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Imagem muito grande. Máximo 2MB.',
          });
        }

        // Armazena a imagem como data URL direto no campo thumbnail (text).
        // Não depende de storage externo (BUILT_IN_FORGE_API_URL não está
        // configurado/funcional neste ambiente).
        const dataUrl = `data:${input.contentType};base64,${base64}`;

        return { url: dataUrl };
      }),

    list: publicProcedure.query(async () => {
      return await db.getAllCourses();
    }),
    
    listAll: protectedProcedure.query(async ({ ctx }) => {
      const includeUnpublished = ctx.user.role === 'admin' || ctx.user.role === 'superadmin';
      return await db.getAllCourses(includeUnpublished);
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCourseById(input.id);
      }),

    getByIds: publicProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await db.getCoursesByIds(input.ids);
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
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
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
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...updates } = input;
        await db.updateCourse(id, updates);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.deleteCourse(input.id);
        return { success: true };
      }),

    reorder: protectedProcedure
      .input(z.object({
        items: z.array(z.object({ id: z.number(), order: z.number() })).min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.reorderCourses(input.items);
        return { success: true };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        try {
          return await db.duplicateCourse(input.id, ctx.user.id);
        } catch (err: any) {
          if (err?.message === 'Curso não encontrado') {
            throw new TRPCError({ code: 'NOT_FOUND', message: err.message });
          }
          throw err;
        }
      }),

    bulkUpdate: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1),
        isPublished: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { ids, ...updates } = input;
        await db.bulkUpdateCourses(ids, updates);
        return { success: true, count: ids.length };
      }),

    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.bulkDeleteCourses(input.ids);
        return { success: true, count: input.ids.length };
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      return await db.getCourseStats();
    }),
  }),

  lessons: router({
    listByCourse: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input, ctx }) => {
        const isAdmin = ctx.user?.role === 'admin' || ctx.user?.role === 'superadmin';
        const lessonsList = await db.getLessonsByCourseId(input.courseId, isAdmin);

        if (isAdmin) return lessonsList;

        // Para cada aula restrita, verifica acesso e remove a URL/asset
        // do vídeo caso o usuário não tenha permissão. Isso evita que a
        // URL real do vídeo (Cloudflare/YouTube) seja exposta via API
        // antes da verificação de assinatura/compra.
        const { checkUserHasAccess } = await import('./routers/videos');
        const result = [];
        for (const lesson of lessonsList) {
          if (lesson.isAccessRestricted && lesson.isAccessRestricted !== 0) {
            const hasAccess = ctx.user
              ? await checkUserHasAccess(ctx.user.id, {
                  isAccessRestricted: lesson.isAccessRestricted,
                  courseId: lesson.courseId,
                })
              : false;

            if (!hasAccess) {
              result.push({
                ...lesson,
                videoPlaybackUrl: null,
                videoAssetId: null,
              });
              continue;
            }
          }
          result.push(lesson);
        }

        if (!ctx.user) {
          return result;
        }

        const { getLearningPathSnapshot } = await import('./learning-path');
        const snapshot = await getLearningPathSnapshot(ctx.user.id, input.courseId);

        return result.map((lesson) => {
          const state = snapshot.lessonStates[lesson.id];
          return {
            ...lesson,
            isPathLocked: state?.isPathLocked ?? false,
            unlockDay: state?.unlockDay ?? null,
            unlockPhase: state?.phase ?? null,
            unlockReason: state?.unlockReason ?? null,
            unlockLabel: state?.unlockLabel ?? null,
            learningPathEnabled: snapshot.enabled,
            currentLearningDay: snapshot.currentDay,
            nextUnlockDay: snapshot.nextUnlockDay,
            nextUnlockLabel: snapshot.nextUnlockLabel,
          };
        });
      }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const lesson = await db.getLessonById(input.id);
        if (!lesson) return lesson;

        const isAdmin = ctx.user?.role === 'admin' || ctx.user?.role === 'superadmin';
        if (isAdmin) return lesson;

        if (lesson.isAccessRestricted && lesson.isAccessRestricted !== 0) {
          const { checkUserHasAccess } = await import('./routers/videos');
          const hasAccess = ctx.user
            ? await checkUserHasAccess(ctx.user.id, {
                isAccessRestricted: lesson.isAccessRestricted,
                courseId: lesson.courseId,
              })
            : false;

          if (!hasAccess) {
            return { ...lesson, videoPlaybackUrl: null, videoAssetId: null };
          }
        }

        if (!ctx.user) {
          return lesson;
        }

        const { getLearningPathSnapshot } = await import('./learning-path');
        const snapshot = await getLearningPathSnapshot(ctx.user.id, lesson.courseId);
        const state = snapshot.lessonStates[lesson.id];

        return {
          ...lesson,
          isPathLocked: state?.isPathLocked ?? false,
          unlockDay: state?.unlockDay ?? null,
          unlockPhase: state?.phase ?? null,
          unlockReason: state?.unlockReason ?? null,
          unlockLabel: state?.unlockLabel ?? null,
          learningPathEnabled: snapshot.enabled,
          currentLearningDay: snapshot.currentDay,
          nextUnlockDay: snapshot.nextUnlockDay,
          nextUnlockLabel: snapshot.nextUnlockLabel,
        };
      }),
    
    create: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        title: z.string().min(1),
        order: z.number(),
        description: z.string().optional(),
        videoProvider: z.string().optional(),
        videoAssetId: z.string().nullable().optional(),
        videoPlaybackUrl: z.string().nullable().optional(),
        duration: z.number().optional(),
        isPublished: z.number().default(0),
        isAccessRestricted: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
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
        videoAssetId: z.string().nullable().optional(),
        videoPlaybackUrl: z.string().nullable().optional(),
        duration: z.number().optional(),
        isPublished: z.number().optional(),
        isAccessRestricted: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { id, ...updates } = input;
        await db.updateLesson(id, updates);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.deleteLesson(input.id);
        return { success: true };
      }),

    reorder: protectedProcedure
      .input(z.object({
        items: z.array(z.object({ id: z.number(), order: z.number() })).min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.reorderLessons(input.items);
        return { success: true };
      }),

    duplicate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        try {
          return await db.duplicateLesson(input.id);
        } catch (err: any) {
          if (err?.message === 'Aula não encontrada') {
            throw new TRPCError({ code: 'NOT_FOUND', message: err.message });
          }
          throw err;
        }
      }),

    bulkUpdate: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1),
        isPublished: z.number().optional(),
        isAccessRestricted: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        const { ids, ...updates } = input;
        await db.bulkUpdateLessons(ids, updates);
        return { success: true, count: ids.length };
      }),

    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        await db.bulkDeleteLessons(input.ids);
        return { success: true, count: input.ids.length };
      }),
  }),

  subscriptions: router({
    listPlans: publicProcedure.query(async () => {
      return await db.getAllPlans();
    }),
    
    mySubscription: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSubscription(ctx.user.id);
    }),

    // Própria assinatura (mesma coisa que mySubscription, com input por compatibilidade)
    getByUserId: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx }) => {
        // Sempre usa o usuário autenticado — nunca confia no userId vindo do input
        return await db.getSubscriptionByUserId(ctx.user.id);
      }),

    // Próprio histórico de pagamentos
    getPaymentHistory: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx }) => {
        return await db.getPaymentsByUserId(ctx.user.id);
      }),

    // Admin: todas as assinaturas
    getAll: adminProcedure.query(async () => {
      return await db.listAllSubscriptionsFlat();
    }),

    // Admin: todo o histórico de pagamentos
    getAllPaymentHistory: adminProcedure.query(async () => {
      return await db.getAllPayments();
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

        const origin = ctx.req.headers.origin || 'https://shadiahasan.club';
        
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

      const origin = ctx.req.headers.origin || 'https://shadiahasan.club';
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

    // Admin: ver matrículas de um aluno específico
    getByUserId: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return await db.getEnrollmentsByUserId(input.userId);
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
        let enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);

        // Usuários com acesso por assinatura/compra podem chegar aqui sem matrícula persistida.
        // Nesse caso, criamos a matrícula automaticamente para não quebrar o fluxo da trilha.
        if (!enrollment) {
          const enrollmentId = await db.createEnrollment({
            userId: ctx.user.id,
            courseId: input.courseId,
            progress: 0,
            completedLessons: '[]',
          });

          if (!enrollmentId) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Could not create enrollment',
            });
          }

          enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        }

        if (!enrollment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Enrollment not found' });
        }

        await db.updateEnrollment(enrollment.id, {
          progress: input.progress,
          completedLessons: input.completedLessons,
          lastAccessedAt: new Date(),
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

  testimonials: router({
    listApproved: publicProcedure.query(async () => {
      return await db.getApprovedTestimonials();
    }),

    listMine: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserTestimonials(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        text: z.string().min(20).max(1200),
        consentPublicDisplay: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const enrollment = await db.getEnrollmentByCourseAndUser(input.courseId, ctx.user.id);
        if (!enrollment) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente alunos matriculados podem enviar depoimentos.' });
        }

        if (!input.consentPublicDisplay) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'É necessário autorizar a publicação do depoimento.' });
        }

        const existing = await db.getTestimonialByUserAndCourse(ctx.user.id, input.courseId);
        if (existing) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você já enviou um depoimento para este curso.' });
        }

        await db.createTestimonial({
          userId: ctx.user.id,
          courseId: input.courseId,
          displayName: ctx.user.name || 'Aluno(a)',
          text: input.text.trim(),
          status: 'pending',
          consentPublicDisplay: 1,
        });

        return { success: true };
      }),

    adminList: adminProcedure.query(async () => {
      return await db.getAllTestimonialsAdmin();
    }),

    adminUpdateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['approved', 'rejected']),
        rejectedReason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateTestimonialStatus(input.id, input.status, ctx.user.id, input.rejectedReason);
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

    unblockUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.unblockUser(ctx.user.id, input.userId);
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
          if (!receiver || (receiver.role !== 'admin' && receiver.role !== 'superadmin')) {
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
        plan: z.enum(['free', 'basic', 'premium', 'vip']).optional(),
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
        plan: z.enum(['free', 'basic', 'premium', 'vip']),
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
        const courses = await db.getAllCourses();
        const coursesInfo = courses
          .map((course) => {
            const segment = getCourseSegment(course);
            const segmentSummary = segment?.summary || course.description || 'Curso de desenvolvimento pessoal';
            return `- ${course.title}: ${segmentSummary}`;
          })
          .join('\n');

        const systemPrompt = `Você é a assistente virtual da Shadia Hasan com tom acolhedor, ético e humano, inspirado na escuta de uma psicóloga.\n\nPrincípios obrigatórios:\n1. Responda sempre em português do Brasil.\n2. Acolha primeiro, não julgue e não banalize a dor.\n3. Não faça diagnóstico, não prescreva tratamento e não prometa cura.\n4. Quando o usuário falar de depressão, ansiedade, trauma, luto, pânico, burnout, insônia, culpa intensa, solidão ou sofrimento emocional importante, valide o sentimento e oriente apoio psicológico/psiquiátrico quando apropriado.\n5. Se houver sinais de risco, suicídio, autoagressão ou perigo iminente, priorize segurança, não ofereça curso na primeira linha e oriente procurar ajuda imediata no CVV 188, SAMU 192 ou uma pessoa de confiança.\n6. Os cursos da Shadia devem ser apresentados apenas como apoio complementar, nunca como substitutos de psicoterapia ou atendimento médico.\n7. Recomende curso somente quando houver aderência clara com a dor relatada. Nunca empurre curso sem contexto.\n8. Seja breve, calorosa e responsável. Faça no máximo uma pergunta de acompanhamento por resposta.\n\nMapeamento de dores prioritárias:\n- regulação emocional: ansiedade, crise, pânico, tristeza intensa, trauma, sobrecarga emocional\n- autoestima: insegurança, culpa, autocrítica, vergonha, rejeição\n- relacionamentos: conflitos, término, ciúme, solidão, família\n- comunicação: dificuldade de se expressar, dizer não, pedir ajuda, colocar limites\n- propósito: travamento, falta de direção, perda de sentido\n- burnout: exaustão, esgotamento, cobrança interna\n\nCursos disponíveis:\n${coursesInfo}\n\nQuando recomendar, use exatamente este formato:\n**Sugestão de apoio complementar:**\n\n🌿 **[Nome do Curso]**\n[Explique por que pode ajudar neste momento, sem prometer cura]\n[Link: /courses/slug-do-curso]`;

        const messages: any[] = [
          { role: 'system', content: systemPrompt },
          ...(input.conversationHistory || []).map((msg) => ({ role: msg.role, content: msg.content })),
          { role: 'user', content: input.message },
        ];

        try {
          const { invokeLLM } = await import("./_core/llm");
          const response = await invokeLLM({ messages });
          const assistantMessage = response.choices[0]?.message?.content;

          return {
            message: typeof assistantMessage === 'string' && assistantMessage.trim().length > 0
              ? assistantMessage
              : buildFallbackPsychologyReply(input.message, courses),
            courses,
          };
        } catch (error) {
          console.error('[AI Chat] Falling back to local response:', error);
          return {
            message: buildFallbackPsychologyReply(input.message, courses),
            courses,
          };
        }
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
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { appointments, users } = await import('../drizzle/schema');
        const { eq, and, gte, lte } = await import('drizzle-orm');

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

        const baseQuery = database
          .select({
            id: appointments.id,
            userId: appointments.userId,
            title: appointments.title,
            description: appointments.description,
            programType: appointments.programType,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
            duration: appointments.duration,
            status: appointments.status,
            location: appointments.location,
            notes: appointments.notes,
            createdAt: appointments.createdAt,
            updatedAt: appointments.updatedAt,
            user: { name: users.name, email: users.email },
          })
          .from(appointments)
          .leftJoin(users, eq(appointments.userId, users.id));

        const rows = conditions.length > 0
          ? await baseQuery.where(and(...conditions)).orderBy(appointments.startTime)
          : await baseQuery.orderBy(appointments.startTime);

        return rows;
      }),
    
    // Get appointment by ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
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
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { appointments } = await import('../drizzle/schema');
        
        const result = await database.insert(appointments).values({
          ...input,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          status: 'scheduled',
        }).returning({ id: appointments.id });
        
        return { success: true, id: result[0].id };
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
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
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
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { appointments } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        
        await database.delete(appointments).where(eq(appointments.id, input.id));
        return { success: true };
      }),
    
    // Get statistics
    getStats: adminProcedure.query(async () => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
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
  videos: videosRouter,

  adminManagement: adminRouter,
  
  // Subscriptions management router
  subscriptionManagement: subscriptionsRouter,
  
  // Referrals system router
  referrals: referralsRouter,

  // Material de Apoio + Exercícios Mentais
  materials: materialsRouter,
});

export type AppRouter = typeof appRouter;

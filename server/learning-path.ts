import { and, asc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  enrollments,
  learningPaths,
  learningPathSteps,
} from "../drizzle/schema";

export type LearningPathPhase = "day0" | "day3" | "day6" | "day7" | "post7";

export type LearningPathLessonState = {
  lessonId: number;
  phase: LearningPathPhase;
  sortOrder: number;
  isPathLocked: boolean;
  unlockDay: number | null;
  unlockReason: "day_gate" | "previous_phase_completion" | null;
  unlockLabel: string | null;
};

export type LearningPathSnapshot = {
  enabled: boolean;
  currentDay: number;
  currentPhase: LearningPathPhase | null;
  nextUnlockDay: number | null;
  nextUnlockLabel: string | null;
  completedLessonIds: number[];
  lessonStates: Record<number, LearningPathLessonState>;
};

const ORDERED_PHASES: LearningPathPhase[] = ["day0", "day3", "day6", "day7"];
const PHASE_LABELS: Record<LearningPathPhase, string> = {
  day0: "Dia 0",
  day3: "Dia 3",
  day6: "Dia 6",
  day7: "Dia 7",
  post7: "Pós-7 dias",
};

function parseCompletedLessons(value?: string | null): number[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  } catch {
    return [];
  }
}

function getCurrentDay(enrolledAt?: Date | string | null): number {
  if (!enrolledAt) return 0;
  const date = enrolledAt instanceof Date ? enrolledAt : new Date(enrolledAt);
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getPreviousPhase(phase: LearningPathPhase, configured: LearningPathPhase[]) {
  if (phase === "post7") {
    return configured.includes("day7") ? "day7" : null;
  }

  const index = ORDERED_PHASES.indexOf(phase);
  if (index <= 0) return null;

  for (let i = index - 1; i >= 0; i -= 1) {
    if (configured.includes(ORDERED_PHASES[i])) {
      return ORDERED_PHASES[i];
    }
  }

  return null;
}

function getPhaseCompletionPercent(requiredLessonIds: number[], completedLessonIds: number[]) {
  if (requiredLessonIds.length === 0) return 100;
  const completed = requiredLessonIds.filter((id) => completedLessonIds.includes(id)).length;
  return Math.round((completed / requiredLessonIds.length) * 100);
}

function getTimedUnlockDay(
  phase: LearningPathPhase,
  sortOrder: number,
  postDay7UnlockEveryDays: number
) {
  switch (phase) {
    case "day0":
      return 0;
    case "day3":
      return 3;
    case "day6":
      return 6;
    case "day7":
      return 7;
    case "post7":
      return 7 + Math.max(1, sortOrder) * Math.max(1, postDay7UnlockEveryDays);
    default:
      return 0;
  }
}

export async function getLearningPathSnapshot(
  userId: number,
  courseId: number
): Promise<LearningPathSnapshot> {
  const disabled: LearningPathSnapshot = {
    enabled: false,
    currentDay: 0,
    currentPhase: null,
    nextUnlockDay: null,
    nextUnlockLabel: null,
    completedLessonIds: [],
    lessonStates: {},
  };

  const db = await getDb();
  if (!db) return disabled;

  try {
    const [path] = await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.courseId, courseId))
      .limit(1);

    if (!path || path.isEnabled !== 1) {
      return disabled;
    }

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);

    const currentDay = getCurrentDay(enrollment?.enrolledAt ?? null);
    const completedLessonIds = parseCompletedLessons(enrollment?.completedLessons ?? "[]");

    const steps = await db
      .select()
      .from(learningPathSteps)
      .where(eq(learningPathSteps.learningPathId, path.id))
      .orderBy(asc(learningPathSteps.sortOrder), asc(learningPathSteps.id));

    if (steps.length === 0) {
      return {
        ...disabled,
        enabled: true,
        currentDay,
        completedLessonIds,
      };
    }

    const configuredPhases = Array.from(new Set(steps.map((step) => step.phase as LearningPathPhase)));
    const minCompletionPercent = path.minPhaseCompletionPercent ?? 70;
    const postDay7UnlockEveryDays = path.postDay7UnlockEveryDays ?? 3;

    const phaseLessonIds = configuredPhases.reduce<Record<string, number[]>>((acc, phase) => {
      acc[phase] = steps
        .filter((step) => step.phase === phase)
        .filter((step) => step.isRequired === 1)
        .map((step) => step.lessonId);
      return acc;
    }, {});

    const lessonStates: Record<number, LearningPathLessonState> = {};
    let currentPhase: LearningPathPhase | null = null;
    let nextUnlockDay: number | null = null;
    let nextUnlockLabel: string | null = null;

    for (const step of steps) {
      const phase = step.phase as LearningPathPhase;
      const unlockDay = getTimedUnlockDay(phase, step.sortOrder ?? 0, postDay7UnlockEveryDays);
      const previousPhase = getPreviousPhase(phase, configuredPhases);
      const previousCompletion = previousPhase
        ? getPhaseCompletionPercent(phaseLessonIds[previousPhase] ?? [], completedLessonIds)
        : 100;

      const meetsDayGate = currentDay >= unlockDay;
      const requiresPreviousCompletion = step.requiresPreviousCompletion === 1;
      const meetsPreviousCompletion = !requiresPreviousCompletion || previousCompletion >= minCompletionPercent;
      const isPathLocked = !(meetsDayGate && meetsPreviousCompletion);

      if (!isPathLocked) {
        currentPhase = phase;
      }

      let unlockReason: LearningPathLessonState["unlockReason"] = null;
      let unlockLabel: string | null = null;

      if (!meetsDayGate) {
        unlockReason = "day_gate";
        unlockLabel = `Disponível a partir do ${PHASE_LABELS[phase]}.`;
      } else if (!meetsPreviousCompletion) {
        unlockReason = "previous_phase_completion";
        unlockLabel = `Conclua pelo menos ${minCompletionPercent}% da etapa anterior para liberar esta aula.`;
      }

      if (isPathLocked && nextUnlockDay === null) {
        nextUnlockDay = unlockDay;
        nextUnlockLabel = unlockLabel;
      }

      lessonStates[step.lessonId] = {
        lessonId: step.lessonId,
        phase,
        sortOrder: step.sortOrder ?? 0,
        isPathLocked,
        unlockDay,
        unlockReason,
        unlockLabel,
      };
    }

    return {
      enabled: true,
      currentDay,
      currentPhase,
      nextUnlockDay,
      nextUnlockLabel,
      completedLessonIds,
      lessonStates,
    };
  } catch (error) {
    console.warn("[learning-path] fallback disabled:", error instanceof Error ? error.message : error);
    return disabled;
  }
}

export async function getLearningPathLessonAccess(
  userId: number,
  courseId: number,
  lessonId: number
) {
  const snapshot = await getLearningPathSnapshot(userId, courseId);
  const state = snapshot.lessonStates[lessonId];

  if (!snapshot.enabled || !state) {
    return {
      allowed: true,
      reason: "path_disabled" as const,
      currentDay: snapshot.currentDay,
      currentPhase: snapshot.currentPhase,
      nextUnlockDay: snapshot.nextUnlockDay,
      nextUnlockLabel: snapshot.nextUnlockLabel,
    };
  }

  return {
    allowed: !state.isPathLocked,
    reason: state.isPathLocked ? "learning_path_locked" as const : "phase_unlocked" as const,
    currentDay: snapshot.currentDay,
    currentPhase: snapshot.currentPhase,
    nextUnlockDay: state.unlockDay,
    nextUnlockLabel: state.unlockLabel,
    phase: state.phase,
  };
}

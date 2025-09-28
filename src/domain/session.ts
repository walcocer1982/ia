import { z } from 'zod';
import { nextActionSchema } from './responses.js';
import { riskMatrixResultSchema } from './risk-matrix.js';
import type { Lesson } from './lesson.js';


const interactionLogBaseSchema = z.object({
  timestamp: z.string().datetime(),
  stepCode: z.string(),
  question: z.string().optional(),
  userInput: z.string(),
  agentResponse: z.string(),
  score: z.number().min(0).max(1).optional(),
  classification: z.string().optional(),
  nextAction: nextActionSchema.optional(),
  nextQuestion: z.string().optional(),
  momentCompleted: z.boolean().optional(),
  lessonCompleted: z.boolean().optional(),
  needsAutomaticAdvance: z.boolean().optional(),
  progressSummary: z.string().optional(),
  weakAreas: z
    .preprocess(value => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return [];
        }
        return trimmed.split(/[,\n]/).map(item => item.trim()).filter(Boolean);
      }
      if (Array.isArray(value)) {
        return value;
      }
      if (value === undefined || value === null) {
        return undefined;
      }
      return value;
    }, z.array(z.string()).optional()),
  riskMatrix: z.array(riskMatrixResultSchema).optional()
});

export const interactionLogSchema = z.preprocess(value => {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'action' in (value as Record<string, unknown>) && !(value as Record<string, unknown>).nextAction) {
    const { action, ...rest } = value as Record<string, unknown> & { action?: unknown };
    return { ...rest, nextAction: action };
  }
  return value;
}, interactionLogBaseSchema);

export const lessonSessionSchema = z.object({
  sessionId: z.string(),
  lesson: z.custom<Lesson>(),
  currentMomentIndex: z.number().int().min(0),
  currentStepIndex: z.number().int().min(0),
  completedMoments: z.array(z.string()),
  lessonCompleted: z.boolean(),
  history: z.array(interactionLogSchema)
});

export type LessonSession = z.infer<typeof lessonSessionSchema>;
export type InteractionLog = z.infer<typeof interactionLogSchema>;

export function createInitialSession(lesson: Lesson, sessionId: string): LessonSession {
  return {
    sessionId,
    lesson,
    currentMomentIndex: 0,
    currentStepIndex: 0,
    completedMoments: [],
    lessonCompleted: false,
    history: []
  };
}

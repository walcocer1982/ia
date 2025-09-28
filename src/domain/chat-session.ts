import { z } from 'zod';
import type { LessonSession } from './session.js';
import { lessonSessionSchema } from './session.js';
import type { EvaluationClassification } from './responses.js';

export const chatSessionSchema = z.object({
  lessonSession: lessonSessionSchema,
  attemptsByStep: z.record(z.number().int().nonnegative()).default({}),
  imageShownByStep: z.record(z.boolean()).default({}),
  lastClassification: z.custom<EvaluationClassification>().optional(),
  lastFollowUpQuestion: z.string().optional()
});

export type ChatSession = z.infer<typeof chatSessionSchema>;

export function createChatSession(lessonSession: LessonSession): ChatSession {
  return {
    lessonSession,
    attemptsByStep: {},
    imageShownByStep: {},
    lastClassification: undefined,
    lastFollowUpQuestion: undefined
  };
}

import { z } from 'zod';
import { lessonSessionSchema } from './session.js';
export const chatSessionSchema = z.object({
    lessonSession: lessonSessionSchema,
    attemptsByStep: z.record(z.number().int().nonnegative()).default({}),
    imageShownByStep: z.record(z.boolean()).default({}),
    lastClassification: z.custom().optional(),
    lastFollowUpQuestion: z.string().optional()
});
export function createChatSession(lessonSession) {
    return {
        lessonSession,
        attemptsByStep: {},
        imageShownByStep: {},
        lastClassification: undefined,
        lastFollowUpQuestion: undefined
    };
}

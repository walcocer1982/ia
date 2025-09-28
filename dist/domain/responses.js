import { z } from 'zod';
export const evaluationClassificationSchema = z.union([
    z.literal('ACCEPT'),
    z.literal('PARTIAL'),
    z.literal('HINT'),
    z.literal('REDIRECT')
]);
export const nextActionSchema = z.union([
    z.literal('advance'),
    z.literal('retry'),
    z.literal('clarify'),
    z.literal('complete')
]);
export const sophiaResponseSchema = z.object({
    chat: z.string(),
    classification: evaluationClassificationSchema,
    score: z.number().min(0).max(1),
    nextAction: nextActionSchema,
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
    }, z.array(z.string()).optional())
});

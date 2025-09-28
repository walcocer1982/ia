import { z } from 'zod';
import { nextActionSchema } from './responses.js';
import { riskMatrixResultSchema } from './risk-matrix.js';
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
    if (value && typeof value === 'object' && !Array.isArray(value) && 'action' in value && !value.nextAction) {
        const { action, ...rest } = value;
        return { ...rest, nextAction: action };
    }
    return value;
}, interactionLogBaseSchema);
export const lessonSessionSchema = z.object({
    sessionId: z.string(),
    lesson: z.custom(),
    currentMomentIndex: z.number().int().min(0),
    currentStepIndex: z.number().int().min(0),
    completedMoments: z.array(z.string()),
    lessonCompleted: z.boolean(),
    history: z.array(interactionLogSchema)
});
export function createInitialSession(lesson, sessionId) {
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
export function findCurrentStep(session) {
    const moment = session.lesson.moments[session.currentMomentIndex];
    if (!moment) {
        return null;
    }
    const step = moment.steps[session.currentStepIndex];
    if (!step || step.type !== 'ASK') {
        return null;
    }
    return step;
}

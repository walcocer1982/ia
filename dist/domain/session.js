import { z } from 'zod';
export const interactionLogSchema = z.object({
    timestamp: z.string().datetime(),
    stepCode: z.string(),
    question: z.string().optional(),
    userInput: z.string(),
    agentResponse: z.string(),
    score: z.number().min(0).max(1).optional(),
    classification: z.string().optional(),
    action: z.union([
        z.literal('advance'),
        z.literal('retry'),
        z.literal('clarify'),
        z.literal('complete')
    ])
});
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

import { z } from 'zod';
export const imageSchema = z.object({
    url: z.string().url(),
    description: z.string().min(1),
    placement: z.union([
        z.literal('before_question'),
        z.literal('with_question'),
        z.literal('after_question'),
        z.literal('after_content'),
        z.literal('with_case')
    ])
});
const baseStepSchema = z.object({
    code: z.string().min(1),
    type: z.union([
        z.literal('NARRATION'),
        z.literal('ASK'),
        z.literal('CONTENT'),
        z.literal('CASE')
    ])
});
export const narrationStepSchema = baseStepSchema.extend({
    type: z.literal('NARRATION'),
    text: z.string().min(1)
});
export const askStepSchema = baseStepSchema.extend({
    type: z.literal('ASK'),
    question: z.string().min(1),
    objective: z.string().min(1),
    answerType: z.union([
        z.literal('open'),
        z.literal('definition'),
        z.literal('list'),
        z.literal('procedure')
    ]),
    image: imageSchema.optional()
});
export const contentStepSchema = baseStepSchema.extend({
    type: z.literal('CONTENT'),
    body: z.array(z.string().min(1)).min(1),
    image: imageSchema.optional()
});
export const caseStepSchema = baseStepSchema.extend({
    type: z.literal('CASE'),
    title: z.string().min(1),
    description: z.string().min(1),
    variables: z.array(z.string().min(1)).min(1),
    image: imageSchema.optional()
});
export const stepSchema = z.union([
    narrationStepSchema,
    askStepSchema,
    contentStepSchema,
    caseStepSchema
]);
export const momentSchema = z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    steps: z.array(stepSchema).min(1)
});
export const lessonMetaSchema = z.object({
    lessonId: z.string().min(1),
    lessonName: z.string().min(1),
    version: z.string().min(1),
    language: z.string().min(1),
    ordered: z.boolean().default(true),
    generatedAt: z.string().datetime()
});
export const lessonSchema = z.object({
    meta: lessonMetaSchema,
    learningObjectives: z.array(z.string().min(1)).min(1),
    keyPoints: z.array(z.string().min(1)).min(1),
    moments: z.array(momentSchema).min(1)
});
export function assertLesson(value) {
    return lessonSchema.parse(value);
}

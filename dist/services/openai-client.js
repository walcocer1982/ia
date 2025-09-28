import { z } from 'zod';
import { riskMatrixResultSchema } from '../domain/risk-matrix.js';
import { OpenAIGateway } from './openai-gateway.js';
const conversationEntryBaseSchema = z.object({
    role: z.union([z.literal('user'), z.literal('assistant')]),
    message: z.string(),
    stepCode: z.string(),
    score: z.number().min(0).max(1).optional(),
    classification: z.string().optional(),
    nextAction: z.string().optional(),
    timestamp: z.string().optional(),
    nextQuestion: z.string().optional(),
    progressSummary: z.string().optional(),
    weakAreas: z.array(z.string()).optional(),
    riskMatrix: z.array(riskMatrixResultSchema).optional()
});
const conversationEntrySchema = z.preprocess((value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value;
        if ('action' in record && !('nextAction' in record)) {
            const { action, ...rest } = record;
            return { ...rest, nextAction: action };
        }
    }
    return value;
}, conversationEntryBaseSchema);
const evaluateStepRequestSchema = z.object({
    sessionId: z.string(),
    lesson: z.custom(),
    moment: z.custom(),
    step: z.custom(),
    userInput: z.string(),
    instructions: z.string(),
    history: z.array(conversationEntrySchema).default([])
});
export class OpenAIClient {
    gateway;
    constructor(options = {}) {
        this.gateway = new OpenAIGateway(options);
    }
    async evaluateStep(payload) {
        const safePayload = evaluateStepRequestSchema.parse(payload);
        return this.gateway.evaluateStep(safePayload);
    }
}

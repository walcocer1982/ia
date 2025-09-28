import { z } from 'zod';
import { riskMatrixResultSchema } from '../domain/risk-matrix.js';
import type { Lesson, Moment, Step } from '../domain/lesson.js';
import type { SophiaResponse } from '../domain/responses.js';
import { OpenAIGateway, type OpenAIGatewayOptions } from './openai-gateway.js';

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
    const record = value as Record<string, unknown>;
    if ('action' in record && !('nextAction' in record)) {
      const { action, ...rest } = record;
      return { ...rest, nextAction: action };
    }
  }
  return value;
}, conversationEntryBaseSchema);

const evaluateStepRequestSchema = z.object({
  sessionId: z.string(),
  lesson: z.custom<Lesson>(),
  moment: z.custom<Moment>(),
  step: z.custom<Step>(),
  userInput: z.string(),
  instructions: z.string(),
  history: z.array(conversationEntrySchema).default([])
});

export type EvaluateStepRequest = z.infer<typeof evaluateStepRequestSchema>;

export class OpenAIClient {
  private readonly gateway: OpenAIGateway;

  constructor(options: OpenAIGatewayOptions = {}) {
    this.gateway = new OpenAIGateway(options);
  }

  async evaluateStep(payload: EvaluateStepRequest): Promise<SophiaResponse> {
    const safePayload = evaluateStepRequestSchema.parse(payload);
    return this.gateway.evaluateStep(safePayload);
  }
}

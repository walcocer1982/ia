import OpenAI from 'openai';
import { z } from 'zod';
import type { Lesson, Moment, Step } from '../domain/lesson.js';
import { lessonPlanSchema } from '../domain/lesson-plan.js';
import { sophiaResponseSchema } from '../domain/responses.js';
import type { SophiaResponse } from '../domain/responses.js';
import { riskMatrixResultSchema } from '../domain/risk-matrix.js';
import { messageTypeSchema } from '../domain/agent-messages.js';

const conversationEntrySchema = z.object({
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

const evaluateStepRequestSchema = z.object({
  sessionId: z.string(),
  lesson: z.custom<Lesson>(),
  moment: z.custom<Moment>(),
  step: z.custom<Step>(),
  userInput: z.string(),
  instructions: z.string(),
  history: z.array(conversationEntrySchema).default([])
});

const collaboratorRequestSchema = evaluateStepRequestSchema.omit({ instructions: true }).extend({
  role: z.string().min(1),
  roleInstructions: z.string().min(1),
  baseResponse: z.custom<SophiaResponse>().optional()
});

const collaboratorResponseSchema = z.object({
  messageType: messageTypeSchema,
  message: z.string().min(1),
  suggestions: z.array(z.string().min(1)).optional(),
  followUpQuestion: z.string().optional()
});

const lessonPlanRequestSchema = z.object({
  lesson: z.custom<Lesson>(),
  analysis: z.object({
    missingMoments: z.array(z.string()),
    hasImages: z.boolean(),
    questionCountByMoment: z.record(z.number()),
    summary: z.string()
  }),
  instructions: z.string()
});

export type CollaboratorResponse = z.infer<typeof collaboratorResponseSchema>;

export interface OpenAIGatewayOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
}

export class OpenAIGateway {
  private client: OpenAI | null = null;
  private readonly model: string;
  private readonly temperature: number;

  constructor(private readonly options: OpenAIGatewayOptions = {}) {
    this.model = options.model ?? process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4o-mini';
    this.temperature = options.temperature ?? 0.3;
  }

  private async ensureClient(): Promise<void> {
    if (this.client) {
      return;
    }

    const apiKey = this.options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no esta definido. Configura la variable de entorno antes de iniciar.');
    }

    this.client = new OpenAI({ apiKey });
  }

  async evaluateStep(payload: z.infer<typeof evaluateStepRequestSchema>) {
    const safePayload = evaluateStepRequestSchema.parse(payload);
    await this.ensureClient();

    if (!this.client) {
      throw new Error('OpenAI client no inicializado');
    }

    const systemPrompt = [
      'Eres Sophia Fuentes, instructora virtual de seguridad industrial.',
      'Evalua la respuesta del estudiante y devuelve un JSON valido.',
      'Mantente en espanol neutro y con tono calido.'
    ].join(' ');

    const historyPayload = safePayload.history.map(entry => ({
      role: entry.role,
      message: entry.message,
      stepCode: entry.stepCode,
      score: entry.score,
      classification: entry.classification,
      nextAction: entry.nextAction,
      timestamp: entry.timestamp,
      nextQuestion: entry.nextQuestion,
      progressSummary: entry.progressSummary,
      weakAreas: entry.weakAreas,
      riskMatrix: entry.riskMatrix
    }));

    const userPrompt = [
      'CONTEXTO_SESION_JSON',
      JSON.stringify({
        sessionId: safePayload.sessionId,
        lessonMeta: safePayload.lesson.meta,
        moment: safePayload.moment,
        step: safePayload.step,
        userInput: safePayload.userInput,
        history: historyPayload
      }, null, 2),
      '',
      'INSTRUCCIONES_DE_SOPHIA',
      safePayload.instructions,
      '',
      'FORMATO_JSON_REQUERIDO',
      'Devuelve un objeto JSON con las claves:',
      '- chat: string con el mensaje para el estudiante.',
      '- classification: "ACCEPT"|"PARTIAL"|"HINT"|"REDIRECT".',
      '- score: number entre 0 y 1.',
      '- nextAction: "advance"|"retry"|"clarify"|"complete".',
      '- nextQuestion (opcional).',
      '- momentCompleted, lessonCompleted, needsAutomaticAdvance (opcionales).',
      '- progressSummary, weakAreas, riskMatrix (opcionales).',
      '',
      'No incluyas texto fuera del JSON.'
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    if (!rawText) {
      throw new Error('OpenAI devolvio una respuesta vacia al evaluar el paso.');
    }

    const jsonText = extractJson(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw buildJsonError('evaluacion de paso', rawText, jsonText, error);
    }

    return sophiaResponseSchema.parse(parsed);
  }

  async runCollaborator(payload: z.infer<typeof collaboratorRequestSchema>): Promise<CollaboratorResponse> {
    const safePayload = collaboratorRequestSchema.parse(payload);
    await this.ensureClient();

    if (!this.client) {
      throw new Error('OpenAI client no inicializado');
    }

    const systemPrompt = [
      `Actuas como agente colaborador en el rol ${safePayload.role}.`,
      'Complementa la respuesta principal manteniendo coherencia con Sophia.',
      'Responde en JSON valido segun el formato solicitado.'
    ].join(' ');

    const payloadForModel = {
      sessionId: safePayload.sessionId,
      lessonMeta: safePayload.lesson.meta,
      moment: safePayload.moment,
      step: safePayload.step,
      userInput: safePayload.userInput,
      baseResponse: safePayload.baseResponse,
      history: safePayload.history.map(entry => ({
        role: entry.role,
        message: entry.message,
        stepCode: entry.stepCode,
        score: entry.score,
        classification: entry.classification,
        nextAction: entry.nextAction,
        timestamp: entry.timestamp,
        nextQuestion: entry.nextQuestion,
        progressSummary: entry.progressSummary,
        weakAreas: entry.weakAreas,
        riskMatrix: entry.riskMatrix
      }))
    };

    const userPrompt = [
      'CONTEXTO_COLABORADOR_JSON',
      JSON.stringify(payloadForModel, null, 2),
      '',
      'INSTRUCCIONES_DEL_ROL',
      safePayload.roleInstructions,
      '',
      'FORMATO_JSON_REQUERIDO',
      'Devuelve un objeto JSON con las claves:',
      '- messageType: "FEEDBACK"|"PISTA"|"PREGUNTA"|"IMAGEN".',
      '- message: string.',
      '- suggestions: array de strings (opcional).',
      '- followUpQuestion: string (opcional).',
      '',
      'No incluyas texto fuera del JSON.'
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    if (!rawText) {
      throw new Error('OpenAI devolvio una respuesta vacia para el agente colaborador.');
    }

    const jsonText = extractJson(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw buildJsonError('agente colaborador', rawText, jsonText, error);
    }

    return collaboratorResponseSchema.parse(parsed);
  }

  async generateLessonPlan(payload: z.infer<typeof lessonPlanRequestSchema>) {
    const safePayload = lessonPlanRequestSchema.parse(payload);
    await this.ensureClient();

    if (!this.client) {
      throw new Error('OpenAI client no inicializado');
    }

    const systemPrompt = [
      'Eres un planificador instruccional experto.',
      'Genera una leccion completa siguiendo el esquema proporcionado.',
      'Responde unicamente con JSON valido.'
    ].join(' ');

    const userPrompt = [
      'LECCION_BASE_JSON',
      JSON.stringify(safePayload.lesson, null, 2),
      '',
      'ANALISIS_ACTUAL_JSON',
      JSON.stringify(safePayload.analysis, null, 2),
      '',
      'INSTRUCCIONES_ADICIONALES',
      safePayload.instructions,
      '',
      'FORMATO_JSON_REQUERIDO',
      'Devuelve un objeto compatible con lessonSchema.'
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const rawText = completion.choices[0]?.message?.content ?? '';
    if (!rawText) {
      throw new Error('OpenAI devolvio una respuesta vacia para el plan de leccion.');
    }

    const jsonText = extractJson(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw buildJsonError('plan de leccion', rawText, jsonText, error);
    }

    return lessonPlanSchema.parse(parsed);
  }
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

function buildJsonError(context: string, rawText: string, jsonText: string, error: unknown): Error {
  const details = [
    `No se pudo parsear la respuesta JSON para ${context}.`,
    `Respuesta original: ${rawText}`,
    `Fragmento considerado JSON: ${jsonText}`,
    `Error: ${error instanceof Error ? error.message : String(error)}`
  ].join('\n');
  return new Error(details);
}
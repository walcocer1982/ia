import OpenAI from 'openai';
import { z } from 'zod';
const conversationEntrySchema = z.object({
    role: z.union([z.literal('user'), z.literal('assistant')]),
    message: z.string(),
    stepCode: z.string(),
    score: z.number().min(0).max(1).optional(),
    classification: z.string().optional(),
    action: z.string().optional(),
    timestamp: z.string().optional()
});
const openaiRequestSchema = z.object({
    sessionId: z.string(),
    lesson: z.custom(),
    moment: z.custom(),
    step: z.custom(),
    userInput: z.string(),
    instructions: z.string(),
    history: z.array(conversationEntrySchema).default([])
});
const sophiaJsonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['chat', 'classification', 'score', 'nextAction'],
    properties: {
        chat: {
            type: 'string',
            description: 'Mensaje conversacional en espanol para el estudiante, tono calido y evaluativo.'
        },
        classification: {
            type: 'string',
            enum: ['ACCEPT', 'PARTIAL', 'HINT', 'REDIRECT']
        },
        score: {
            type: 'number',
            minimum: 0,
            maximum: 1
        },
        nextAction: {
            type: 'string',
            enum: ['advance', 'retry', 'clarify', 'complete']
        },
        nextQuestion: {
            type: 'string'
        },
        momentCompleted: {
            type: 'boolean'
        },
        lessonCompleted: {
            type: 'boolean'
        },
        needsAutomaticAdvance: {
            type: 'boolean'
        },
        progressSummary: {
            type: 'string'
        },
        weakAreas: {
            type: 'array',
            items: { type: 'string' }
        }
    }
};
export class OpenAIClient {
    options;
    client = null;
    model;
    temperature;
    constructor(options = {}) {
        this.options = options;
        this.model = options.model ?? process.env.OPENAI_DEFAULT_MODEL ?? 'gpt-4o-mini';
        this.temperature = options.temperature ?? 0.3;
    }
    async ensureClient() {
        if (this.client) {
            return;
        }
        const apiKey = this.options.apiKey ?? process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY no esta definido. Configura la variable de entorno antes de iniciar la sesion.');
        }
        this.client = new OpenAI({ apiKey });
    }
    async evaluateStep(payload) {
        const safePayload = openaiRequestSchema.parse(payload);
        await this.ensureClient();
        if (!this.client) {
            throw new Error('OpenAI client not initialized');
        }
        const systemPrompt = [
            'Eres el motor educativo de Sophia Fuentes.',
            'Debes evaluar la respuesta del estudiante apoyandote en los contenidos de la leccion y el rol asignado.',
            'Responde unicamente en formato JSON valido segun el esquema proporcionado.'
        ].join(' ');
        const conversationHistory = safePayload.history.map(entry => ({
            rol: entry.role,
            mensaje: entry.message,
            paso: entry.stepCode,
            score: entry.score,
            clasificacion: entry.classification,
            accion: entry.action,
            timestamp: entry.timestamp
        }));
        const userPrompt = [
            'CONTEXTO_EDUCATIVO_JSON',
            JSON.stringify({
                sessionId: safePayload.sessionId,
                lessonMeta: safePayload.lesson.meta,
                moment: {
                    code: safePayload.moment.code,
                    title: safePayload.moment.title
                },
                step: safePayload.step,
                conversationHistory,
                userInput: safePayload.userInput
            }, null, 2),
            '',
            'INSTRUCCIONES_DE_ROL',
            safePayload.instructions,
            '',
            'FORMATO_DE_RESPUESTA_REQUERIDO:',
            'Debes responder EXCLUSIVAMENTE con un objeto JSON válido que contenga las siguientes claves:',
            '- chat: string (mensaje conversacional en español, tono cálido y evaluativo)',
            '- classification: "ACCEPT" | "PARTIAL" | "HINT" | "REDIRECT"',
            '- score: number entre 0 y 1',
            '- nextAction: "advance" | "retry" | "clarify" | "complete"',
            '- nextQuestion: string (opcional)',
            '- momentCompleted: boolean (opcional)',
            '- lessonCompleted: boolean (opcional)',
            '- needsAutomaticAdvance: boolean (opcional)',
            '- progressSummary: string (opcional)',
            '- weakAreas: array de strings (opcional)',
            '',
            'NO incluyas texto adicional fuera del JSON. Solo devuelve el objeto JSON válido.'
        ].join('\n');
        const result = await this.client.chat.completions.create({
            model: this.model,
            temperature: this.temperature,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ]
        });
        const rawText = result.choices[0]?.message?.content ?? '';
        if (!rawText) {
            throw new Error('OpenAI devolvió una respuesta vacía');
        }
        // Limpiar el texto de respuesta para extraer solo el JSON
        let jsonText = rawText.trim();
        // Buscar el JSON en la respuesta (puede venir con texto adicional)
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        }
        catch (error) {
            console.error('Error parsing JSON:', error);
            console.error('Raw response:', rawText);
            console.error('Extracted JSON:', jsonText);
            throw new Error(`No se pudo parsear la respuesta JSON de OpenAI. Respuesta original: ${rawText}`);
        }
        const { sophiaResponseSchema } = await import('../domain/responses.js');
        return sophiaResponseSchema.parse(parsed);
    }
}

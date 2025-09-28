import { z } from 'zod';
export const messageTypeSchema = z.union([
    z.literal('FEEDBACK'),
    z.literal('PISTA'),
    z.literal('PREGUNTA'),
    z.literal('IMAGEN')
]);
export const structuredAgentMessageSchema = z.object({
    role: z.string(),
    messageType: messageTypeSchema,
    text: z.string(),
    suggestions: z.array(z.string()).optional(),
    followUpQuestion: z.string().optional()
});

import { z } from 'zod';
import type { Role } from '../agents/educational-roles.js';

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

export type MessageType = z.infer<typeof messageTypeSchema>;

export interface StructuredAgentMessage {
  role: Role;
  messageType: MessageType;
  text: string;
  suggestions?: string[];
  followUpQuestion?: string;
}

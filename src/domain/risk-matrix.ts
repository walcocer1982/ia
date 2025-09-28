import { z } from 'zod';

export const riskProbabilitySchema = z.union([
  z.literal('rare'),
  z.literal('unlikely'),
  z.literal('possible'),
  z.literal('likely'),
  z.literal('almostCertain')
]);

export const riskSeveritySchema = z.union([
  z.literal('minor'),
  z.literal('moderate'),
  z.literal('major'),
  z.literal('critical')
]);

export const riskLevelSchema = z.union([
  z.literal('low'),
  z.literal('medium'),
  z.literal('high'),
  z.literal('extreme')
]);

export const riskMatrixResultSchema = z.object({
  hazard: z.string().min(1),
  description: z.string().optional(),
  probability: riskProbabilitySchema,
  severity: riskSeveritySchema,
  riskLevel: riskLevelSchema,
  justification: z.string().optional(),
  existingControls: z.array(z.string()).optional(),
  recommendedControls: z.array(z.string()).optional()
});

export type RiskMatrixResult = z.infer<typeof riskMatrixResultSchema>;

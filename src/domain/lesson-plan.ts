import { z } from 'zod';
import { lessonSchema } from './lesson.js';

export const lessonPlanSchema = lessonSchema;
export type LessonPlan = z.infer<typeof lessonPlanSchema>;

export interface LessonPlanAnalysis {
  missingMoments: string[];
  hasImages: boolean;
  questionCountByMoment: Record<string, number>;
  summary: string;
}

import type { Step } from '../domain/lesson.js';
import { assertLesson } from '../domain/lesson.js';
import type { LessonSession } from '../domain/session.js';
import { SophiaMultiAgentService, type ProcessStepResult } from '../services/sophia-multiagent-service.js';
import { nowIso } from '../utils/time.js';

export interface StepPresentation {
  momentCode: string;
  momentTitle: string;
  step: Step;
  lines: string[];
  expectsResponse: boolean;
}

export class LessonRunner {
  private readonly service: SophiaMultiAgentService;

  constructor(service?: SophiaMultiAgentService) {
    this.service = service ?? new SophiaMultiAgentService();
  }

  loadLesson(rawLesson: unknown, sessionId: string): LessonSession {
    const lesson = assertLesson(rawLesson);
    return this.service.createSession(lesson, sessionId);
  }

  getCurrentPresentation(session: LessonSession): StepPresentation | null {
    const moment = session.lesson.moments[session.currentMomentIndex];
    if (!moment) {
      return null;
    }
    const step = moment.steps[session.currentStepIndex];
    if (!step) {
      return null;
    }

    const lines: string[] = [];
    if (step.type === 'NARRATION') {
      lines.push(step.text);
    } else if (step.type === 'CONTENT') {
      lines.push(...step.body);
      if (step.image) {
        lines.push(`Imagen sugerida: ${step.image.description}`);
        lines.push(`URL: ${step.image.url}`);
      }
    } else if (step.type === 'ASK') {
      if (step.image) {
        lines.push(`Imagen sugerida: ${step.image.description}`);
        lines.push(`URL: ${step.image.url}`);
      }
      lines.push(`Pregunta: ${step.question}`);
      lines.push(`Objetivo: ${step.objective}`);
      lines.push(`Tipo de respuesta esperado: ${step.answerType}`);
    } else if (step.type === 'CASE') {
      lines.push(`Caso: ${step.title}`);
      lines.push(step.description);
      lines.push(`Variables clave: ${step.variables.join(', ')}`);
      if (step.image) {
        lines.push(`Imagen sugerida: ${step.image.description}`);
        lines.push(`URL: ${step.image.url}`);
      }
    }

    const expectsResponse = step.type === 'ASK';

    return {
      momentCode: moment.code,
      momentTitle: moment.title,
      step,
      lines,
      expectsResponse
    };
  }

  async handleUserInput(session: LessonSession, userInput: string): Promise<ProcessStepResult> {
    return this.service.processUserInput(session, userInput);
  }

  advancePassiveStep(session: LessonSession): LessonSession {
    const moment = session.lesson.moments[session.currentMomentIndex];
    if (!moment) {
      return session;
    }
    const step = moment.steps[session.currentStepIndex];
    if (!step) {
      return session;
    }
    if (step.type === 'ASK') {
      return session;
    }

    const historyEntry = {
      timestamp: nowIso(),
      stepCode: step.code,
      question: undefined,
      userInput: '[automatic]',
      agentResponse: 'Paso informativo completado automaticamente.',
      score: undefined,
      classification: undefined,
      action: 'advance' as const
    };

    const history = [...session.history, historyEntry];

    let currentMomentIndex = session.currentMomentIndex;
    let currentStepIndex = session.currentStepIndex + 1;
    const completedMoments = new Set(session.completedMoments);

    if (currentStepIndex >= moment.steps.length) {
      completedMoments.add(moment.code);
      currentMomentIndex += 1;
      currentStepIndex = 0;
    }

    const lessonCompleted = currentMomentIndex >= session.lesson.moments.length;

    return {
      ...session,
      currentMomentIndex: lessonCompleted ? session.lesson.moments.length - 1 : currentMomentIndex,
      currentStepIndex: lessonCompleted ? session.lesson.moments[session.lesson.moments.length - 1].steps.length - 1 : currentStepIndex,
      completedMoments: Array.from(completedMoments),
      lessonCompleted,
      history
    };
  }
}
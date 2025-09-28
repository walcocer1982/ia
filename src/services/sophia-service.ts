import { nowIso } from '../utils/time.js';
import { createInitialSession, lessonSessionSchema, type InteractionLog, type LessonSession } from '../domain/session.js';
import type { AskStep, Lesson, Moment } from '../domain/lesson.js';
import type { SophiaResponse } from '../domain/responses.js';
import { OpenAIClient } from './openai-client.js';
import { SophiaPersonality } from '../agents/sophia-personality.js';
import { EducationalRoles, type RoleDecision } from '../agents/educational-roles.js';

interface PersonalityContextSnapshot {
  lesson: Lesson;
  currentMoment: Moment;
  step: AskStep;
  attempts: number;
  historyLength: number;
}

interface ModelHistoryItem {
  role: 'user' | 'assistant';
  message: string;
  stepCode: string;
  score?: number;
  classification?: string;
  nextAction?: string;
  timestamp?: string;
  nextQuestion?: string;
  progressSummary?: string;
  weakAreas?: string[];
  riskMatrix?: SophiaResponse['riskMatrix'];
}

export interface ProcessUserInputResult {
  session: LessonSession;
  response: SophiaResponse;
  roleDecision: RoleDecision;
  instructions: string;
}

export class SophiaService {
  constructor(private readonly openaiClient = new OpenAIClient()) {}

  createSession(lesson: Lesson, sessionId: string): LessonSession {
    return createInitialSession(lesson, sessionId);
  }

  async processUserInput(session: LessonSession, userInput: string): Promise<ProcessUserInputResult> {
    const safeSession = lessonSessionSchema.parse(session);
    const moment = safeSession.lesson.moments[safeSession.currentMomentIndex];

    if (!moment) {
      throw new Error('Invalid session state: current moment not found');
    }

    const step = moment.steps[safeSession.currentStepIndex];
    if (!step || step.type !== 'ASK') {
      throw new Error('Current step does not expect a user response.');
    }

    const snapshot = this.buildSnapshot(safeSession, moment, step);

    const personalityContext = {
      lesson: snapshot.lesson,
      currentMoment: snapshot.currentMoment,
      objective: step.objective,
      stepCode: step.code,
      hasImage: Boolean(step.image),
      imageDescription: step.image?.description,
      attempts: snapshot.attempts,
      historyLength: snapshot.historyLength,
      question: step.question,
      answerType: step.answerType
    };

    const baseInstructions = SophiaPersonality.buildInstructions(personalityContext);
    const roleDecision = EducationalRoles.decideRoleFromInput(userInput, personalityContext);
    const roleInstructions = EducationalRoles.getInstructions(roleDecision.role, personalityContext);

    const finalInstructions = [
      baseInstructions,
      '',
      'Rol asignado:',
      roleDecision.role,
      'Intencion:',
      roleDecision.intent,
      '',
      roleInstructions,
      '',
      'Devuelve un objeto JSON con las claves: chat, classification, score, nextAction.',
      'Puedes incluir los campos opcionales: nextQuestion, momentCompleted, lessonCompleted, needsAutomaticAdvance, progressSummary, weakAreas, riskMatrix.'
    ].join('\n');

    const historyForModel = this.buildHistoryForModel(safeSession.history);

    const response = await this.openaiClient.evaluateStep({
      sessionId: safeSession.sessionId,
      lesson: safeSession.lesson,
      moment,
      step,
      userInput,
      instructions: finalInstructions,
      history: historyForModel
    });

    const updatedSession = applyResponseToSession(safeSession, response, moment, step, userInput);

    return {
      session: updatedSession,
      response,
      roleDecision,
      instructions: finalInstructions
    };
  }

  private buildSnapshot(session: LessonSession, moment: Moment, step: AskStep): PersonalityContextSnapshot {
    const historyForStep = session.history.filter((entry: InteractionLog) => entry.stepCode === step.code);

    return {
      lesson: session.lesson,
      currentMoment: moment,
      step,
      attempts: historyForStep.length + 1,
      historyLength: session.history.length
    };
  }

  private buildHistoryForModel(history: InteractionLog[]): ModelHistoryItem[] {
    const items: ModelHistoryItem[] = [];

    for (const entry of history) {
      if (entry.userInput === '[automatic]') {
        continue;
      }

      items.push({
        role: 'user',
        message: entry.userInput,
        stepCode: entry.stepCode,
        score: entry.score,
        classification: entry.classification,
        nextAction: entry.nextAction,
        timestamp: entry.timestamp,
        nextQuestion: entry.nextQuestion,
        progressSummary: entry.progressSummary,
        weakAreas: entry.weakAreas,
        riskMatrix: entry.riskMatrix
      });

      if (entry.agentResponse) {
        items.push({
          role: 'assistant',
          message: entry.agentResponse,
          stepCode: entry.stepCode,
          score: entry.score,
          classification: entry.classification,
          nextAction: entry.nextAction,
          timestamp: entry.timestamp,
          nextQuestion: entry.nextQuestion,
          progressSummary: entry.progressSummary,
          weakAreas: entry.weakAreas,
          riskMatrix: entry.riskMatrix
        });
      }
    }

    return items;
  }
}

function applyResponseToSession(
  session: LessonSession,
  response: SophiaResponse,
  moment: Moment,
  step: AskStep,
  userInput: string
): LessonSession {
  const interaction: InteractionLog = {
    timestamp: nowIso(),
    stepCode: step.code,
    question: step.question,
    userInput,
    agentResponse: response.chat,
    score: response.score,
    classification: response.classification,
    nextAction: response.nextAction,
    nextQuestion: response.nextQuestion,
    momentCompleted: response.momentCompleted,
    lessonCompleted: response.lessonCompleted,
    needsAutomaticAdvance: response.needsAutomaticAdvance,
    progressSummary: response.progressSummary,
    weakAreas: response.weakAreas,
    riskMatrix: response.riskMatrix
  };

  const history = [...session.history, interaction];

  let currentMomentIndex = session.currentMomentIndex;
  let currentStepIndex = session.currentStepIndex;
  const completedMoments = new Set(session.completedMoments);
  let lessonCompleted = session.lessonCompleted || Boolean(response.lessonCompleted);

  if (response.momentCompleted) {
    completedMoments.add(moment.code);
  }

  const shouldAdvanceStep =
    response.nextAction === 'advance' ||
    response.nextAction === 'complete' ||
    response.needsAutomaticAdvance;

  if (shouldAdvanceStep) {
    const nextStepIndex = currentStepIndex + 1;
    const stepsInMoment = session.lesson.moments[currentMomentIndex]?.steps.length ?? 0;

    if (nextStepIndex < stepsInMoment) {
      currentStepIndex = nextStepIndex;
    } else {
      completedMoments.add(moment.code);
      currentMomentIndex += 1;
      currentStepIndex = 0;

      if (currentMomentIndex >= session.lesson.moments.length) {
        lessonCompleted = true;
        currentMomentIndex = Math.max(0, session.lesson.moments.length - 1);
        const fallbackMoment = session.lesson.moments[currentMomentIndex];
        const lastStepIndex = Math.max(0, (fallbackMoment?.steps.length ?? 1) - 1);
        currentStepIndex = lastStepIndex;
      }
    }
  }

  if (response.nextAction === 'complete') {
    lessonCompleted = true;
  }

  return {
    ...session,
    currentMomentIndex,
    currentStepIndex,
    completedMoments: Array.from(completedMoments),
    lessonCompleted,
    history
  };
}

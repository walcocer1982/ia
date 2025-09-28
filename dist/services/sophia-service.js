import { nowIso } from '../utils/time.js';
import { createInitialSession, lessonSessionSchema } from '../domain/session.js';
import { OpenAIClient } from './openai-client.js';
import { SophiaPersonality } from '../agents/sophia-personality.js';
import { EducationalRoles } from '../agents/educational-roles.js';
export class SophiaService {
    openaiClient;
    constructor(openaiClient = new OpenAIClient()) {
        this.openaiClient = openaiClient;
    }
    createSession(lesson, sessionId) {
        return createInitialSession(lesson, sessionId);
    }
    async processUserInput(session, userInput) {
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
    buildSnapshot(session, moment, step) {
        const historyForStep = session.history.filter((entry) => entry.stepCode === step.code);
        return {
            lesson: session.lesson,
            currentMoment: moment,
            step,
            attempts: historyForStep.length + 1,
            historyLength: session.history.length
        };
    }
    buildHistoryForModel(history) {
        const items = [];
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
function applyResponseToSession(session, response, moment, step, userInput) {
    const interaction = {
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
    const shouldAdvanceStep = response.nextAction === 'advance' ||
        response.nextAction === 'complete' ||
        response.needsAutomaticAdvance;
    if (shouldAdvanceStep) {
        const nextStepIndex = currentStepIndex + 1;
        const stepsInMoment = session.lesson.moments[currentMomentIndex]?.steps.length ?? 0;
        if (nextStepIndex < stepsInMoment) {
            currentStepIndex = nextStepIndex;
        }
        else {
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

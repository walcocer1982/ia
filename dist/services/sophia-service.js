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
        const personalityContext = {
            lesson: safeSession.lesson,
            currentMoment: moment,
            objective: step.objective,
            stepCode: step.code,
            hasImage: Boolean(step.image),
            imageDescription: step.image?.description,
            attempts: safeSession.history.filter(entry => entry.stepCode === step.code).length + 1,
            historyLength: safeSession.history.length
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
            'Devuelve un objeto JSON con las claves: chat, classification, score, nextAction, nextQuestion opcional, momentCompleted opcional, lessonCompleted opcional, needsAutomaticAdvance opcional, progressSummary opcional, weakAreas opcional.'
        ].join('\n');
        const historyForModel = safeSession.history.flatMap(entry => {
            if (entry.userInput === '[automatic]') {
                return [];
            }
            const items = [];
            items.push({
                role: 'user',
                message: entry.userInput,
                stepCode: entry.stepCode,
                score: entry.score,
                classification: entry.classification,
                action: entry.action,
                timestamp: entry.timestamp
            });
            if (entry.agentResponse) {
                items.push({
                    role: 'assistant',
                    message: entry.agentResponse,
                    stepCode: entry.stepCode,
                    score: entry.score,
                    classification: entry.classification,
                    action: entry.action,
                    timestamp: entry.timestamp
                });
            }
            return items;
        });
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
}
function applyResponseToSession(session, response, moment, step, userInput) {
    const interaction = {
        timestamp: nowIso(),
        stepCode: step.code,
        question: step.type === 'ASK' ? step.question : undefined,
        userInput,
        agentResponse: response.chat,
        score: response.score,
        classification: response.classification,
        action: response.nextAction
    };
    const history = [...session.history, interaction];
    let currentMomentIndex = session.currentMomentIndex;
    let currentStepIndex = session.currentStepIndex;
    const completedMoments = new Set(session.completedMoments);
    let lessonCompleted = session.lessonCompleted;
    const shouldAdvanceStep = response.nextAction === 'advance' || response.nextAction === 'complete' || response.needsAutomaticAdvance;
    if (shouldAdvanceStep) {
        const nextStepIndex = currentStepIndex + 1;
        if (nextStepIndex < session.lesson.moments[currentMomentIndex].steps.length) {
            currentStepIndex = nextStepIndex;
        }
        else {
            completedMoments.add(moment.code);
            currentMomentIndex += 1;
            currentStepIndex = 0;
            if (currentMomentIndex >= session.lesson.moments.length) {
                lessonCompleted = true;
                currentMomentIndex = session.lesson.moments.length - 1;
                currentStepIndex = session.lesson.moments[currentMomentIndex].steps.length - 1;
            }
        }
    }
    if (response.nextAction === 'complete' || response.lessonCompleted) {
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

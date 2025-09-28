import { chatSessionSchema, createChatSession } from '../domain/chat-session.js';
import { SophiaMultiAgentService } from './sophia-multiagent-service.js';
export class MultiAgentChatService {
    sophiaService;
    constructor(sophiaService = new SophiaMultiAgentService()) {
        this.sophiaService = sophiaService;
    }
    createSession(lesson, sessionId) {
        const lessonSession = this.sophiaService.createSession(lesson, sessionId);
        return createChatSession(lessonSession);
    }
    async processUserInput(chatSession, userInput) {
        const safeSession = chatSessionSchema.parse(chatSession);
        const { lessonSession } = safeSession;
        const currentMoment = lessonSession.lesson.moments[lessonSession.currentMomentIndex];
        const currentStep = currentMoment?.steps[lessonSession.currentStepIndex];
        const result = await this.sophiaService.processUserInput(lessonSession, userInput);
        const attemptsByStep = { ...safeSession.attemptsByStep };
        if (currentStep?.type === 'ASK') {
            attemptsByStep[currentStep.code] = (attemptsByStep[currentStep.code] ?? 0) + 1;
        }
        const imageShownByStep = { ...safeSession.imageShownByStep };
        if (currentStep && 'image' in currentStep && currentStep.image) {
            imageShownByStep[currentStep.code] = true;
        }
        const nextChatSession = {
            lessonSession: result.session,
            attemptsByStep,
            imageShownByStep,
            lastClassification: result.response.classification,
            lastFollowUpQuestion: result.response.nextQuestion ?? safeSession.lastFollowUpQuestion
        };
        return {
            session: nextChatSession,
            result,
            structuredMessages: result.structuredMessages
        };
    }
}

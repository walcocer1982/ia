import { assertLesson } from '../domain/lesson.js';
import { MultiAgentChatService } from '../services/multiagent-chat-service.js';
import { LessonRunner } from './lesson-runner.js';
export class ChatRunner {
    service;
    lessonRunner;
    constructor(service) {
        this.service = service ?? new MultiAgentChatService();
        this.lessonRunner = new LessonRunner();
    }
    loadLesson(rawLesson, sessionId) {
        const lesson = assertLesson(rawLesson);
        return this.service.createSession(lesson, sessionId);
    }
    getCurrentPresentation(session) {
        return this.lessonRunner.getCurrentPresentation(session.lessonSession);
    }
    advancePassiveStep(session) {
        const lessonSession = this.lessonRunner.advancePassiveStep(session.lessonSession);
        return {
            ...session,
            lessonSession
        };
    }
    async handleUserInput(session, userInput) {
        return this.service.processUserInput(session, userInput);
    }
}

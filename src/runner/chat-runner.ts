import type { Step } from '../domain/lesson.js';
import { assertLesson } from '../domain/lesson.js';
import type { LessonSession } from '../domain/session.js';
import type { ChatSession } from '../domain/chat-session.js';
import { MultiAgentChatService, type ProcessChatResult } from '../services/multiagent-chat-service.js';
import { LessonRunner } from './lesson-runner.js';

export interface ChatStepPresentation {
  momentCode: string;
  momentTitle: string;
  step: Step;
  lines: string[];
  expectsResponse: boolean;
}

export class ChatRunner {
  private readonly service: MultiAgentChatService;
  private readonly lessonRunner: LessonRunner;

  constructor(service?: MultiAgentChatService) {
    this.service = service ?? new MultiAgentChatService();
    this.lessonRunner = new LessonRunner();
  }

  loadLesson(rawLesson: unknown, sessionId: string): ChatSession {
    const lesson = assertLesson(rawLesson);
    return this.service.createSession(lesson, sessionId);
  }

  getCurrentPresentation(session: ChatSession): ChatStepPresentation | null {
    return this.lessonRunner.getCurrentPresentation(session.lessonSession);
  }

  advancePassiveStep(session: ChatSession): ChatSession {
    const lessonSession = this.lessonRunner.advancePassiveStep(session.lessonSession);
    return {
      ...session,
      lessonSession
    };
  }

  async handleUserInput(session: ChatSession, userInput: string): Promise<ProcessChatResult> {
    return this.service.processUserInput(session, userInput);
  }
}
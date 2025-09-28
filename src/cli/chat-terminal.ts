import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { z } from 'zod';

import { lesson01 } from '../data/lesson01.js';
import { ChatRunner } from '../runner/chat-runner.js';
import { structuredAgentMessageSchema } from '../domain/agent-messages.js';
import type { ProcessChatResult } from '../services/multiagent-chat-service.js';

const rl = readline.createInterface({ input, output });

const runner = new ChatRunner();
let session = runner.loadLesson(lesson01, `chat-${Date.now()}`);
const imageShownForStep = new Set<string>();
let presentedStepCode: string | null = null;

const structuredMessagesArraySchema = z.array(structuredAgentMessageSchema);

const labelMap = {
  FEEDBACK: 'Feedback',
  PISTA: 'Pista',
  PREGUNTA: 'Pregunta',
  IMAGEN: 'Imagen'
} as const;

type LabelKey = keyof typeof labelMap;

type StructuredMessage = z.infer<typeof structuredAgentMessageSchema>;

type ChatStepPresentation = ReturnType<ChatRunner['getCurrentPresentation']>;

type NonNullablePresentation = Exclude<ChatStepPresentation, null>;

function printHeading(text: string): void {
  console.log('');
  console.log(text);
}

function printPresentation(): void {
  while (true) {
    const presentation = runner.getCurrentPresentation(session);
    if (!presentation) {
      return;
    }

    if (presentation.expectsResponse) {
      if (presentedStepCode === presentation.step.code) {
        return;
      }
      presentedStepCode = presentation.step.code;
    } else {
      presentedStepCode = null;
    }

    printHeading(`Momento ${presentation.momentCode} - ${presentation.momentTitle}`);
    printHeading(`Paso ${presentation.step.code} [${presentation.step.type}]`);

    const linesToShow = presentation.expectsResponse && presentation.step.type === 'ASK'
      ? presentation.lines.filter(line => !line.startsWith('Imagen sugerida') && !line.startsWith('URL:'))
      : presentation.lines;

    for (const line of linesToShow) {
      console.log(line);
    }

    if (presentation.expectsResponse) {
      const step = presentation.step as NonNullablePresentation['step'];
      if ('image' in step && step.image && !imageShownForStep.has(step.code)) {
        console.log('');
        console.log('[Imagen] ' + step.image.description);
        console.log(step.image.url);
        imageShownForStep.add(step.code);
      }
      return;
    }

    session = runner.advancePassiveStep(session);
  }
}

function formatLabel(message: StructuredMessage): string {
  const base = labelMap[message.messageType as LabelKey] ?? 'Mensaje';
  const role = message.role ? ` - ${message.role}` : '';
  return `${base}${role}`;
}

function printStructuredMessages(messages: StructuredMessage[]): void {
  for (const message of messages) {
    const label = formatLabel(message);
    const trimmed = message.text.trim();
    if (trimmed.length > 0) {
      console.log('');
      console.log(`[${label}] ${trimmed}`);
    }
    if (message.suggestions && message.suggestions.length > 0) {
      console.log('Sugerencias:');
      for (const suggestion of message.suggestions) {
        console.log('- ' + suggestion);
      }
    }
    if (message.followUpQuestion) {
      console.log('Pregunta para continuar: ' + message.followUpQuestion);
    }
  }
}

function logStepSummary(processResult: ProcessChatResult): void {
  const core = processResult.result;
  console.log('');
  console.log(`[Log] Momento ${core.momentCode} | Paso ${core.stepCode}`);
  console.log(`[Log] Clasificacion: ${core.response.classification} | Accion: ${core.response.nextAction} | Score: ${core.response.score}`);
  if (core.response.nextQuestion) {
    console.log(`[Log] Proxima pregunta: ${core.response.nextQuestion}`);
  }
}

async function main(): Promise<void> {
  console.log('==============================================');
  console.log('Sophia Chat Multiagente');
  console.log('Escribe "salir" para terminar.');
  console.log('==============================================');

  printPresentation();

  while (true) {
    console.log('');
    const answer = (await rl.question('Tu respuesta: ')).trim();
    if (answer.toLowerCase() === 'salir') {
      break;
    }

    if (answer.length === 0) {
      console.log('Por favor ingresa una respuesta.');
      continue;
    }

    const processResult = await runner.handleUserInput(session, answer);
    const parsedMessages = structuredMessagesArraySchema.parse(processResult.structuredMessages ?? []);
    printStructuredMessages(parsedMessages);
    logStepSummary(processResult);

    session = processResult.session;

    const nextPresentation = runner.getCurrentPresentation(session);
    const nextStepCode = nextPresentation?.step.code ?? null;
    if (!nextStepCode || nextStepCode !== presentedStepCode) {
      presentedStepCode = null;
    }

    if (session.lessonSession.lessonCompleted) {
      console.log('');
      console.log('Felicidades, completaste la leccion.');
      break;
    }

    printPresentation();
  }

  rl.close();
}

main().catch(error => {
  console.error('Error en el chat:', error);
  rl.close();
  process.exitCode = 1;
});
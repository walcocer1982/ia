import { nowIso } from '../utils/time.js';
import { createInitialSession, lessonSessionSchema } from '../domain/session.js';
import { OpenAIGateway } from './openai-gateway.js';
import { SophiaPersonality } from '../agents/sophia-personality.js';
import { EducationalRoles } from '../agents/educational-roles.js';
export class SophiaMultiAgentService {
    gateway;
    constructor(gateway = new OpenAIGateway()) {
        this.gateway = gateway;
    }
    createSession(lesson, sessionId) {
        return createInitialSession(lesson, sessionId);
    }
    async processUserInput(session, userInput) {
        const safeSession = lessonSessionSchema.parse(session);
        const moment = safeSession.lesson.moments[safeSession.currentMomentIndex];
        if (!moment) {
            throw new Error('Estado invalido: no se encontro el momento actual.');
        }
        const step = moment.steps[safeSession.currentStepIndex];
        if (!step || step.type !== 'ASK') {
            throw new Error('El paso actual no espera respuesta del estudiante.');
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
            answerType: step.answerType,
            lastClassification: snapshot.lastClassification,
            lastAction: snapshot.lastNextAction
        };
        const baseInstructions = SophiaPersonality.buildInstructions(personalityContext);
        const roleDecision = EducationalRoles.decideRoleFromInput(userInput, personalityContext);
        const roleInstructions = EducationalRoles.getInstructions(roleDecision.role, personalityContext);
        const evaluationGuidelines = buildEvaluationGuidelines(step.objective, snapshot.attempts);
        /**
         * Formato esperado por el evaluador automatico.
         * Campos requeridos: chat, classification, score, nextAction.
         * Campos opcionales: nextQuestion, momentCompleted, lessonCompleted, needsAutomaticAdvance,
         * progressSummary, weakAreas, riskMatrix.
         * El historial enviado al modelo utiliza InteractionLog (ver src/domain/session.ts) y mantiene los
         * nombres exactos: classification, nextAction, history[].
         */
        const finalInstructions = [
            baseInstructions,
            '',
            'ROL_ASIGNADO',
            `Rol: ${roleDecision.role}`,
            `Intencion: ${roleDecision.intent}`,
            '',
            roleInstructions,
            '',
            evaluationGuidelines,
            '',
            'FORMATO_DE_RESPUESTA',
            'Entrega JSON valido con las claves requeridas: chat, classification, score, nextAction.',
            'Campos opcionales segun aplique: nextQuestion, momentCompleted, lessonCompleted, needsAutomaticAdvance, progressSummary, weakAreas, riskMatrix.',
            'Asegurate de que history siga el formato de InteractionLog y registra riskMatrix solo cuando proveas un RiskMatrixResult.'
        ].join('\n');
        const historyForModel = this.buildHistoryForModel(safeSession.history);
        const response = await this.gateway.evaluateStep({
            sessionId: safeSession.sessionId,
            lesson: safeSession.lesson,
            moment,
            step,
            userInput,
            instructions: finalInstructions,
            history: historyForModel
        });
        const adjustedResponse = adjustResponseForAttempts(response, snapshot.attempts, step.objective);
        logEvaluationOutcome(moment.code, step.code, snapshot.attempts, adjustedResponse);
        const updatedSession = applyResponseToSession(safeSession, adjustedResponse, moment, step, userInput);
        const structuredMessages = [
            buildPrimaryMessage(roleDecision.role, adjustedResponse)
        ];
        return {
            session: updatedSession,
            response: adjustedResponse,
            roleDecision,
            instructions: finalInstructions,
            structuredMessages,
            momentCode: moment.code,
            stepCode: step.code
        };
    }
    buildSnapshot(session, moment, step) {
        const historyForStep = session.history.filter(entry => entry.stepCode === step.code);
        const lastEntry = session.history.at(-1);
        return {
            lesson: session.lesson,
            currentMoment: moment,
            step,
            attempts: historyForStep.length + 1,
            historyLength: session.history.length,
            lastClassification: lastEntry?.classification,
            lastNextAction: lastEntry?.nextAction
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
function buildEvaluationGuidelines(objective, attempts) {
    const lines = [];
    lines.push('OBJETIVO_PEDAGOGICO');
    lines.push(objective ? `Objetivo actual: ${objective}` : 'Objetivo actual: sin especificar. Usa la consigna de la pregunta como guia principal.');
    lines.push('');
    lines.push('CRITERIOS_DE_CLASIFICACION');
    lines.push('Evalua la respuesta unicamente contra este objetivo.');
    lines.push('- ACCEPT: saberes previos plenamente activados y alineados con el objetivo.');
    lines.push('- PARTIAL: saberes previos parciales; el objetivo aparece de forma incompleta o con vacios menores.');
    lines.push('- HINT: el objetivo casi no se evidencia; necesitas orientar con una pista concreta.');
    lines.push('- REDIRECT: la respuesta no se relaciona con el objetivo; debes reencuadrar antes de continuar.');
    lines.push('');
    lines.push('DETECCION_ESPECIAL_NO_SE:');
    lines.push('Si el usuario responde exactamente "no sé", "no lo sé", respuesta vacía, solo "?", "nada", "no", "hmm", "eh", o variantes muy cortas:');
    lines.push('- Clasifica INMEDIATAMENTE como HINT (no evalúes contenido académico)');
    lines.push('- Aplica el patrón de pista correspondiente al número de intento');
    lines.push('- Usa el formato exacto especificado en las instrucciones de hint stage');
    lines.push('- Mantén tono empático pero directo hacia el objetivo pedagógico');
    lines.push('');
    lines.push(describeHintStage(attempts));
    lines.push('');
    lines.push('Reporta weakAreas con lo que falto del objetivo y alinea nextAction con el progreso.');
    return lines.join(String.fromCharCode(10));
}
function describeHintStage(attempts) {
    if (attempts <= 1) {
        return `Intento 1 (pista breve): Si detectas "no sé", "no lo sé", respuesta vacía, o respuesta muy vaga, reformula suavemente para invitar a un ejemplo ligado al objetivo.
    Formato exacto: "[Definición básica + ejemplo]. ¿[Pregunta que invita a dar otro ejemplo]?"
    Ej.: "Un peligro es algo que puede causar daño, por ejemplo una máquina sin resguardo. ¿Qué otro caso recuerdas y por qué conviene detectarlo antes de que cause problemas?"`;
    }
    if (attempts === 2) {
        return `Intento 2 (pista evidente): Incluye la definición clave completa y sólo pide que elija un ejemplo.
    Formato exacto: "[Definición completa con ejemplos]. ¿[Pregunta específica]?"
    Ej.: "Un peligro es cualquier condición capaz de causar daño (como un cable pelado). ¿Qué otro ejemplo similar puedes dar y por qué conviene detectarlo antes de que cause un accidente?"`;
    }
    return `Intento 3 (cierre/avance): Ofrecer micro-resumen + pregunta de confirmación.
  Formato exacto: "[Resumen clave]; [beneficio de la detección temprana]. ¿[Pregunta de confirmación antes de avanzar]?"
  Ej.: "Un peligro es algo que puede causar daño; identificarlo pronto nos deja aplicar controles y evitar accidentes. ¿Quieres que repasemos un ejemplo típico antes de seguir?"
  Después de esta respuesta, entrega una pista explicita, registra la brecha y prepara el avance automatico (nextAction "advance" y needsAutomaticAdvance true).`;
}
function buildFallbackQuestion(objective, attempts) {
    if (!objective || attempts >= 3) {
        return undefined;
    }
    if (attempts === 1) {
        return `Que elemento concreto puedes mencionar para cumplir el objetivo? Recuerda: ${objective}`;
    }
    return `Piensa en los aspectos esenciales del objetivo: ${objective}. Describe al menos un detalle especifico que se relacione.`;
}
function adjustResponseForAttempts(response, attempts, objective) {
    const adjusted = { ...response };
    const needsFallback = adjusted.classification === 'HINT' || adjusted.classification === 'REDIRECT';
    if (needsFallback) {
        adjusted.chat = enhanceHintMessage(adjusted.chat, attempts, objective);
    }
    if (needsFallback && attempts >= 3) {
        adjusted.nextAction = 'advance';
        adjusted.needsAutomaticAdvance = true;
        adjusted.nextQuestion = undefined;
        if (objective && !adjusted.progressSummary) {
            adjusted.progressSummary = `Continuamos avanzando. Revisa mas tarde el objetivo: ${objective}`;
        }
    }
    else if (needsFallback) {
        if (!adjusted.nextQuestion) {
            const fallback = buildFallbackQuestion(objective, attempts);
            if (fallback) {
                adjusted.nextQuestion = fallback;
            }
        }
        if (!adjusted.nextAction || adjusted.nextAction === 'advance' || adjusted.nextAction === 'complete') {
            adjusted.nextAction = 'retry';
        }
    }
    if (adjusted.classification === 'PARTIAL' && (!adjusted.nextAction || adjusted.nextAction === 'clarify')) {
        adjusted.nextAction = 'retry';
    }
    if ((adjusted.classification === 'HINT' || adjusted.classification === 'REDIRECT' || adjusted.classification === 'PARTIAL') && !adjusted.weakAreas && objective) {
        adjusted.weakAreas = [`Profundizar en el objetivo: ${objective}`];
    }
    return adjusted;
}
function enhanceHintMessage(chat, attempts, objective) {
    const trimmed = chat.trim();
    const segments = [];
    const objectiveLine = objective
        ? `Objetivo en foco: ${objective}`
        : 'Objetivo en foco: revisa la consigna para recuperar la idea central.';
    if (attempts <= 1) {
        segments.push('Pista rapida: cita al menos un ejemplo concreto ligado al objetivo y comenta por que debe atenderse a tiempo.');
        segments.push(objectiveLine);
    }
    else if (attempts === 2) {
        segments.push('Pista avanzada: recuerda la definicion central y agrega un ejemplo propio. Explica la consecuencia de ignorarlo.');
        segments.push(objectiveLine);
    }
    else {
        segments.push('Resumen clave: identificar el peligro con anticipacion permite aplicar controles y evitar incidentes.');
        segments.push(objectiveLine);
        segments.push('Continuaremos con el siguiente paso y retomaremos este objetivo mas adelante.');
    }
    const guidance = segments.join('\n');
    if (!trimmed.includes(segments[0])) {
        return trimmed ? `${trimmed}\n\n${guidance}` : guidance;
    }
    return chat;
}
function logEvaluationOutcome(momentCode, stepCode, attempts, response) {
    const summary = `[Evaluador] ${momentCode}-${stepCode} intento ${attempts}: ${response.classification} | accion ${response.nextAction}`;
    console.info(summary);
}
function buildPrimaryMessage(role, response) {
    return {
        role,
        messageType: mapClassificationToMessageType(response.classification, Boolean(response.nextQuestion)),
        text: response.chat,
        suggestions: response.weakAreas,
        followUpQuestion: response.nextQuestion ?? undefined
    };
}
function mapClassificationToMessageType(classification, hasQuestion) {
    if (classification === 'HINT') {
        return 'PISTA';
    }
    if (hasQuestion || classification === 'REDIRECT') {
        return 'PREGUNTA';
    }
    return 'FEEDBACK';
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

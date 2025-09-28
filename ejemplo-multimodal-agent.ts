// Sophia Multimodal Agent - Fase 4
// Agente unificado que reemplaza el sistema multi-agente con roles dinámicos

import { Agent, run } from '@openai/agents';
import OpenAI from 'openai';
import type { 
  DocenteContext, 
  MultiAgentResponse,
  AgentType,
  AgentIntent 
} from '../types';
// import { getSchemaByAnswerType } from '../schemas'; // No usado actualmente
import { educationalLogger } from '../logger';
import { SophiaPersonality } from './sophia-personality';
import { EducationalRoles } from './educational-roles';

// ✅ INTERFACES PARA EVALUACIÓN GENÉRICA (sin duplicación)
interface EvaluationResult {
  classification: 'ACCEPT' | 'PARTIAL' | 'HINT' | 'REDIRECT';
  conceptsIdentified: string[];
  hintsProvided: string[];
}

// ❌ ELIMINADA - EvaluationConfig ya no se necesita (delegado al modelo)

/**
 * Agente multimodal unificado que cambia roles dinámicamente
 */
export class SophiaMultimodalAgent {
  private agent: Agent<DocenteContext>;
  private client: OpenAI;
  private modelName: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.modelName = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini';
    this.agent = new Agent<DocenteContext>({
      name: 'Sophia Educational Multimodal',
      instructions: this.buildDynamicInstructions.bind(this),
      model: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
      modelSettings: {
        temperature: 0.6, // Balance para educación
        maxTokens: 800
      }
    });
  }

  /**
   * Procesa input del usuario con rol dinámico
   */
  async processEducationalInput(
    userInput: string,
    context: DocenteContext
  ): Promise<MultiAgentResponse> {
    const startTime = Date.now();
    
    try {
      // Determinar rol e intent dinámicamente
      const { detectedRole, detectedIntent } = this.detectRoleFromContext(userInput, context);
      
      // Actualizar instructions según contexto
      context.currentAgent = detectedRole;
      
      // Log de decisión de rol
      console.log(`[SophiaMultimodal] Rol detectado: ${detectedRole}, Intent: ${detectedIntent}`);
      
      // Ejecutar agente con contexto enriquecido
      const result = await run(this.agent, userInput, { context });
      
      // Extraer respuesta
      const agentMessage = this.extractResponse(result);
      
      // Crear respuesta estructurada
      const response = await this.createStructuredResponse(
        agentMessage,
        context,
        detectedRole,
        detectedIntent,
        userInput,
        Date.now() - startTime
      );

      // Log de interacción
      educationalLogger.logInteraction(
        context,
        userInput,
        response,
        detectedRole,
        response.executionTime || 0
      );

      return response;

    } catch (error) {
      console.error('[SophiaMultimodal] Error:', error);
      
      return this.createFallbackResponse(userInput, context, error as Error);
    }
  }

  /**
   * Detecta el rol más apropiado basado en contexto y input
   */
  private detectRoleFromContext(userInput: string, context: DocenteContext): {
    detectedRole: AgentType;
    detectedIntent: AgentIntent;
  } {
    const input = userInput.toLowerCase();
    
    // Detección basada en patterns comunes
    
    // Si es una respuesta a pregunta ASK → Evaluator
    if (context.currentStep.type === 'ASK' && input.length > 10) {
      return {
        detectedRole: 'EVALUATOR',
        detectedIntent: 'EVALUATION' as AgentIntent
      };
    }
    
    // Si dice "no entiendo", "qué es", "explica" → Clarification
    if (input.includes('no entiendo') || input.includes('no se') || 
        input.includes('que es') || input.includes('explica')) {
      return {
        detectedRole: 'CLARIFICATION',
        detectedIntent: 'CLARIFICATION_CONCEPTUAL'
      };
    }
    
    // Si pide ejemplos → Content Generator
    if (input.includes('ejemplo') || input.includes('caso') || 
        input.includes('muestra')) {
      return {
        detectedRole: 'CONTENT_GENERATOR',
        detectedIntent: 'CONTENT_REQUEST'
      };
    }
    
    // Si pregunta sobre progreso → Meta Handler
    if (input.includes('progreso') || input.includes('donde estoy') || 
        input.includes('cuanto falta')) {
      return {
        detectedRole: 'META_HANDLER',
        detectedIntent: 'PROGRESS_CHECK'
      };
    }
    
    // Default: Orchestrator para coordinación general
    return {
      detectedRole: 'ORCHESTRATOR',
      detectedIntent: 'META_CONVERSATION' as AgentIntent
    };
  }

  /**
   * Construye instrucciones dinámicas combinando personalidad + contexto + función del rol
   * NUEVA ARQUITECTURA: Personalidad separada de funciones técnicas
   */
  private buildDynamicInstructions(runContext: { context: DocenteContext }): string {
    const context = runContext.context;
    const role = context.currentAgent || 'ORCHESTRATOR';
    
    // 👤 PERSONALIDAD (constante) + 📚 CONTEXTO (específico)
    const baseInstructions = SophiaPersonality.buildBaseInstructions(context);

    // 🎭 FUNCIÓN POR ROL (técnica específica)
    switch (role) {
      case 'EVALUATOR':
        return `${baseInstructions}

${EducationalRoles.getEvaluatorInstructions(context)}`;

      case 'CLARIFICATION':
        return `${baseInstructions}

${EducationalRoles.getClarificationInstructions(context)}`;

      case 'CONTENT_GENERATOR':
        return `${baseInstructions}

${EducationalRoles.getContentGeneratorInstructions(context)}`;

      case 'META_HANDLER':
        return `${baseInstructions}

${EducationalRoles.getMetaHandlerInstructions(context)}`;

      default: // ORCHESTRATOR
        return `${baseInstructions}

${EducationalRoles.getOrchestratorInstructions(context)}`;
    }
  }

  /**
   * Extrae la respuesta del RunResult
   */
  private extractResponse(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    }
    
    // Castear a tipo específico para acceder a propiedades dinámicas
    const runResult = result as { state?: { _currentStep?: { output?: string } } };
    if (runResult?.state?._currentStep?.output) {
      return runResult.state._currentStep.output;
    }
    
    return "Respuesta no disponible";
  }

  /**
   * Crea respuesta estructurada basada en el output del agente
   */
  private async createStructuredResponse(
    agentMessage: string,
    context: DocenteContext,
    role: AgentType,
    intent: AgentIntent,
    userInput: string,
    executionTime: number
  ): Promise<MultiAgentResponse> {
    
    // ⚡ EVALUACIÓN GRANULAR POR TIPO DE RESPUESTA
    const granularEvaluation = await this.evaluateByAnswerType(userInput, context);
    const classification = granularEvaluation.classification;
    const score = this.calculateResponseScore(classification);
    
    // 🎓 LÓGICA DE AVANCE REALISTA: Prioriza progreso sobre perfección
    const shouldAdvance =
      classification === 'ACCEPT' ||
      (classification === 'PARTIAL' && score >= 0.7);
    
    // 🎯 NUEVA RESPONSABILIDAD: Determinar si el momento está completado
    const isMomentCompleted = this.determineMomentCompletion(classification, score, context);
                         
    // 🔍 DEBUG: Log para debugging
    console.log(`🔍 [Agent Decision] Classification: ${classification}, Score: ${score}, shouldAdvance: ${shouldAdvance}, isMomentCompleted: ${isMomentCompleted}`);
    
    // Conceptos identificados usando evaluación granular
    const conceptsIdentified = granularEvaluation.conceptsIdentified;
    const conceptsMissing = this.identifyMissingConcepts(userInput, context);
    
    return {
      message: agentMessage,
      classification,
      shouldAdvance,
      consumeAttempt: true,
      conceptsIdentified,
      conceptsMissing,
      hintsProvided: granularEvaluation.hintsProvided,
      
      // ✅ NUEVA RESPONSABILIDAD: Los agentes determinan la siguiente pregunta
      nextQuestion: this.determineNextQuestion(context, shouldAdvance),
      
      // ✅ NUEVA RESPONSABILIDAD: Los agentes calculan el score
      score: score, // ✅ Usar score ya calculado
      
      // ✅ NUEVA RESPONSABILIDAD: Los agentes identifican áreas débiles
      weakAreas: this.identifyWeakAreas(classification, context),
      
      // 🎯 NUEVA RESPONSABILIDAD: Los agentes determinan si el momento está completado
      isMomentCompleted: isMomentCompleted,
      
      currentProgress: {
        momentCode: context.currentMoment.code,
        stepCode: context.currentStep.code,
        progressPercentage: Math.round((context.completedSteps.length / (context.lesson.moments.reduce((acc, m) => acc + m.steps.length, 0))) * 100),
        conceptsLearned: conceptsIdentified
      },
      timestamp: new Date(),
      sessionId: context.sessionId,
      agentType: role,
      conversationFlow: {
        shouldContinue: true,
        nextExpectedInput: this.determineNextExpectedInput(context, shouldAdvance),
        contextHints: [`Role: ${role}`, `Intent: ${intent}`]
      },
      executionTime
    };
  }

  /**
   * ⚡ EVALUACIÓN GRANULAR POR TIPO DE RESPUESTA - REFACTORIZADA (sin duplicación)
   */
  private async evaluateByAnswerType(userInput: string, context: DocenteContext): Promise<EvaluationResult> {
    const answerType = context.currentStep.answer_type || 'open';
    return await this.evaluateResponse(userInput, context, answerType);
  }

  /**
   * ✅ EVALUADOR GENÉRICO - Reemplaza 4 funciones duplicadas
   */
  private async evaluateResponse(userInput: string, context: DocenteContext, type: string): Promise<EvaluationResult> {
    const evaluationPrompt = `
CONTEXTO EDUCATIVO:
- Objetivo de aprendizaje: ${context.objective}
- Tipo de pregunta: ${type}
- Momento pedagógico: ${context.currentStep?.title || 'Evaluación general'}

RESPUESTA DEL ESTUDIANTE:
"${userInput}"

INSTRUCCIONES DE EVALUACIÓN:
Como pedagoga comprensiva, evalúa considerando que el estudiante está APRENDIENDO, no debe demostrar maestría.

CRITERIOS (SÉ PERMISIVA):
- ACCEPT: Respuesta que muestra buena comprensión del tema (no necesita ser perfecta)
- PARTIAL: Respuesta que toca el tema o muestra esfuerzo genuino, aunque sea incompleta
- HINT: Respuesta muy breve o vaga pero que intenta participar 
- REDIRECT: Solo para respuestas ofensivas o completamente irrelevantes al tema educativo

PRIORIZA EL PROGRESO SOBRE LA PERFECCIÓN. El estudiante está en proceso de aprendizaje.

FORMATO DE RESPUESTA JSON:
Responde únicamente con un objeto JSON válido con esta estructura:
{
  "classification": "ACCEPT|PARTIAL|HINT|REDIRECT",
  "conceptsIdentified": ["concepto1", "concepto2"],
  "hintsProvided": ["sugerencia específica si es necesaria"],
  "reasoning": "breve explicación de tu evaluación"
}

Evalúa con criterio pedagógico, no con patrones rígidos.
    `;

    try {
      console.log(`🧠 [AI Evaluation] Delegando evaluación al modelo...`);
      
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: [{ role: 'user', content: evaluationPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1 // Baja temperatura para evaluación consistente
      });

      const evaluation = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log(`🎯 [AI Evaluation] ${evaluation.classification} - ${evaluation.reasoning}`);
      
      return {
        classification: evaluation.classification || 'HINT',
        conceptsIdentified: evaluation.conceptsIdentified || [],
        hintsProvided: evaluation.hintsProvided || []
      };
    } catch (error) {
      console.error(`❌ [AI Evaluation Error]:`, error);
      // Fallback seguro
      return {
        classification: 'HINT',
        conceptsIdentified: [],
        hintsProvided: ['Continúa desarrollando tu respuesta']
      };
    }
  }

  // ❌ ELIMINADA - getEvaluationConfig() ya no se necesita (delegado al modelo)

  // ❌ ELIMINADA - checkObjectiveAlignment() ya no se necesita (delegado al modelo)

  // ✅ evaluateDefinitionResponse() ELIMINADA - Reemplazada por evaluateResponse() genérica

  // ✅ evaluateListResponse() ELIMINADA - Reemplazada por evaluateResponse() genérica

  // ✅ evaluateProcedureResponse() ELIMINADA - Reemplazada por evaluateResponse() genérica

  // ✅ evaluateOpenResponse() ELIMINADA - Reemplazada por evaluateResponse() genérica


  /**
   * Extrae conceptos mencionados en el mensaje basado en el contexto
   */
  private extractMentionedConcepts(message: string): string[] {
    // Conceptos educativos genéricos - podrían venir del contexto en el futuro
    const concepts = ['concepto', 'definición', 'proceso', 'método', 'técnica', 'evaluación', 
                     'análisis', 'identificación', 'control', 'gestión', 'procedimiento'];
    
    return concepts.filter(concept => 
      message.toLowerCase().includes(concept)
    );
  }

  /**
   * Identifica conceptos que el usuario debería mencionar pero no mencionó
   */
  private identifyMissingConcepts(userInput: string, context: DocenteContext): string[] {
    // Conceptos esperados según el paso actual
    const expectedConcepts = this.getExpectedConceptsForStep(context.currentStep.code);
    const mentionedConcepts = this.extractMentionedConcepts(userInput);
    
    return expectedConcepts.filter(concept => !mentionedConcepts.includes(concept));
  }

  /**
   * Determina si el momento actual puede darse por completado en función del progreso
   */
  private determineMomentCompletion(
    classification: MultiAgentResponse['classification'],
    score: number,
    context: DocenteContext
  ): boolean {
    // Solo considerar completado cuando la respuesta es suficientemente sólida
    const meetsQualityThreshold =
      classification === 'ACCEPT' ||
      (classification === 'PARTIAL' && score >= 0.7);

    if (!meetsQualityThreshold) {
      return false;
    }

    const momentSteps = context.currentMoment?.steps || [];
    const currentIndex = momentSteps.findIndex(step => step.code === context.currentStep.code);

    if (currentIndex === -1) {
      return false;
    }

    // Si todavía quedan pasos dentro del mismo momento, no marcarlo como completado
    const hasRemainingStepsInMoment = momentSteps.slice(currentIndex + 1).length > 0;

    return !hasRemainingStepsInMoment;
  }

  /**
   * Obtiene conceptos esperados para un paso específico basado en el contexto
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getExpectedConceptsForStep(_stepCode: string): string[] {
    // En el futuro, esto debería venir del contexto or configuración
    // Por ahora, conceptos educativos genéricos
    return ['concepto', 'definición', 'análisis'];
  }


  /**
   * Determina qué tipo de input se espera a continuación
   */
  private determineNextExpectedInput(context: DocenteContext, shouldAdvance: boolean): string {
    if (shouldAdvance) {
      return 'navigation_to_next_step';
    }
    
    switch (context.currentStep.answer_type) {
      case 'definition':
        return 'conceptual_definition';
      case 'list':
        return 'itemized_response';
      case 'procedure':
        return 'step_by_step_process';
      default:
        return 'elaborated_response';
    }
  }

  /**
   * Crea respuesta de fallback en caso de error
   */
  private createFallbackResponse(userInput: string, context: DocenteContext, error: Error): MultiAgentResponse {
    return {
      message: "Disculpa, tuve un problema procesando tu respuesta. ¿Podrías reformular tu pregunta de manera más específica?",
      classification: 'HINT',
      shouldAdvance: false,
      consumeAttempt: false,
      conceptsIdentified: [],
      conceptsMissing: [],
      hintsProvided: [
        "Reformula tu respuesta de manera más clara",
        "Menciona conceptos específicos del tema",
        "Proporciona ejemplos si es posible"
      ],
      
      // ✅ NUEVOS CAMPOS REQUERIDOS
      nextQuestion: "Por favor, intenta responder de nuevo con más detalle.",
      score: 0.2,
      weakAreas: ['comunicación'],
      
      currentProgress: {
        momentCode: context.currentMoment.code,
        stepCode: context.currentStep.code,
        progressPercentage: 0,
        conceptsLearned: []
      },
      timestamp: new Date(),
      sessionId: context.sessionId,
      agentType: 'ORCHESTRATOR',
      conversationFlow: {
        shouldContinue: true,
        nextExpectedInput: 'clarified_response',
        contextHints: [`Error: ${error.message}`]
      },
      executionTime: 0
    };
  }

  /**
   * Información del agente para debugging
   */
  getInfo() {
    return {
      name: 'Sophia Multimodal Agent',
      version: '1.0.0',
      phase: 'Fase 4 - Multimodal Migration',
      capabilities: [
        'Dynamic role switching',
        'Educational evaluation',
        'Content generation',
        'Clarification assistance',
        'Meta conversation handling',
        'Dynamic subject expertise'
      ],
      supportedRoles: [
        'ORCHESTRATOR',
        'EVALUATOR', 
        'CONTENT_GENERATOR',
        'CLARIFICATION',
        'META_HANDLER'
      ]
    };
  }

  /**
   * ✅ NUEVA RESPONSABILIDAD: Determinar la siguiente pregunta
   */
  private determineNextQuestion(context: DocenteContext, shouldAdvance: boolean): string {
    if (shouldAdvance) {
      // Avanzar al siguiente momento
      const currentMomentId = parseInt(context.currentMoment.code.replace('M', ''));
      const nextMomentId = currentMomentId + 1;
      const totalMoments = context.lesson.moments.length;
      
      if (nextMomentId <= totalMoments) {
        const nextMoment = context.lesson.moments.find(m => m.code === `M${nextMomentId}`);
        if (nextMoment) {
          const firstAskStep = nextMoment.steps.find(step => step.type === 'ASK');
          if (firstAskStep && 'question' in firstAskStep && firstAskStep.question) {
            return firstAskStep.question;
          }
        }
        return `Continuemos con el momento ${nextMomentId} de ${context.lesson.meta.lesson_name}.`;
      } else {
        return `¡Felicidades! Has completado la lección de ${context.lesson.meta.lesson_name}.`;
      }
    } else {
      // Refuerzo en el mismo momento
      switch (context.currentStep.answer_type) {
        case 'definition':
          return "¿Puedes profundizar más en tu definición?";
        case 'list':
          return "¿Hay otros elementos que puedas agregar a tu lista?";
        case 'procedure':
          return "¿Puedes describir los pasos con más detalle?";
        default:
          return "¿Puedes darme un ejemplo específico o más detalles?";
      }
    }
  }

  /**
   * ✅ NUEVA RESPONSABILIDAD: Calcular score numérico
   */
  private calculateResponseScore(classification: 'ACCEPT' | 'PARTIAL' | 'HINT' | 'REDIRECT'): number {
    switch (classification) {
      case 'ACCEPT': return 0.8;    // 🎓 REALISTA: Respuesta muy buena, no perfecta
      case 'PARTIAL': return 0.7;   // 🎓 REALISTA: Respuesta aceptable
      case 'HINT': return 0.5;      // 🎓 REALISTA: Respuesta con esfuerzo
      case 'REDIRECT': return 0.3;  // Mantener igual
      default: return 0.5;
    }
  }

  /**
   * ✅ NUEVA RESPONSABILIDAD: Identificar áreas débiles (GENÉRICO)
   */
  private identifyWeakAreas(classification: 'ACCEPT' | 'PARTIAL' | 'HINT' | 'REDIRECT', context: DocenteContext): string[] {
    if (classification === 'ACCEPT') {
      return []; // Sin áreas débiles si la respuesta fue aceptada
    }
    
    // Identificar área débil basada en el objetivo del paso actual (genérico)
    const objective = context.objective.toLowerCase();
    const weakArea = objective.split(' ').slice(0, 2).join('_'); // Tomar primeras 2 palabras como área
    
    return [weakArea];
  }
}

/**
 * Factory function para crear el agente multimodal
 */
export function createSophiaMultimodalAgent(): SophiaMultimodalAgent {
  return new SophiaMultimodalAgent();
}

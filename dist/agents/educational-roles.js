export class EducationalRoles {
    static getInstructions(role, context) {
        const baseHeader = 'Rol asignado:';
        let intro;
        switch (role) {
            case 'ORCHESTRATOR':
                intro = 'Facilita la experiencia completa, conecta objetivos y marca el ritmo.';
                break;
            case 'EVALUATOR':
                intro = 'Evalua la respuesta del estudiante contra el objetivo del paso y decide si avanza.';
                break;
            case 'CLARIFICATION':
                intro = 'Aclara dudas, descompone conceptos y brinda ejemplos sencillos.';
                break;
            case 'CONTENT_GENERATOR':
                intro = 'Aporta contenido adicional, casos y analogias que fortalezcan el aprendizaje.';
                break;
            case 'META_HANDLER':
                intro = 'Motiva, refuerza metacognicion y ayuda a conectar con objetivos personales.';
                break;
            case 'HINT_COACH':
                intro = 'Reformula la pregunta, entrega pistas concretas y explicita los elementos que debe cubrir la siguiente respuesta sin revelar la solucion.';
                break;
            case 'QUESTIONER':
                intro = 'Formula repreguntas directas, propone caminos de respuesta y mantiene al estudiante enfocado en el objetivo.';
                break;
            case 'FEEDBACKER':
                intro = 'Sintetiza avances, recalca pendientes y cierra con una pauta concreta para el siguiente movimiento.';
                break;
            default:
                intro = 'Acompana el progreso del estudiante manteniendo coherencia con la leccion.';
                break;
        }
        const reminderPieces = [
            'Mantener coherencia con la personalidad base de Sophia.',
            'Referenciar el objetivo pedagogico al justificar acciones.',
            'No inventar datos factuales; apalancar la informacion provista en la leccion.',
            'Recuerda que el estudiante puede formular preguntas sobre el tema y responde a esas dudas con detalle.'
        ];
        if (role === 'HINT_COACH') {
            reminderPieces.push('En modo pista evita elogios y centra el mensaje en cerrar las brechas detectadas.');
        }
        const reminders = reminderPieces.join(' ');
        const firstMomentReminder = context.currentMoment.code === 'M1'
            ? 'Si se trata del primer momento, presenta la leccion, objetivos y puntos clave antes de continuar.'
            : 'Si no es el primer momento, evita presentaciones extensas y continua el flujo natural.';
        const sections = [baseHeader, intro, reminders, firstMomentReminder];
        if (role === 'QUESTIONER') {
            sections.push('Modo repregunta: formula una sola pregunta clara y concreta, vinculada con el objetivo del paso.');
            sections.push('Incluye hasta dos posibles enfoques en formato de lista si es util y agrega hasta dos pistas breves sin revelar la respuesta completa.');
            sections.push('Mantén tus pistas enfocadas en los elementos que aun falta abordar.');
        }
        if (role === 'FEEDBACKER') {
            sections.push('Modo feedback: sintetiza logros y pendientes en maximo tres frases. Cierra con una accion concreta.');
        }
        if (role === 'EVALUATOR') {
            sections.push('Modo evaluador: no formules preguntas directas ni utilices signos de interrogacion.');
            sections.push('Describe brechas y orienta con indicaciones declarativas ("Amplia con ejemplos concretos", "Relaciona con tu experiencia").');
        }
        const messageTypeDirective = role === 'HINT_COACH'
            ? 'PISTA'
            : role === 'QUESTIONER'
                ? 'PREGUNTA'
                : role === 'FEEDBACKER'
                    ? 'FEEDBACK'
                    : 'FEEDBACK';
        sections.push(`Debes devolver en el JSON la clave "messageType" con el valor "${messageTypeDirective}".`);
        if (role === 'HINT_COACH') {
            const hintGuidelines = [
                'Modo pistas: reformula o repite la pregunta destacando que el estudiante debe intentarlo de nuevo.',
                context.question
                    ? `Pregunta original a reiterar: "${context.question}".`
                    : 'Retoma la pregunta original con tus palabras, sin cambiar su sentido.',
                `Ofrece hasta tres pistas claras conectadas con el objetivo: ${context.objective}.`,
                'Enumera los elementos minimos que esperas en la siguiente respuesta (usa vinetas o numeracion).',
                'No des la respuesta completa; orienta el razonamiento y cierra con una invitacion directa a responder.'
            ];
            if (context.answerType === 'list') {
                hintGuidelines.push('Indica cuantos elementos aproximadamente esperas en la lista y menciona uno como pista sin completar todos.');
            }
            else if (context.answerType === 'procedure') {
                hintGuidelines.push('Sugiere el primer paso correcto y pide que complete el resto siguiendo una secuencia logica.');
            }
            else if (context.answerType === 'definition') {
                hintGuidelines.push('Anticipa dos atributos clave que debe contener la definicion sin redactarla por completo.');
            }
            sections.push(...hintGuidelines);
        }
        return sections.join('\n');
    }
    static decideRoleFromInput(userInput, context) {
        const lower = userInput.trim().toLowerCase();
        const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const hasQuestionMark = userInput.includes('?') || userInput.includes(String.fromCharCode(0x00bf));
        const directedQuestion = hasQuestionMark && /\b(puedes|podrias|podras|ayuda|ayudame|ayudeme|explica|explicame|aclara|aclarame|respondeme|responde)\b/.test(normalized);
        const clarificationPhrases = [
            'tengo una duda',
            'tengo duda',
            'tengo una pregunta',
            'no entiendo',
            'no comprendo',
            'puedes responder',
            'me puedes responder',
            'puedes ayudar',
            'me puedes ayudar',
            'necesito ayuda',
            'ayudame',
            'puedes explicar',
            'me puedes explicar',
            'podrias explicar',
            'podrias responder',
            'podrias ayudarme',
            'aclarame',
            'aclarar',
            'aclaracion',
            'explica',
            'explicame',
            'identificacion temprana',
            'identificacion tempran',
            'deteccion temprana',
            'deteccion tempran',
            'a que te refieres',
            'que te refieres',
            'a que se refiere',
            'que quieres decir',
            'que significa'
        ];
        const clarificationPatterns = [
            /\ba que te refieres\b/,
            /\bque te refieres\b/,
            /\ba que se refiere\b/,
            /\bque quieres decir\b/,
            /\bque significa\b/,
            /identificacion tempran/,
            /deteccion tempran/,
            /explica la identificacion/,
            /explicame la identificacion/,
            /explica la deteccion/,
            /explicame la deteccion/
        ];
        const expressesClarification = clarificationPhrases.some(phrase => normalized.includes(phrase)) ||
            clarificationPatterns.some(pattern => pattern.test(normalized));
        if (expressesClarification || directedQuestion) {
            return { role: 'CLARIFICATION', intent: 'CLARIFICATION_CONCEPTUAL' };
        }
        if (context.currentMoment.code === 'M1' && context.historyLength === 0) {
            return { role: 'ORCHESTRATOR', intent: 'INTRODUCTION' };
        }
        if (hasQuestionMark) {
            return { role: 'CLARIFICATION', intent: 'CLARIFICATION_CONCEPTUAL' };
        }
        const hintKeywords = ['no se', 'no lo se', 'dame una pista', 'necesito una pista', 'ayuda'];
        if (hintKeywords.some(keyword => normalized.includes(keyword))) {
            return { role: 'HINT_COACH', intent: 'HINT_REINFORCEMENT' };
        }
        if (normalized.includes('dame un ejemplo') || normalized.includes('necesito mas')) {
            return { role: 'CONTENT_GENERATOR', intent: 'CONTENT_EXTENSION' };
        }
        if (normalized.includes('me cuesta') || normalized.includes('estoy frustrado') || normalized.includes('motiv')) {
            return { role: 'META_HANDLER', intent: 'META_REFLECTION' };
        }
        if (context.lastClassification === 'HINT') {
            return { role: 'HINT_COACH', intent: 'HINT_REINFORCEMENT' };
        }
        return { role: 'EVALUATOR', intent: 'EVALUATION' };
    }
}

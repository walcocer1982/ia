# Arquitectura del servicio multi-agente

## Objetivo general
El servicio multi-agente coordina la experiencia pedagógica de Sophia para que cada interacción con el estudiantado combine secuenciación de lecciones, evaluación de respuestas y selección dinámica de roles educativos. Este documento describe los componentes existentes que cumplen dichas funciones y cómo se relacionan entre sí para evitar duplicaciones al implementar nuevas capacidades.

## Componentes clave

### LessonRunner como Lesson Sequencer
`LessonRunner` actúa como secuenciador central de la lección. Se encarga de:
- Cargar y validar la definición de la lección (`assertLesson`) y abrir sesiones (`createSession`).
- Exponer la presentación del paso actual con todo el contenido necesario para la UI (`getCurrentPresentation`).
- Delegar la evaluación de respuestas cuando el paso requiere interacción (`handleUserInput`).
- Avanzar automáticamente pasos pasivos y marcar momentos completados (`advancePassiveStep`).

Gracias a estas responsabilidades, `LessonRunner` es el único punto que conoce la progresión de momentos y pasos, manteniendo el estado de la sesión sincronizado y entregando el contexto correcto al siguiente componente.

### SophiaMultiAgentService como Verifier y enrutador de roles
`SophiaMultiAgentService` concentra la lógica del verificador pedagógico y el ruteo hacia el agente adecuado:
- Construye un `snapshot` del contexto del paso actual (lección, momento, intento, historial) y prepara las instrucciones base de la personalidad de Sophia.
- Decide el rol a ejecutar con `EducationalRoles.decideRoleFromInput` y recupera las instrucciones específicas para ese rol (`EducationalRoles.getInstructions`).
- Ensambla las directrices de evaluación (criterios ACCEPT/PARTIAL/HINT/REDIRECT, manejo de "no sé", guías de pista) y las envía al modelo vía `OpenAIGateway.evaluateStep`.
- Ajusta la respuesta del modelo a las reglas de intentos y aplica la transición de estado (`applyResponseToSession`), registrando el resultado en el historial de la sesión.

De esta forma el servicio valida las respuestas (rol de Verifier) y decide, en un único punto, qué instrucciones pedagógicas recibe el modelo (rol de routing entre agentes).

### EducationalRoles como selector del agente pedagógico
`EducationalRoles` encapsula la política de selección del agente para cada turno:
- Analiza la entrada del estudiante y el contexto (momento, intentos, clasificación anterior) para determinar un `RoleDecision` (por ejemplo `CLARIFICATION`, `HINT_COACH`, `EVALUATOR`).
- Genera instrucciones específicas por rol, incluyendo recordatorios de tono, estructura esperada y variaciones según el tipo de respuesta (`answerType`).

Así, cada interacción pasa por un punto único de decisión que asegura consistencia entre los roles pedagógicos propuestos y las capacidades realmente implementadas.

## Flujo colaborativo
1. `LessonRunner` recibe la entrada del estudiante y delega a `SophiaMultiAgentService`.
2. El servicio prepara el contexto, consulta a `EducationalRoles` y construye las instrucciones finales.
3. El modelo responde con clasificación, puntaje y acción; el servicio ajusta y aplica la respuesta sobre la sesión.
4. `LessonRunner` devuelve el resultado listo para la UI, manteniendo la progresión de la lección.

## Tabla de mapeo entre roles propuestos y componentes existentes

| Rol propuesto en la arquitectura | Componente responsable | Funciones concretas |
| --- | --- | --- |
| Lesson Sequencer | `LessonRunner` | Cargar sesiones, exponer el paso actual, avanzar pasos pasivos y coordinar la interacción con el servicio multi-agente. |
| Verifier / Evaluador de respuestas | `SophiaMultiAgentService` | Generar instrucciones de evaluación, llamar al modelo, ajustar respuestas y aplicar transiciones de estado. |
| Role Router | `SophiaMultiAgentService` + `EducationalRoles` | Invocar `decideRoleFromInput`, obtener instrucciones por rol y empaquetar mensajes estructurados. |
| Pedagogical Agents (Clarification, Hint Coach, etc.) | `EducationalRoles` | Definir criterios de activación e instrucciones detalladas para cada rol pedagógico. |
| Personality & Prompting Backbone | `SophiaPersonality` (consumido por `SophiaMultiAgentService`) | Unificar tono y recordatorios transversales antes de aplicar las instrucciones de rol. |

Esta matriz sirve como referencia para detectar responsabilidades ya cubiertas y evitar la creación de componentes redundantes cuando se amplíe el sistema multi-agente.

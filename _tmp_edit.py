from pathlib import Path
from textwrap import dedent
path = Path("src/services/sophia-multiagent-service.ts")
text = path.read_text()
old_block_start = text.index("function adjustResponseForAttempts")
old_block_end = text.index("function logEvaluationOutcome", old_block_start)
new_block = dedent('''
function adjustResponseForAttempts(response: SophiaResponse, attempts: number, objective?: string): SophiaResponse {
  const adjusted: SophiaResponse = { ...response };
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
  } else if (needsFallback) {
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

function enhanceHintMessage(chat: string, attempts: number, objective?: string): string {
  const trimmed = chat.trim();
  const segments: string[] = [];
  const objectiveLine = objective
    ? `Objetivo en foco: ${objective}`
    : 'Objetivo en foco: revisa la consigna para recuperar la idea central.';

  if (attempts <= 1) {
    segments.push('Pista rapida: cita al menos un ejemplo concreto ligado al objetivo y comenta por que debe atenderse a tiempo.');
    segments.push(objectiveLine);
  } else if (attempts === 2) {
    segments.push('Pista avanzada: recuerda la definicion central y agrega un ejemplo propio. Explica la consecuencia de ignorarlo.');
    segments.push(objectiveLine);
  } else {
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
''')
text = text[:old_block_start] + new_block + text[old_block_end:]
path.write_text(text)

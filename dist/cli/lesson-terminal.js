#!/usr/bin/env node
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { randomUUID } from 'node:crypto';
import { lesson01 } from '../data/lesson01.js';
import { LessonRunner } from '../runner/lesson-runner.js';
const rl = readline.createInterface({ input, output });
const runner = new LessonRunner();
function logStepSummary(result) {
    console.log(`[Log] Momento ${result.momentCode} | Paso ${result.stepCode}`);
    console.log(`[Log] Clasificacion: ${result.response.classification} | Accion: ${result.response.nextAction} | Score: ${result.response.score}`);
    if (result.response.nextQuestion) {
        console.log(`[Log] Proxima pregunta: ${result.response.nextQuestion}`);
    }
}
async function main() {
    if (!process.env.OPENAI_API_KEY) {
        console.log('Configura la variable de entorno OPENAI_API_KEY antes de iniciar.');
        await rl.close();
        process.exit(1);
    }
    let session = runner.loadLesson(lesson01, randomUUID());
    console.log('==============================================');
    console.log('Sophia Lesson Terminal - IPERC Continuo');
    console.log('Las imagenes no se renderizan. Abre el URL manualmente si lo deseas.');
    console.log('==============================================');
    while (!session.lessonCompleted) {
        const presentation = runner.getCurrentPresentation(session);
        if (!presentation) {
            console.log('No hay mas pasos disponibles.');
            break;
        }
        console.log(`\nMomento ${presentation.momentCode} - ${presentation.momentTitle}`);
        console.log(`Paso ${presentation.step.code} [${presentation.step.type}]`);
        presentation.lines.forEach(line => console.log(line));
        if (!presentation.expectsResponse) {
            session = runner.advancePassiveStep(session);
            continue;
        }
        const answer = await rl.question('\nTu respuesta: ');
        let result;
        try {
            result = await runner.handleUserInput(session, answer.trim());
        }
        catch (error) {
            console.error('\nError al evaluar la respuesta:', error instanceof Error ? error.message : String(error));
            console.error('Detalles del error:', error);
            console.log('\nDeseas continuar con la siguiente pregunta? (s/n)');
            const continueChoice = await rl.question('');
            if (continueChoice.toLowerCase() !== 's' && continueChoice.toLowerCase() !== 'si') {
                break;
            }
            session = runner.advancePassiveStep(session);
            continue;
        }
        session = result.session;
        console.log('\n--- Respuesta de Sophia ---');
        console.log(result.response.chat);
        console.log(`Clasificacion: ${result.response.classification}`);
        console.log(`Score: ${result.response.score}`);
        logStepSummary(result);
        if (session.lessonCompleted) {
            console.log('\nLeccion completada.');
            break;
        }
    }
    console.log('\nFin de la sesion.');
    await rl.close();
}
main().catch(async (error) => {
    console.error('Error en la terminal de leccion:', error);
    await rl.close();
    process.exit(1);
});

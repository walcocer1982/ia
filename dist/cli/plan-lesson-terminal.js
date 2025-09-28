import process from 'node:process';
import { LessonPlanEngine, summarizePlan } from '../services/lesson-plan-engine.js';
async function main() {
    const [, , lessonNameArg, ...rest] = process.argv;
    if (!lessonNameArg) {
        console.error('Uso: npm run plan <lessonName> [--save json|ts] [--out ruta]');
        process.exit(1);
    }
    const lessonName = lessonNameArg.replace(/\.ts$/, '');
    let saveFormat = 'none';
    let outputPath;
    for (let i = 0; i < rest.length; i += 1) {
        const token = rest[i];
        if (token === '--save') {
            const value = rest[i + 1];
            if (value === 'json' || value === 'ts') {
                saveFormat = value;
                i += 1;
            }
        }
        else if (token === '--out') {
            outputPath = rest[i + 1];
            i += 1;
        }
    }
    const planner = new LessonPlanEngine();
    console.log('Cargando leccion...');
    const lesson = await planner.loadLessonByName(lessonName);
    const analysis = planner.analyzeLesson(lesson);
    console.log('Analisis actual:');
    console.log(analysis.summary);
    const plan = await planner.generatePlan(lesson, analysis);
    console.log('\nPlan propuesto:\n');
    console.log(summarizePlan(plan));
    if (saveFormat !== 'none') {
        const target = planner.savePlan(plan, lessonName, saveFormat, outputPath);
        console.log(`\nPlan guardado en: ${target}`);
    }
}
main().catch(error => {
    console.error('Error generando el plan:', error);
    process.exitCode = 1;
});

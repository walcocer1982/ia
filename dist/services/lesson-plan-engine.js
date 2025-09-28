import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertLesson } from '../domain/lesson.js';
import { OpenAIGateway } from './openai-gateway.js';
const REQUIRED_MOMENTS = [
    { code: 'M1', title: 'Saludo' },
    { code: 'M2', title: 'Conexion' },
    { code: 'M3', title: 'Adquisicion' },
    { code: 'M4', title: 'Aplicacion' },
    { code: 'M5', title: 'Discusion' },
    { code: 'M6', title: 'Reflexion' }
];
export class LessonPlanEngine {
    gateway;
    constructor(gateway = new OpenAIGateway()) {
        this.gateway = gateway;
    }
    async loadLessonByName(lessonName) {
        const safeName = lessonName.replace(/\.ts$/, '');
        const lessonPath = resolve(process.cwd(), 'src', 'data', `${safeName}.ts`);
        const moduleUrl = pathToFileURL(lessonPath).href;
        try {
            const mod = await import(moduleUrl);
            const candidate = mod.default ?? mod[safeName] ?? mod.lesson ?? mod.lesson01;
            if (!candidate) {
                throw new Error(`No se encontro una exportacion de leccion en ${moduleUrl}`);
            }
            return assertLesson(candidate);
        }
        catch (error) {
            throw new Error(`No se pudo cargar la leccion ${safeName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    analyzeLesson(lesson) {
        const availableMomentCodes = new Set(lesson.moments.map(moment => moment.code));
        const missingMoments = REQUIRED_MOMENTS
            .filter(moment => !availableMomentCodes.has(moment.code))
            .map(moment => `${moment.code} - ${moment.title}`);
        let hasImages = false;
        const questionCountByMoment = {};
        for (const moment of lesson.moments) {
            questionCountByMoment[moment.code] = 0;
            for (const step of moment.steps) {
                if ('image' in step && step.image) {
                    hasImages = true;
                }
                if (step.type === 'ASK') {
                    questionCountByMoment[moment.code] += 1;
                }
            }
        }
        const summaryLines = [
            `Momentos presentes: ${lesson.moments.map(moment => moment.code).join(', ')}`,
            `Momentos ausentes: ${missingMoments.length > 0 ? missingMoments.join(', ') : 'ninguno'}`,
            `Hay imagenes: ${hasImages ? 'si' : 'no'}`
        ];
        return {
            missingMoments,
            hasImages,
            questionCountByMoment,
            summary: summaryLines.join('\n')
        };
    }
    async generatePlan(lesson, analysis, extraInstructions = '') {
        const instructionBlocks = [
            'Genera una nueva version de la leccion siguiendo estos requisitos:',
            '- Mantener la meta original y el idioma (espanol).',
            '- Cubrir los momentos Saludo, Conexion, Adquisicion, Aplicacion, Discusion y Reflexion en ese orden.',
            '- Cada momento debe incluir al menos un paso de tipo ASK.',
            '- Inserta imagenes cuando la escena lo justifique, especialmente en Conexion y Aplicacion.',
            '- Usa codigos coherentes (ejemplo: M2-Q01, M3-C01).',
            '- En Aplicacion agrega un caso practico o procedimiento.',
            '- En Discusion formula preguntas que requieran justificar decisiones.',
            '- En Reflexion conecta el aprendizaje con la practica diaria.',
            extraInstructions
        ].filter(Boolean);
        return this.gateway.generateLessonPlan({
            lesson,
            analysis,
            instructions: instructionBlocks.join('\n')
        });
    }
    savePlan(plan, lessonName, format, outputPath) {
        const targetDir = outputPath ?? resolve(process.cwd(), 'src', 'data');
        const safeLessonName = lessonName.replace(/\.ts$/, '');
        if (format === 'json') {
            const targetFile = resolve(targetDir, `${safeLessonName}-plan.json`);
            writeFileSync(targetFile, JSON.stringify(plan, null, 2), 'utf8');
            return targetFile;
        }
        const targetFile = resolve(targetDir, `${safeLessonName}-plan.ts`);
        const serialized = JSON.stringify(plan, null, 2);
        const content = [
            "import type { Lesson } from '../domain/lesson.js';",
            '',
            'export const generatedPlan: Lesson = ' + serialized + ';',
            ''
        ].join('\n');
        writeFileSync(targetFile, content, 'utf8');
        return targetFile;
    }
}
export function summarizePlan(plan) {
    const lines = [];
    lines.push(`Leccion: ${plan.meta.lessonName}`);
    lines.push('Objetivos:');
    for (const objective of plan.learningObjectives) {
        lines.push(`  - ${objective}`);
    }
    lines.push('Momentos:');
    for (const moment of plan.moments) {
        lines.push(`  - ${moment.code} ${moment.title} (${moment.steps.length} pasos)`);
    }
    return lines.join('\n');
}

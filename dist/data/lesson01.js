export const lesson01 = {
    meta: {
        lessonId: 'SSO001_lesson_01',
        lessonName: 'IPERC Continuo - Identificacion de peligros, evaluacion de riesgos y control',
        version: '2.0.0',
        language: 'es',
        ordered: true,
        generatedAt: '2025-01-15T00:00:00Z'
    },
    learningObjectives: [
        'Aplicar IPERC continuo identificando peligros, evaluando riesgos y seleccionando controles segun jerarquia.'
    ],
    keyPoints: [
        'Identificar peligros en situaciones de trabajo reales',
        'Evaluar riesgos usando probabilidad e impacto',
        'Aplicar la jerarquia de controles correctamente',
        'Implementar IPERC continuo en el area de trabajo'
    ],
    moments: [
        {
            code: 'M1',
            title: 'Saludo',
            steps: [
                {
                    code: 'M1-N01',
                    type: 'NARRATION',
                    text: 'Bienvenido. Hoy trabajaremos con IPERC continuo para identificar peligros, riesgos, consecuencias y controles, y estimar el riesgo residual.'
                },
                {
                    code: 'M1-Q01',
                    type: 'ASK',
                    question: 'Si se lo explicas a un colega nuevo, como describirias un peligro y por que vale la pena detectarlo a tiempo?',
                    objective: 'Explorar por que conviene identificar peligros con anticipacion y reflexionar sobre su importancia en el dia a dia.',
                    answerType: 'open',
                    image: {
                        url: 'https://www.levelset.com/wp-content/uploads/2019/02/bigstock-201485356-600x400.jpg',
                        description: 'Trabajadores en obra de construccion con equipos de seguridad',
                        placement: 'after_question'
                    }
                }
            ]
        },
        {
            code: 'M2',
            title: 'Conexion',
            steps: [
                {
                    code: 'M2-Q01',
                    type: 'ASK',
                    question: 'Al mirar esta escena de soldadura, que peligros especificos te vienen a la mente de tus experiencias: chispas que pueden provocar quemaduras, radiacion que danara la vista, humos metalicos que afectan la respiracion? Como te ayudo detectarlos al instante para colocar pantallas, reforzar la ventilacion o ajustarte el EPP y evitar incidentes?',
                    objective: 'Activar recuerdos y experiencias previas sobre peligros frecuentes en trabajos de soldadura.',
                    answerType: 'open',
                    image: {
                        url: 'https://s7d2.scene7.com/is/image/TWCNews/welder_2_02152022',
                        description: 'Soldador realizando trabajo con chispas y luz brillante',
                        placement: 'with_question'
                    }
                },
                {
                    code: 'M2-Q02',
                    type: 'ASK',
                    question: 'Pensando en esos peligros, que situaciones de riesgo se podrian desencadenar?',
                    objective: 'Distinguir entre lo que vemos como peligro y las consecuencias que podria generar para el equipo o las personas.',
                    answerType: 'open'
                }
            ]
        },
        {
            code: 'M3',
            title: 'Adquisicion',
            steps: [
                {
                    code: 'M3-C01',
                    type: 'CONTENT',
                    body: [
                        'Antes de continuar, repasemos los tres conceptos base del IPERC continuo para que los tengas frescos.',
                        '**Peligro:** Caracteristica intrinseca con potencial de causar dano a la salud, integridad fisica o vida.',
                        '**Riesgo:** Combina la probabilidad de que algo ocurra con la severidad de las consecuencias.',
                        '**Consecuencia:** Resultado o dano que enfrentariamos si el riesgo se materializa.'
                    ],
                    image: {
                        url: 'https://udocz-images.b-cdn.net/documents_html/721461-6a3fd26b751d57b061e680c7d9282596/bg3.jpg',
                        description: 'Diagrama conceptual de peligro, riesgo y control',
                        placement: 'after_content'
                    }
                },
                {
                    code: 'M3-Q01',
                    type: 'ASK',
                    question: 'Con tus palabras, como le contarias a alguien que es peligro, riesgo y consecuencia?',
                    objective: 'Asegurarnos de que puedas explicar cada concepto base del IPERC con confianza y naturalidad.',
                    answerType: 'definition'
                },
                {
                    code: 'M3-C02',
                    type: 'CONTENT',
                    body: [
                        'La jerarquia de controles nos orienta para elegir la mejor medida posible antes de depender del EPP.',
                        '1. Eliminar el peligro',
                        '2. Sustituir por alternativa mas segura',
                        '3. Controles de ingenieria',
                        '4. Controles administrativos',
                        '5. Equipos de proteccion personal'
                    ]
                },
                {
                    code: 'M3-Q02',
                    type: 'ASK',
                    question: '¿Puedes ordenar los cinco niveles de la jerarquia de controles desde el mas efectivo al ultimo recurso?',
                    objective: 'Reforzar el recuerdo del orden correcto de la jerarquia de controles para aplicarlo luego con facilidad.',
                    answerType: 'list'
                },
                {
                    code: 'M3-Q03',
                    type: 'ASK',
                    question: 'Si tuvieras que cruzar una via con equipos pesados circulando, que dos escalones de la jerarquia aplicarias para bajar el riesgo?',
                    objective: 'Practicar la aplicacion de la jerarquia de controles en una situacion cotidiana de obra.',
                    answerType: 'list'
                },
                {
                    code: 'M3-Q04',
                    type: 'ASK',
                    question: 'Observa la maniobra de izaje con la excavadora: que peligros y riesgos notas y que dos controles de la jerarquia pondrias en marcha?',
                    objective: 'Aplicar el IPERC continuo y la jerarquia de controles a una maniobra critica de izaje.',
                    answerType: 'list',
                    image: {
                        url: 'https://www.altrasan.com/fotos/1647363464_wlmv.jpg',
                        description: 'Izaje con excavadora levantando bloques con trabajador cercano',
                        placement: 'with_question'
                    }
                }
            ]
        },
        {
            code: 'M4',
            title: 'Aplicacion',
            steps: [
                {
                    code: 'M4-CASE01',
                    type: 'CASE',
                    title: 'Mantenimiento de sistema hidraulico',
                    description: 'Durante un mantenimiento programado, un trabajador purga el sistema hidraulico de una excavadora de orugas mientras sostiene un recipiente para fluidos cerca de mangueras presurizadas y componentes calientes.',
                    variables: [
                        'sistema hidraulico presurizado',
                        'equipo pesado en mantenimiento',
                        'superficie irregular',
                        'derrames de fluidos'
                    ],
                    image: {
                        url: 'https://www.hydrauliccylindersinc.com/wp-content/uploads/2022/05/cleaning-scaled.jpeg',
                        description: 'Trabajador realizando mantenimiento en sistema hidraulico de excavadora',
                        placement: 'with_case'
                    }
                },
                {
                    code: 'M4-Q01',
                    type: 'ASK',
                    question: 'En esta escena, que dos peligros identificas, que riesgo asocias a cada uno y que controles propones para mitigarlos?',
                    objective: 'Aplicar paso a paso el IPERC relacionando peligro, riesgo y control en un caso practico.',
                    answerType: 'procedure'
                }
            ]
        },
        {
            code: 'M5',
            title: 'Discusion',
            steps: [
                {
                    code: 'M5-Q01',
                    type: 'ASK',
                    question: 'Cuentame por que elegiste ese orden en la jerarquia y que nivel representa cada control que propusiste.',
                    objective: 'Compartir el razonamiento detras de tus decisiones de control y consolidar el aprendizaje en equipo.',
                    answerType: 'open'
                }
            ]
        },
        {
            code: 'M6',
            title: 'Reflexion',
            steps: [
                {
                    code: 'M6-Q01',
                    type: 'ASK',
                    question: 'Que aprendizaje de hoy te gustaria llevarte a tus tareas diarias?',
                    objective: 'Conectar lo trabajado con acciones concretas que puedas aplicar en tu jornada laboral.',
                    answerType: 'open'
                }
            ]
        }
    ]
};

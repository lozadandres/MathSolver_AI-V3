import express from 'express';
import multer from 'multer';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Grupo, Usuario, RelacionRecurso } from '../models/index.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { GroupDTO } from '../dtos/index.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Inicializa el API de Google Gemini
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Sistema de prompts base con soporte multi-materia
const getSystemPrompt = (subject = "matemáticas") => {
    const isMath = subject.toLowerCase().includes("matem");
    const isScience = subject.toLowerCase().includes("cienc") || subject.toLowerCase().includes("fisic") || subject.toLowerCase().includes("quimic");
    
    let expertise = "matemáticas";
    let behavior = "matemáticos";
    
    if (isScience) {
        expertise = "ciencias naturales";
        behavior = "científicos y de ciencias naturales";
    }

    return `
# SYSTEM_PROMPT: Expert Pedagogical ${expertise.toUpperCase()} Tutor

You are an advanced virtual assistant specializing in ${expertise}. Your goal is to provide exceptionally clear, pedagogical, and accurate guidance, transforming every solution into a mini-lesson.

## I. CORE PRINCIPLES & THINKING PROCESS
1. Clarification: Is the query ambiguous? 
2. Categorization: Identify the scientific branch.
3. Level Detection: Adapt tone (Basic, Intermediate, Advanced).
4. Pedagogical Strategy: Think of an analogy and a practical application.

## II. BEHAVIORAL RULES
- Only answer ${expertise}-related questions.
- Explain "Why" not just "How".
- Use analogies to simplify abstract concepts.
- Provide practical, real-world examples for the topic.
- STRICT RULE: Do NOT answer questions outside the ${expertise} domain.
- If the query is NOT related to ${expertise}, respond EXACTLY with: "Lo siento, pero mi especialidad en este chat es exclusivamente la resolución y explicación de problemas de ${expertise}. ¿Hay algún tema o ejercicio de ${expertise} en el que pueda ayudarte?"

## III. RESPONSE ARCHITECTURE
- Step-by-Step Resolution: Use standard numbered steps.
- **Pedagogical Tools** (Mandatory in Detailed Mode):
    - **Analogy**: Compare the problem to a everyday situation.
    - **Practical Example**: Show a real-life application.
- Notation: Use standard LaTeX delimiters for formulas ($ ... $ or $$ ... $$).
- Structural Formatting: Use Markdown headers (##, ###) for sections and bold text (**) for key concepts.

## IV. GRAPHING INSTRUCTIONS
- If applicable (e.g. physics formulas), format graph data as:
  [GRAPH: {"expression": "9.8 * x", "title": "Gráfica de Velocidad (v=gt)"}]
`;
};

async function obtenerRespuestaContextual(pregunta, modo = 'detallado', imageData = null, lang = 'es', context = "", subject = "matemáticas") {
    try {
        const prompts = {
            es: {
                rápido: "[MODO RÁPIDO: Resultado directo. RESPONDE EN ESPAÑOL.] ",
                quiz: "[MODO QUIZ: Guía al usuario sin dar la solución. RESPONDE EN ESPAÑOL.] ",
                detallado: "[MODO DETALLADO: Explicación paso a paso + ANALOGÍA + EJEMPLO PRÁCTICO. RESPONDE EN ESPAÑOL.] "
            },
            en: {
                rápido: "[QUICK MODE: Direct result. RESPOND IN ENGLISH.] ",
                quiz: "[QUIZ MODE: Guide user without solution. RESPOND IN ENGLISH.] ",
                detallado: "[DETAILED MODE: Step-by-step + ANALOGY + PRACTICAL EXAMPLE. RESPOND IN ENGLISH.] "
            }
        };

        const currentLang = prompts[lang] || prompts.es;
        const instruccionModo = currentLang[modo] || currentLang.detallado;

        // Construir el prompt completo basado en la materia
        const fullSystemPrompt = `${getSystemPrompt(subject)}\n\n## CONTEXTO ADICIONAL DEL GRUPO/CLASE\n${context}`;
        
        // Usar un chat stateless para evitar colisiones entre usuarios
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: fullSystemPrompt }] },
                { role: "model", parts: [{ text: "Entendido. He integrado el contexto del grupo. ¿En qué puedo ayudar a los alumnos hoy?" }] }
            ]
        });

        const messageParts = [{ text: instruccionModo + pregunta }];
        if (imageData) {
            messageParts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                }
            });
        }

        const result = await chat.sendMessage(messageParts);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Contextual Error:", error);
        throw error;
    }
}

// Endpoint para obtener contexto del grupo
router.get('/context/:groupId', requireAuth, async (req, res) => {
    try {
        const { groupId } = req.params;
        const grupo = await Grupo.findByPk(groupId, {
            include: [
                { model: Usuario, as: 'tutor', attributes: ['email'] }
            ]
        });

        if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

        // Aquí se podrían buscar recursos adicionales en RelacionRecurso
        res.json(GroupDTO(grupo));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint principal de chat (JSON)
router.post('/', requireAuth, async (req, res) => {
    try {
        const { message, mode, lang, groupId } = req.body;
        let context = "Este es un chat general.";
        let subject = "matemáticas";

        if (groupId) {
            const grupo = await Grupo.findByPk(groupId);
            if (grupo) {
                subject = grupo.nombre;
                context = `Estás en la clase: "${grupo.nombre}". Descripción: ${grupo.descripcion || 'No disponible'}.`;
            }
        }

        const respuesta = await obtenerRespuestaContextual(message, mode, null, lang, context, subject);
        res.json(respuesta);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint de chat con archivos (Multipart)
router.post('/with-file', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const { message, mode, lang, groupId } = req.body;
        let imageData = null;

        if (req.file) {
            imageData = {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString('base64')
            };
        }

        let context = "Este es un chat general.";
        let subject = "matemáticas";
        if (groupId) {
            const grupo = await Grupo.findByPk(groupId);
            if (grupo) {
                subject = grupo.nombre;
                context = `Estás en la clase: "${grupo.nombre}". Descripción: ${grupo.descripcion || 'No disponible'}.`;
            }
        }

        const respuesta = await obtenerRespuestaContextual(message, mode, imageData, lang, context, subject);
        res.json(respuesta);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Función para "embellecer" o interpretar dibujos usando visión
async function procesarDibujoInteligente(imageData) {
    try {
        const prompt = `
            Actúa como un experto en reconocimiento visual pedagógico. Analiza este boceto o trazo de un usuario en una pizarra.
            Identifica con precisión lo que el usuario intentó dibujar, sin importar si el trazo es simple o imperfecto.
            Tu objetivo es dar contexto a la IA: puede ser un objeto (ej: carro, casa, árbol, átomo), un número, una letra, o una figura geométrica.
            
            DEBES responder únicamente con un objeto JSON plano:
            {
              "type": "circle" | "rect" | "triangle" | "line" | "none",
              "action": "draw",
              "label": "NOMBRE DEL OBJETO O CARACTER EN MAYUSCULAS"
            }
            
            INDICACIONES:
            - Solo usa "type" (circle, rect, triangle) si el dibujo es CLARAMENTE una de esas formas y quieres que se re-dibuje perfecta. Si no, usa "none".
            - Usa "label" para CUALQUIER interpretación (ej: "CARRO", "NIVEL DE AGUA", "LETRA A", "NUMERO 5").
            - Si es un garabato sin sentido, responde {"action": "none"}.
        `;

        const messageParts = [
            { text: prompt },
            {
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                }
            }
        ];

        const result = await model.generateContent(messageParts);
        const responseText = result.response.text();
        
        // Intentar limpiar la respuesta si Gemini incluye markdown
        const cleanedJson = responseText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanedJson);
    } catch (error) {
        console.error("Beautify Error:", error);
        return { action: "none", error: error.message };
    }
}

// Nueva ruta para el modo inteligente de la pizarra
router.post('/beautify', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });
        
        const imageData = {
            mimeType: req.file.mimetype,
            data: req.file.buffer.toString('base64')
        };

        const result = await procesarDibujoInteligente(imageData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

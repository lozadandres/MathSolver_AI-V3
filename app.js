import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";

dotenv.config();

// Inicializa el API de Google Gemini enviando la clave
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

// Inicializa el historial de conversación en el formato requerido por Gemini
// Gemini usa 'user' y 'model' en lugar de 'user' e 'assistant'
let chatSession = model.startChat({
    history: [
        {
            role: "user",
            parts: [{ text: `
                # SYSTEM_PROMPT: Expert Pedagogical Mathematics Tutor

                You are an advanced virtual assistant specializing in mathematics. Your goal is to provide exceptionally clear, pedagogical, and accurate mathematical guidance, transforming every solution into a mini-lesson.

                ## I. CORE PRINCIPLES & THINKING PROCESS
                Before responding, you MUST analyze the query internally.
                1. Clarification: Is the query ambiguous? 
                2. Categorization: Identify the mathematical branch.
                3. Level Detection: Adapt tone (Basic, Intermediate, Advanced).
                4. Pedagogical Strategy: Think of an analogy and a practical application.

                ## II. BEHAVIORAL RULES
                - Only answer mathematics-related questions.
                - Explain "Why" not just "How".
                - Use analogies to simplify abstract concepts.
                - Provide practical, real-world examples for the topic.
                - STRICT RULE: Do NOT answer questions outside the mathematical domain.
                - If the query is NOT mathematical, respond EXACTLY with: "Lo siento, pero mi especialidad es exclusivamente la resolución y explicación de problemas matemáticos. ¿Hay algún tema o ejercicio de matemáticas en el que pueda ayudarte?"

                ## III. RESPONSE ARCHITECTURE
                - Step-by-Step Resolution: Use standard numbered steps.
                - **Pedagogical Tools** (Mandatory in Detailed Mode):
                    - **Analogy**: Compare the math problem to a everyday situation.
                    - **Practical Example**: Show a real-life application.
                - Mathematical Notation: You MUST use standard LaTeX delimiters:
                    - Use $ ... $ for inline formulas (e.g., $x^2 + y^2 = r^2$).
                    - Use $$ ... $$ for block/centered formulas (e.g., $$\int_{a}^{b} f(x)dx$$).
                - Structural Formatting: Use Markdown headers (##, ###) for sections and bold text (**) for key concepts.
                - Verification: Include a final "Check" step.

                ## IV. GRAPHING INSTRUCTIONS
                - If the user asks for a graph or if the solution involves functions like f(x) = ..., you MUST provide the mathematical expression for graphing.
                - Format the graph data as a JSON block at the end of your response like this:
                  [GRAPH: {"expression": "x^2 + 2*x - 1", "title": "Gráfica de f(x)"}]
                - Use 'x' as the independent variable. Use standard JS/math syntax (e.g., x^2, Math.sin(x), etc.).
            ` }],
        },
        {
            role: "model",
            parts: [{ text: "Entendido. Soy tu tutor experto en matemáticas. ¿En qué puedo ayudarte hoy?" }],
        },
    ],
});

// Inicializa el servidor Express
const app = express();

// Configura middleware
app.use(cors());
app.use(express.json());

// Configura multer para almacenar archivos temporalmente en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Función para obtener la respuesta a una pregunta dada utilizando Google Gemini
async function obtenerRespuesta(pregunta, modo = 'detallado', imageData = null, lang = 'es') {
    try {
        // Instrucciones específicas según el modo e idioma
        let instruccionModo = "";
        
        const prompts = {
            es: {
                rápido: "[MODO RÁPIDO: Si es un cálculo o problema, da solo el resultado final de forma directa. Si es una pregunta de concepto o ejemplo, responde de forma muy breve y concisa, sin rodeos. RESPONDE SIEMPRE EN ESPAÑOL.] ",
                quiz: "[MODO QUIZ: NO des la solución. Actúa como un tutor: identifica el primer paso, explica el concepto y haz una pregunta para que el usuario resuelva. RESPONDE SIEMPRE EN ESPAÑOL.] ",
                detallado: "[MODO DETALLADO: Proporciona una explicación paso a paso, clara y exhaustiva. INTEGRAL: Incluye siempre una ANALOGÍA (comparación con algo cotidiano) y un EJEMPLO PRÁCTICO (aplicación real). Estructura la respuesta como una mini-lección. RESPONDE SIEMPRE EN ESPAÑOL.] "
            },
            en: {
                rápido: "[QUICK MODE: If it's a calculation or problem, give only the final result directly. If it's a concept or example question, respond very briefly and concisely. ALWAYS RESPOND IN ENGLISH.] ",
                quiz: "[QUIZ MODE: DO NOT give the solution. Act as a tutor: identify the first step, explain the concept, and ask a question for the user to solve. ALWAYS RESPOND IN ENGLISH.] ",
                detallado: "[DETAILED MODE: Provide a step-by-step, clear, and comprehensive explanation. INTEGRAL: Always include an ANALOGY (comparison to something everyday) and a PRACTICAL EXAMPLE (real-life application). Structure the response as a mini-lesson. ALWAYS RESPOND IN ENGLISH.] "
            }
        };

        const currentLang = prompts[lang] || prompts.es;
        instruccionModo = currentLang[modo] || currentLang.detallado;

        // Construir partes del mensaje para Gemini
        const messageParts = [{ text: instruccionModo + pregunta }];
        
        // Si hay imagen, agregarla al mensaje
        if (imageData) {
            messageParts.push({
                inlineData: {
                    mimeType: imageData.mimeType,
                    data: imageData.data
                }
            });
        }
        
        let attempt = 0;
        const maxRetries = 8;
        let result;

        while (attempt <= maxRetries) {
            try {
                result = await chatSession.sendMessage(messageParts);
                break; // Éxito, salir del bucle
            } catch (err) {
                attempt++;
                // Verificar si es un error reintentable (500, 503, 504, 429)
                const status = err.status || (err.response && err.response.status);
                const isRetryable = status === 500 || status === 503 || status === 504 || status === 429 || 
                                   err.message.includes("503") || err.message.includes("429") || err.message.includes("500") || 
                                   err.message.includes("exhausted") || err.message.includes("Service Unavailable");
                
                if (attempt > maxRetries || !isRetryable) {
                    console.error(`Error definitivo en Gemini tras ${attempt} intentos:`, err.message);
                    throw err; 
                }

                // Intentar extraer el retraso sugerido por la API (especialmente en errores 429)
                let suggestedDelayMs = 0;
                if (err.errorDetails) {
                    const retryInfo = err.errorDetails.find(d => d['@type'] && d['@type'].includes('RetryInfo'));
                    if (retryInfo && retryInfo.retryDelay) {
                        const seconds = parseInt(retryInfo.retryDelay.replace('s', ''));
                        if (!isNaN(seconds)) suggestedDelayMs = seconds * 1000;
                    }
                }

                // Usar el retraso sugerido o calcular el retroceso exponencial
                const baseDelay = Math.pow(2, attempt - 1) * 1000;
                const calculatedDelay = Math.min(baseDelay, 30000);
                const delay = Math.max(suggestedDelayMs, calculatedDelay) + Math.random() * 2000;
                
                console.log(`Error temporal de Gemini (${status || 'unknown'}). Intento ${attempt}/${maxRetries}. Reintentando en ${Math.round(delay)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        let msg = error.message;
        if (msg.includes("503") || msg.includes("exhausted") || msg.includes("high demand")) {
            return "Lo siento, los servidores de Google Gemini están muy saturados ahora mismo (Error 503). He intentado procesar tu petición varias veces sin éxito. Por favor, espera un par de minutos y vuelve a intentarlo.";
        }
        if (msg.includes("429")) {
            return "Se ha excedido el límite de velocidad (Cuota). Por favor, espera un momento antes de enviar otra pregunta.";
        }
        return "Error al obtener la respuesta de Gemini: " + msg;
    }
}

// Ruta para manejar las solicitudes de chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message, mode, lang } = req.body;
        const respuesta = await obtenerRespuesta(message, mode, null, lang);
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

// Ruta para manejar las solicitudes de chat con archivo
app.post('/api/chat-with-file', upload.single('file'), async (req, res) => {
    try {
        const { message, mode, lang } = req.body;
        let imageData = null;
        
        // Si hay archivo adjunto, procesarlo
        if (req.file) {
            const supportedMimeTypes = [
                'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
                'application/pdf',
                'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
                'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
                'text/plain'
            ];

            if (!supportedMimeTypes.includes(req.file.mimetype)) {
                return res.json(`Lo siento, el archivo que has subido (${req.file.originalname}) tiene un formato no soportado. Por ahora, solo puedo analizar imágenes, PDFs, audios, videos y archivos de texto plano (.txt). Por favor, intenta subir una imagen o un PDF del problema.`);
            }

            imageData = {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString('base64')
            };
        }
        
        const respuesta = await obtenerRespuesta(message, mode, imageData, lang);
        res.json(respuesta);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Nueva ruta para el modo inteligente de la pizarra
app.post('/api/beautify', upload.single('file'), async (req, res) => {
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

// Inicia el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});
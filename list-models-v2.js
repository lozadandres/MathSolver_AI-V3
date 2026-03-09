import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();
    for (const model of models.models) {
      if (model.supportedGenerationMethods.includes("generateContent")) {
        console.log(`Model: ${model.name}, Methods: ${model.supportedGenerationMethods}`);
      }
    }
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();

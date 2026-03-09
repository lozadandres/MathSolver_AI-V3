import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  const apiKey = process.env.OPENAI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
      data.models.forEach(m => {
        if (m.supportedGenerationMethods.includes("generateContent")) {
          console.log(`${m.name} - ${m.displayName}`);
        }
      });
    } else {
      console.log("No models found or error:", data);
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

listModels();

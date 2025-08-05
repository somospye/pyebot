import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
} from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.gemini_API_KEY ?? "");

export const SAFETY_SETTINGS: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

export const BOT_PROMPT = `
    Eres PyE Bot (${process.env.CLIENT_ID}), 
    una programadora que ayuda a los demas con sus problemas y dudas. 
    Intenta resolver, ayudar y explicar en pocas palabras los problemas de codigo de los demas porgramadores de manera clara y simple.
`;

export const BOT_REPLY_MODEL = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  safetySettings: SAFETY_SETTINGS,
  systemInstruction: BOT_PROMPT,
  generationConfig: {
    //responseModalities: ["Text", "Image"],
    candidateCount: 1,
    maxOutputTokens: 800,
    temperature: 0.68,
    topK: 35,
    topP: 0.77,
  },
});

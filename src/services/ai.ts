import {
  type Content,
  type GenerateContentResponse,
  GoogleGenAI,
  Modality,
} from "@google/genai";
import { SAFETY_SETTINGS } from "@/constants/ai";
import { getContextMessages } from "@/utils/getContext";
import { type Message, userMemory } from "@/utils/userMemory";

const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

interface ProcessMessageOptions {
  userId: string;
  message: string;
  quotedText?: string;
}

interface AIResponse {
  text: string;
  image?: Buffer;
}

export const processMessage = async ({
  userId,
  message,
  quotedText,
}: ProcessMessageOptions): Promise<AIResponse> => {
  try {
    const memory = userMemory.get(userId);

    const context = quotedText ? await getContextMessages(quotedText) : [];

    const messages: Message[] = [
      ...context,
      ...memory,
      { role: "user", content: message },
    ];

    const aiResponse = await callGeminiAI(messages);

    userMemory.append(userId, { role: "user", content: message });
    userMemory.append(userId, { role: "model", content: aiResponse.text });

    return aiResponse;
  } catch (error) {
    console.error("[processMessage] Error:", error);
    return {
      text: "Ocurrió un error procesando tu mensaje.",
    };
  }
};

export const callGeminiAI = async (
  messages: Message[],
): Promise<AIResponse> => {
  const contents: Content[] = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents,
      config: {
        safetySettings: SAFETY_SETTINGS,
        candidateCount: 1,
        maxOutputTokens: 800,
        temperature: 0.68,
        topK: 35,
        topP: 0.77,
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    return await processResponse(response);
  } catch (e) {
    console.error("[callGeminiAI] Error:", e);
    return {
      text: "Mejor comamos un poco de sushi 🍣",
    };
  }
};

async function processResponse(
  response: GenerateContentResponse,
): Promise<{ text: string; image?: Buffer }> {
  let text = "";
  let image: Buffer | undefined;

  const candidates = response?.candidates ?? [];

  if (candidates.length === 0) {
    return { text: "Mejor comamos un poco de sushi! 🍣" };
  }

  const parts = candidates[0].content?.parts ?? [];

  for (const part of parts) {
    if ("text" in part && typeof part.text === "string") {
      text += part.text;
    } else if (part?.inlineData?.mimeType && part.inlineData.data) {
      image = Buffer.from(part.inlineData.data, "base64");
    }
  }

  return {
    text: text.trim() || "Mejor comamos un poco de sushi! 🍣",
    image,
  };
}

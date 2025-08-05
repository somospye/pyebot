import {
  type EnhancedGenerateContentResponse,
  type GenerateContentCandidate,
  type GenerateContentRequest,
  GoogleGenerativeAIFetchError,
  type Part,
} from "@google/generative-ai";
import { BOT_REPLY_MODEL } from "@/constants/ai";
import { getContextMessages } from "@/utils/getContext";
import { type Message, type Role, userMemory } from "@/utils/userMemory";

interface ProcessMessageOptions {
  userId: string;
  message: string;
  quotedText?: string;
}

export const processMessage = async ({
  userId,
  message,
  quotedText,
}: ProcessMessageOptions): Promise<string> => {
  try {
    const memory = userMemory.get(userId);

    const context = quotedText ? await getContextMessages(quotedText) : [];

    const messages: Message[] = [
      ...context,
      ...memory,
      { role: "user" as Role, content: message },
    ];

    const aiResponse = await callGeminiAI(messages);

    userMemory.append(userId, { role: "user", content: message });
    userMemory.append(userId, { role: "assistant", content: aiResponse });

    return aiResponse;
  } catch (error) {
    console.error("[processMessage] Error:", error);
    return "Ocurrió un error procesando tu mensaje.";
  }
};

export const callGeminiAI = async (messages: Message[]): Promise<string> => {
  const userParts: Part[] = messages.map((m) => ({ text: m.content }));

  const request: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
  };

  try {
    const result = await BOT_REPLY_MODEL.generateContent(request, {
      timeout: 10000,
    });

    const response = await result.response;
    const { text } = await processResponse(response);

    return text;
  } catch (e) {
    if (e instanceof GoogleGenerativeAIFetchError) {
      return "En este momento, la IA no puede responder tu pregunta.\nIntenta de nuevo más tarde.";
    }
    console.error("[callGeminiAI] Error:", e);
    return "Mejor comamos un poco de sushi 🍣";
  }
};

async function processResponse(
  response:
    | EnhancedGenerateContentResponse
    | { text: () => string; candidates: GenerateContentCandidate[] },
): Promise<{ text: string; image?: Buffer; audio?: Buffer }> {
  let text = "";
  let image: Buffer | undefined;
  let audio: Buffer | undefined;

  if (!response || !response.candidates) {
    return { text: "Mejor comamos un poco de sushi! 🍣" };
  }

  // Procesar audio o imagen si es necesario (funcion generica para distintos modelos)
  if (response?.candidates?.length > 0) {
    const candidate = response?.candidates[0];
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text;
        } else if (part.inlineData) {
          if (part.inlineData.mimeType.startsWith("image")) {
            image = Buffer.from(part.inlineData.data, "base64");
          } else if (part.inlineData.mimeType.startsWith("audio")) {
            audio = Buffer.from(part.inlineData.data, "base64");
          }
        }
      }
    }
  } else {
    text = response.text ? response.text() : "";
  }

  if (!text || text.trim().length === 0) {
    text = "Mejor comamos un poco de sushi! 🍣";
  }

  return { text, image, audio };
}

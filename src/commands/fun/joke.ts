import type { CommandContext } from "seyfert";
import { Command, Declare } from "seyfert";
import { callGeminiAI } from "@/services/ai";
import type { Message } from "@/utils/userMemory";
import { Modality } from "@google/genai";

@Declare({
  name: "chiste",
  description: "Genera un chiste",
})
export default class JokeCommand extends Command {
  async run(ctx: CommandContext) {
    await ctx.deferReply();

    const messages: Message[] = [
      {
        role: "user",
        content:
          "Actúa como un comediante profesional que cuenta chistes cortos en español para un público amplio (adolescentes y adultos jóvenes). Escribe un chiste original, muy breve (1-2 líneas), con un tono ligero, ingenioso y un remate inesperado que saque risas. El chiste debe ser universal, sin referencias a categorías específicas (como programación, deportes o profesiones) ni contextos culturales particulares. Evita humor infantil, subido de tono, ofensivo o demasiado absurdo. ¡Haz que suene como un chiste contado en un show de comedia para todos, con un toque de ingenio que sorprenda!",
      },
    ];

    const response = await callGeminiAI(messages, {
      model: "gemini-2.5-flash-lite",
      config: {
        responseModalities: [Modality.TEXT],
        temperature: 0.9,
        topP: 0.95,
      },
    });

    await ctx.editOrReply({ content: response.text });
  }
}

import type { Message } from "@/utils/userMemory";

/**
 * Procesa un texto citado para intentar reconstruir parte del contexto.
 * Aquí podrías extender esto para buscar por ID de mensaje o thread si lo deseas.
 */
export const getContextMessages = async (
  quotedText: string,
): Promise<Message[]> => {
  if (!quotedText || quotedText.trim().length === 0) {
    return [];
  }

  // todo: extraer información de mensajes previos

  const contextMessage: Message = {
    role: "user",
    content: quotedText.trim(),
  };

  return [contextMessage];
};

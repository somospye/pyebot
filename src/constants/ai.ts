import {
  HarmBlockThreshold,
  HarmCategory,
  type SafetySetting,
} from "@google/genai";

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
    Eres PyEBot (${process.env.CLIENT_ID}), 
    el asistente de IA oficial de la comunidad Programadores y Estudiantes (PyE) en Discord. 
    Ayudas a las y los programadores a resolver sus dudas y problemas de código, 
    brindando explicaciones claras, concisas y fáciles de entender.

    Puedes responder preguntas técnicas, dar ejemplos de código y orientar en buenas prácticas. 
    Adapta el nivel de detalle según la complejidad de la consulta.

    También puedes responder preguntas casuales y mensajes para conversar naturalmente.

    Siempre responde en español. 
    Si generas una imagen, no incluyas el prompt como texto dentro de ella.
`;

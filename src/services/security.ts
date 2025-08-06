import type { Message } from "seyfert";
import { spamFilterList, scamFilterList } from "@/constants/security";
import { phash } from "@/utils/phash";
import sharp from "sharp";
import { createWorker } from 'tesseract.js';
import { redis } from "@/redis";
import { client } from "@/index";
import Channels from "@/constants/channels";

/**
 * Analiza el contenido de un mensaje para detectar amenazas.
 * 
 * @param {Message} message - El mensaje para analizar
 * @returns {Promise<boolean>} - Devuelve `true` si se detectaron amenazas, de lo contrario, devuelve `false`.
 */

const analyzeUserMessage = async (message: Message): Promise<boolean> => {
    const messageContent = message.content?.toLowerCase() ?? "";
    const attachments = message.attachments ?? [];
    const FIVE_MINUTES = 5 * 60 * 1000;
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    const ONE_MONTH = 30 * 24 * 60 * 60;

    for (const spamFilter of spamFilterList) {
        if (spamFilter.filter.test(messageContent)) {
            if (spamFilter.mute) {
                await message.member?.timeout?.(FIVE_MINUTES, "Contenido malisioso detectado");
            } else {
                // todo: filtros sin mute
            }

            if (spamFilter.warnMessage) {
                notifySuspiciousActivity(spamFilter.warnMessage, message.url);
            }

            return true;
        }
    }

    const accountAge = Date.now() - message.author.createdAt.getTime();
    const isNewUser = accountAge < ONE_WEEK;

    if (!isNewUser && attachments.length <= 2) return false; // No analizar imagenes de cuentas viejas, a excepción que sean al menos 2 imágenes

    // Filtra imagenes sospechosas
    for (const attachment of attachments) {
        if (!attachment.contentType?.startsWith("image")) continue;

        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error('Failed to download image');

        const imageBuffer = await response.arrayBuffer();

        // Calcula el hash de la imagen, para detectar imagenes sospechosas en caché
        const imageHash = await phash(imageBuffer, { failOnError: false });

        const cacheKey = `image:${imageHash}`;
        const cachedResult = await redis.get(cacheKey);

        if (cachedResult === "unsafe")  // la imagen es igual a una previamente detectada como sospechosa
        {
            notifySuspiciousActivity(`[SECURITY] Imagen rara ${message.author.tag}: ${attachment.url}`, message.url);
            await message.delete();

            return true;
        }

        const isUnsafeImage = await analyzeImage(imageBuffer);

        if (isUnsafeImage) {

            await redis.set(cacheKey, "unsafe", "EX", ONE_MONTH);

            notifySuspiciousActivity(`[SECURITY] Imagen rara ${message.author.tag}: ${attachment.url}`, message.url);
            await message.delete();
            
            return true;
        }
    }

    return false;
};

const preprocessImage = async (buffer: ArrayBuffer) => {
    return await sharp(buffer)
        .grayscale()                 // Blanco y negro
        .normalize()                 // Mejora contraste
        .threshold(150)              // Resalta texto sobre fondo oscuro
        .toBuffer();
};

const analyzeImage = async (buffer: ArrayBuffer) => {
    const image = await preprocessImage(buffer);

    const worker = await createWorker('eng');

    const { data: { text } } = await worker.recognize(image);

    await worker.terminate();

    const lowerCaseText = text.toLowerCase();

    return scamFilterList.find((filter: RegExp) => filter.test(lowerCaseText));
}

async function notifySuspiciousActivity(warning: string, referenceUrl: string | null) {
    await client.messages.write(Channels.STAFF, {
        content: `**Advertencia:** ${warning}. ${referenceUrl ?? ""}`,
    }).catch((err: Error) => console.error("spamFilter: Error al advertir al staff:", err));
}


export {
    analyzeUserMessage
}
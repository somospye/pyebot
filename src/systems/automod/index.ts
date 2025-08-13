import { UsingClient, type Message } from "seyfert";
import { spamFilterList, scamFilterList } from "@/constants/automod";
import { phash } from "@/utils/phash";
import sharp from "sharp";
import { createWorker } from 'tesseract.js';
import { CHANNELS_ID } from "@/constants/guild";
import { Cache } from "@/utils/cache";

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export class AutoModSystem {
  private client: UsingClient;
  private static instance: AutoModSystem | null = null;
  private tempStorage = new Cache({
    persistPath: "./cache_automod.json",
    persistIntervalMs: 5 * 60 * 1000,
    cleanupIntervalMs: 60 * 60 * 1000
  });

  constructor(client: UsingClient) {
    this.client = client;
  }

  public static getInstance(client: UsingClient): AutoModSystem {
    if (!AutoModSystem.instance) {
      AutoModSystem.instance = new AutoModSystem(client);
    }
    return AutoModSystem.instance;
  }

  public async analyzeUserMessage(message: Message): Promise<boolean> {
    const messageContent = message.content?.toLowerCase() ?? "";
    const attachments = message.attachments ?? [];

    for (const spamFilter of spamFilterList) {
      if (spamFilter.filter.test(messageContent)) {
        if (spamFilter.mute) {
          await message.member?.timeout?.(FIVE_MINUTES, "Contenido malisioso detectado");
        } else {
          // TODO: filtros sin mute
        }

        if (spamFilter.warnMessage) {
          await this.notifySuspiciousActivity(spamFilter.warnMessage, message.url);
        }

        return true;
      }
    }

    const accountAge = Date.now() - message.author.createdAt.getTime();
    const isNewUser = accountAge < ONE_DAY;

    if (!isNewUser && attachments.length <= 2) return false;

    for (const attachment of attachments) {
      if (!attachment.contentType?.startsWith("image")) continue;

      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error('Failed to download image');

      const imageBuffer = await response.arrayBuffer();

      const imageHash = await phash(imageBuffer, { failOnError: false });
      const cacheKey = `image:${imageHash}`;
      const cachedResult = await this.tempStorage.get(cacheKey);

      if (cachedResult === "unsafe") {
        await this.notifySuspiciousActivity(`[SECURITY] Imagen rara ${message.author.tag}: ${attachment.url}`, message.url);
        await message.delete();
        return true;
      }

      const isUnsafeImage = await this.analyzeImage(imageBuffer);

      if (isUnsafeImage) {
        await this.tempStorage.set(cacheKey, 'unsafe', ONE_WEEK);
        await this.notifySuspiciousActivity(`[SECURITY] Imagen rara ${message.author.tag}: ${attachment.url}`, message.url);
        await message.delete();
        return true;
      }
    }

    return false;
  }

  private async preprocessImage(buffer: ArrayBuffer) {
    return await sharp(buffer)
      .grayscale()
      .normalize()
      .threshold(150)
      .toBuffer();
  }

  private async analyzeImage(buffer: ArrayBuffer) {
    const image = await this.preprocessImage(buffer);
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(image);
    await worker.terminate();

    const lowerCaseText = text.toLowerCase();
    return scamFilterList.find((filter: RegExp) => filter.test(lowerCaseText));
  }

  private async notifySuspiciousActivity(warning: string, referenceUrl: string | null) {
    await this.client.messages.write(CHANNELS_ID.staff, {
      content: `**Advertencia:** ${warning}. ${referenceUrl ?? ""}`,
    }).catch((err: Error) => console.error("AutoModSystem: Error al advertir al staff:", err));
  }
}

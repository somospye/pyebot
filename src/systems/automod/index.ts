import type { UsingClient, Message } from "seyfert";
import { spamFilterList, scamFilterList } from "@/constants/automod";
import { phash } from "@/utils/phash";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { CHANNELS_ID } from "@/constants/guild";
import { Cache } from "@/utils/cache";
import { registerAutoModDebug } from "@/debug/automod";

type AttachmentLike = {
  contentType?: string | null;
  url: string;
};

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Núcleo del AutoMod del servidor: revisa texto rápido y luego analiza adjuntos según haga falta.
 */

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

export class AutoModSystem {
  private client: UsingClient;
  private static instance: AutoModSystem | null = null;
  // La caché evita rehacer hashes y nos deja recordar imágenes marcadas un tiempo.
  private tempStorage = new Cache({
    persistPath: "./cache_automod.json",
    persistIntervalMs: 5 * 60 * 1000, // every 5 minutes
    cleanupIntervalMs: 60 * 60 * 1000, // every hour
  });
  private ocrWorkerPromise?: Promise<OcrWorker>;
  private ocrQueue: Promise<void> = Promise.resolve();

  constructor(client: UsingClient) {
    this.client = client;
  }

  /**
   * Patrón singleton: una instancia por cliente porque guardamos caché y pronto un worker OCR.
   */
  public static getInstance(client: UsingClient): AutoModSystem {
    if (!AutoModSystem.instance) {
      AutoModSystem.instance = new AutoModSystem(client);
    }
    return AutoModSystem.instance;
  }

  /**
   * Pipeline principal de moderación. Devuelve true cuando ya se actuó y el caller decide si seguir.
   */
  public async analyzeUserMessage(message: Message): Promise<boolean> {
    try {
      const normalizedContent = message.content?.toLowerCase() ?? "";
      const attachments = (message.attachments ?? []) as AttachmentLike[];

      if (await this.runSpamFilters(message, normalizedContent)) {
        return true;
      }

      if (!this.shouldScanAttachments(message, attachments)) {
        return false;
      }

      for (const attachment of attachments) {
        const handled = await this.handleAttachment(message, attachment);
        if (handled) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("AutoModSystem: error evaluando mensaje:", error);
      return false;
    }
  }

  /**
   * Recorre los filtros regex sobre el contenido y lanza la acción configurada si matchea.
   * Devuelve true si se actuó (mute o similar).
   */
  private async runSpamFilters(
    message: Message,
    normalizedContent: string,
  ): Promise<boolean> {
    for (const spamFilter of spamFilterList) {
      if (!spamFilter.filter.test(normalizedContent)) continue;

      if (spamFilter.mute) {
        await message.member?.timeout?.(
          FIVE_MINUTES,
          "Contenido malisioso detectado",
        );
      } else {
        // TODO: filtros sin mute
        // ? Se podria avisar al staff o similar
      }

      if (spamFilter.warnMessage) {
        await this.notifySuspiciousActivity(
          spamFilter.warnMessage,
          message,
        );
      }

      return true;
    }

    return false;
  }

  /**
   * Decide si las heurísticas permiten analizar adjuntos para este mensaje.
   */
  private shouldScanAttachments(
    _message: Message,
    attachments: AttachmentLike[],
  ): boolean {
    if (attachments.length === 0) {
      return false;
    }

    const hasImageAttachment = attachments.some((attachment) =>
      attachment.contentType?.startsWith("image"),
    );

    if (!hasImageAttachment) {
      // Sólo nos interesan adjuntos que realmente sean imágenes.
      return false;
    }

    return true;
  }

  /**
   * Procesa un adjunto y devuelve true si ya se actuó sobre el mensaje.
   */
  private async handleAttachment(
    message: Message,
    attachment: AttachmentLike,
  ): Promise<boolean> {
    if (!attachment.contentType?.startsWith("image")) {
      return false;
    }

    const imageBuffer = await this.fetchAttachmentBuffer(attachment.url);
    const imageHash = await phash(imageBuffer, { failOnError: false });
    const cacheKey = `image:${imageHash}`;
    const cachedResult = await this.tempStorage.get(cacheKey);

    if (cachedResult === "unsafe") {
      await this.flagSuspiciousImage(message, attachment.url);
      return true;
    }

    const isUnsafeImage = await this.analyzeImage(imageBuffer);

    if (isUnsafeImage) {
      await this.tempStorage.set(cacheKey, "unsafe", ONE_WEEK);
      await this.flagSuspiciousImage(message, attachment.url);
      return true;
    }

    return false;
  }

  /**
   * Descarga el adjunto y regresa su contenido como ArrayBuffer.
   */
  private async fetchAttachmentBuffer(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to download image");
    }

    return await response.arrayBuffer();
  }

  /**
   * Notifica al staff sobre una imagen sospechosa.
   */
  private async flagSuspiciousImage(message: Message, attachmentUrl: string) {
    await this.notifySuspiciousActivity(
      `[SECURITY] Imagen rara ${message.author.tag}: ${attachmentUrl}`,
      message
    );
  }

  /**
   * Normaliza la imagen para mejorar el OCR; mantenemos el uso de sharp aquí mismo.
   */
  private async preprocessImage(buffer: ArrayBuffer) {
    return await sharp(buffer)
      .grayscale()
      .normalize()
      .threshold(150)
      .toBuffer();
  }

  /**
   * Corre OCR sobre la imagen preparada y compara el texto con los patrones de estafa.
   * Se apoya en un único worker compartido para evitar crear procesos extra.
   */
  private async analyzeImage(buffer: ArrayBuffer) {
    const image = await this.preprocessImage(buffer);
    const text = await this.enqueueOcrTask(async (worker) => {
      const {
        data: { text },
      } = await worker.recognize(image);
      return text;
    });

    const normalizedText = text.toLowerCase();
    return scamFilterList.find((filter: RegExp) => filter.test(normalizedText));
  }

  /**
   * Obtiene (o crea) el worker OCR compartido. Arranca en inglés porque es lo más común en los scams.
   */
  private getOcrWorker(): Promise<OcrWorker> {
    if (this.ocrWorkerPromise) {
      return this.ocrWorkerPromise;
    }

    const workerPromise = createWorker("eng");
    this.ocrWorkerPromise = workerPromise;
    return workerPromise;
  }

  /**
   * Serializa las peticiones al worker para evitar condiciones de carrera.
   */
  private enqueueOcrTask<T>(
    run: (worker: OcrWorker) => Promise<T>,
  ): Promise<T> {
    const task = this.ocrQueue
      .then(() => this.getOcrWorker())
      .then((worker) => run(worker));

    this.ocrQueue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  /**
   * Aviso al equipo de moderación. Si falla, no frenamos el flujo porque quizá el mensaje ya no está.
   */
  private async notifySuspiciousActivity(
    warning: string,
    message: Message
  ) {

    // TODO: botones para borrar el mensaje directamente y saltar al mensaje
    await this.client.messages
      .write(CHANNELS_ID.staff, {
        content: `**Advertencia:** ${warning}. ${message.url ?? ""}`,
      })
      .catch((err: Error) =>
        console.error("AutoModSystem: Error al advertir al staff:", err),
      );
  }
}

// Si DEBUG incluye "automod" (p. ej. DEBUG=automod), se activa la instrumentación.
// @ts-ignore
registerAutoModDebug(AutoModSystem);

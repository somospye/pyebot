import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import * as ort from "onnxruntime-node";
import type { PaddleOcrService as PaddleOcrServiceClass } from "paddleocr";

type ImageInput = { data: Uint8Array; width: number; height: number };

const OCR_ASSETS_DIR =
  process.env.OCR_ASSETS_DIR ?? path.resolve(process.cwd(), "assets/ocr");
const DETECTION_MODEL_FILE =
  process.env.OCR_DETECTION_MODEL ?? "PP-OCRv5_mobile_det_infer.onnx";
const RECOGNITION_MODEL_FILE =
  process.env.OCR_RECOGNITION_MODEL ?? "PP-OCRv5_mobile_rec_infer.onnx";
const DICTIONARY_FILE =
  process.env.OCR_DICTIONARY ?? "ppocrv5_dict.txt";

let ocrServicePromise: Promise<PaddleOcrServiceClass> | undefined;
let ocrQueue: Promise<void> = Promise.resolve();

async function preprocessImage(buffer: ArrayBuffer): Promise<ImageInput> {
  const source = Buffer.from(buffer);
  const { data, info } = await sharp(source)
    .grayscale()
    .normalize()
    .threshold(150)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

async function createOcrService(): Promise<PaddleOcrServiceClass> {
  try {
    const baseDir = OCR_ASSETS_DIR;
    const [detectionModel, recognitionModel, dictionaryRaw] = await Promise.all([
      readFile(path.join(baseDir, DETECTION_MODEL_FILE)),
      readFile(path.join(baseDir, RECOGNITION_MODEL_FILE)),
      readFile(path.join(baseDir, DICTIONARY_FILE), "utf8"),
    ]);

    const module = await import("paddleocr");
    const PaddleOcrService =
      (module as any).PaddleOcrService ??
      (globalThis as any)?.paddleocr?.PaddleOcrService;

    if (!PaddleOcrService) {
      throw new Error(
        "OCR: PaddleOcrService no está disponible tras importar el módulo.",
      );
    }

    const dictionary = dictionaryRaw
      .split(/\r?\n/)
      .map((line) => line.trim());

    if (dictionary.length > 0 && dictionary[dictionary.length - 1] === "") {
      dictionary.pop();
    }

    if (dictionary.length === 0 || dictionary[0] !== "") {
      dictionary.unshift("");
    }

    return await PaddleOcrService.createInstance({
      ort,
      detection: {
        modelBuffer: bufferToArrayBuffer(detectionModel),
      },
      recognition: {
        modelBuffer: bufferToArrayBuffer(recognitionModel),
        charactersDictionary: dictionary,
      },
    });
  } catch (error) {
    console.error("OCR: no se pudo inicializar PaddleOCR", error);
    throw error;
  }
}

function getOcrService(): Promise<PaddleOcrServiceClass> {
  if (!ocrServicePromise) {
    ocrServicePromise = createOcrService();
  }

  return ocrServicePromise;
}

async function enqueueOcrTask<T>(
  run: (service: PaddleOcrServiceClass) => Promise<T>,
): Promise<T> {
  const task = ocrQueue
    .then(() => getOcrService())
    .then((service) => run(service));

  ocrQueue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}

export async function recognizeText(buffer: ArrayBuffer): Promise<string> {
  const image = await preprocessImage(buffer);
  const results = await enqueueOcrTask((service) => service.recognize(image));
  return results.map((item) => item.text).join(" ");
}

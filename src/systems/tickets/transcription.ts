import { UsingClient } from "seyfert";

/**
 * Crea un archivo html con la transcripción de un ticket
 * Retorna un buffer con el contenido del archivo
 */
export async function create_transcription(
    client: UsingClient,
    channelId: string,
) {

    const messages = [];
    let before: string | undefined;

    while (true) {
        const batch = await client.messages.list(
            channelId,
            before ? { limit: 100, before } : { limit: 100 },
        );

        if (!batch.length) {
            break;
        }

        messages.push(...batch);

        if (batch.length < 100 || !batch[batch.length - 1]?.id) {
            break;
        }

        before = batch[batch.length - 1].id;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcripción de Ticket</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
        .message { margin-bottom: 15px; padding: 10px; background-color: #fff; border-radius: 5px; }    
        .author { font-weight: bold; }
        .timestamp { color: #888; font-size: 0.9em; }
        .content { margin-top: 5px; }
    </style>
</head>
<body>
    <h1>Transcripción de Ticket</h1>
    ${messages
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
        .map(
            (msg) => `
    <div class="message">
        <div class="author">${msg.author?.username || "Desconocido"}</div>
        <div class="timestamp">${new Date(msg.timestamp ?? 0).toLocaleString()}</div>
        <div class="content">${msg.content || ""}</div>
    </div>
    `,
        ).join("")}
</body>
</html>`;


    // Return file buffer
    return Buffer.from(html, "utf-8");
}

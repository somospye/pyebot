import { ensureTicketMessage } from "@/systems/tickets";
import { onBotReady } from "../hooks/botReady";

onBotReady((_, client) => {
    ensureTicketMessage(client).catch((err) => {
        console.error("[tickets] failed to ensure ticket message", {
            error: err,
        });
    });
});
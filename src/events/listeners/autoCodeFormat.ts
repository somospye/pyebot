import { detectCodeLanguage, toFencedBlock } from "@/modules/code-detection";
import { onMessageCreate } from "../hooks/messageCreate";
import { onMessageReactionAdd } from "../hooks/messageReaction";


// Reacción a añadir cuando se detecta código
// Cuando se añade esta reacción, se activa un listener para que cuando
// algun usuario la pulse, el bot responda con el bloque de código formateado.
const EMOJI_CODE_DETECTED = '✨';

onMessageCreate(async (message) => {
    if (message.author?.bot) return;

    const is_code = detectCodeLanguage(message.content);

    const reaction_listener = onMessageReactionAdd(async (interaction) => {
        // Solo responder a reacciones en el mensaje original
        if (
            interaction.messageId !== message.id ||
            interaction.emoji.name !== EMOJI_CODE_DETECTED ||
            interaction.member?.user.bot === true
        ) return;

        const fenced = toFencedBlock(message.content);

        if (fenced) {
            // delete original message
            await message.delete("Auto code formatting");
            // send formatted code block
            await message.write({ content: fenced });

            reaction_listener(); // desuscribirse para no responder más veces
        }
    });

    if (is_code.isCode) {
        await message.react(EMOJI_CODE_DETECTED); // Reacciona con un emoji para indicar que se ha detectado código.
    }
})

# Guia rapida del modulo UI

El modulo UI agrupa utilidades para construir vistas interactivas sobre Seyfert sin repetir wiring. Todo lo que necesitas esta reexportado desde `@/modules/ui`.

## Como se arma una vista
1. **Estado inicial**: define un objeto plano con los valores que quieras controlar.
2. **Builder**: pasa una funcion que reciba el `state` reactivo y devuelva el payload del mensaje.
3. **Sender**: entrega una funcion que envie o edite el mensaje (por lo general `ctx.editOrReply`).
4. Llama a `.send()` para publicar la primera version.

```ts
import { ActionRow, Embed } from "seyfert";
import { Button, UI } from "@/modules/ui";
import { ButtonStyle } from "seyfert/lib/types";

await new UI<{ count: number }>(
  { count: 0 },
  (state) => {
    const embed = new Embed().setDescription(`Clicks: ${state.count}`);

    const increment = new Button()
      .setLabel("+1")
      .setStyle(ButtonStyle.Primary)
      .onClick("increment", () => { state.count += 1; });

    return { embeds: [embed], components: [new ActionRow().addComponents(increment)] };
  },
  (msg) => ctx.editOrReply(msg),
).send();
```

## Estado reactivo
- Lee directamente (`state.count`) y asigna nuevos valores (`state.count = 3`). Cada cambio reconstruye y reenvia el mensaje.
- Si necesitas esperar el render, usa el signal crudo: `await state.$.count.set(3)`.

## Componentes interactivos disponibles
- **Botones**: `Button#onClick(id, handler)` registra un callback en el registry de sesiones.
- **Modales**: `Button#opens(modal, handler?)` abre un modal y ejecuta el handler opcional despues.
- **Select menus**: `selectMenu.onSelect(id, handler)` funciona igual para String, User, Role, Channel, Mentionable y GuildForumTag.

## Recursos extra
- Revisa los comandos en `src/commands/ui_tests` para ejemplos completos de botones, modales y menus.
- `sessions.ts` controla el TTL de los handlers; ajusta `TIME_TO_LIVE` cuando necesites callbacks mas largos.

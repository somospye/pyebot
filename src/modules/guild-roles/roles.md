# Roles del bot

Este paquete contiene utilidades relacionadas con los "managed roles" utilizados por los
comandos de moderacion. La persistencia vive en `src/modules/flat_api/guild.ts`,
un wrapper tipado sobre la tabla `guilds` definida en `@/schemas/guild`. En este modulo
solo quedan los helpers de logica (constantes para la UI, rate limits, resolucion de
permisos) y el rate limiter en memoria.

## API expuesta (`index.ts`)

- `DEFAULT_MODERATION_ACTIONS`: acciones que la UI muestra para configurar overrides y
  limites (se utilizan en los comandos `/roles`).
- `describeWindow(limit)`: etiqueta amigable para los limites (`10m`, `1h`, `no-window`,
  `45s`, etc.).
- `resolveRoleActionPermission(options)`: combina overrides guardados en base de datos y
  los permisos de Discord para decidir si una accion esta permitida para un miembro.
- `consumeRoleLimits(options)`: aplica el rate limiter para cada rol administrado que
  registre un limite sobre la accion, devolviendo los consumos o la violacion detectada.

Todas las operaciones de lectura/escritura sobre la columna `roles` de la tabla `guilds`
(listar configuraciones, actualizar overrides o limites, etc.) deben hacerse a traves de
`get_data_api()`. Los comandos bajo `src/commands/roles` ya consumen esa API de
forma directa.

## Formato persistido

```json
"roles": {
  "moderacion-staff": {
    "discordRoleId": "1234567890",
    "limits": {
      "kick": { "limit": 10, "window": "24h", "windowSeconds": null },
      "ban": { "limit": 3, "window": "24h", "windowSeconds": null }
    },
    "reach": {
      "warn add": "allow",
      "purge": "deny"
    }
  }
}
```

Los nombres de las acciones (`kick`, `warn add`, etc.) quedan a criterio del comando que
consume los limites. Para que el middleware los reconozca deben coincidir con el
`fullCommandName` de la interaccion.


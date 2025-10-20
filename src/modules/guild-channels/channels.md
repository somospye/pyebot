## Sistema de canales del bot

El bot necesita conocer ciertos canales "core" para operar (logs, staff, etc.). Cada canal
requerido se describe en `src/modules/guild-channels/constants.ts` con tres propiedades
estables:

- `name`: identificador interno fijo que se usa en el codigo (p. ej. `messageLogs`).
- `label`: texto corto que explica el uso del canal en Discord.
- `defaultChannelId`: canal de respaldo tomado de `CHANNELS_ID` mientras no se configure otro.

La configuracion persistente se almacena en la columna `channels` de la tabla `guilds`. Las lecturas y escrituras se realizan obteniendo el data API mediante `get_data_api()` y llamando a las utilidades definidas en `src/modules/flat_api/guild.ts` para mantener el JSON normalizado.

### Flujo de inicializacion

1. La primera vez que se consulta un servidor se crea el registro con los canales core
   apuntando a los valores por defecto (los mismos hardcodeados en `CHANNELS_ID`).
2. Cada vez que se agregan nuevos canales core al codigo se normaliza el registro existente
   para asegurarse de que haya un id y un label definidos.

### Comandos disponibles

Todos los comandos viven bajo `/commands/channels` y requieren permisos de `ManageGuild`:

| Subcomando          | Uso                                                                            |
|---------------------|---------------------------------------------------------------------------------|
| `/channels list`    | Muestra los canales core actuales y los opcionales registrados.                |
| `/channels set`     | Actualiza el canal de un slot core usando `setCoreChannel` del data API. |
| `/channels add`     | Registra un canal opcional guardando un label y el canal (usa `addManaged`).   |
| `/channels remove`  | Elimina un canal opcional usando su identificador (`removeManaged`).           |



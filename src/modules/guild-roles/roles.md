# Roles del bot

Este modulo mantiene una capa muy ligera para asociar *roles de Discord* con limites de
uso adicionales que el bot aplica durante sus comandos. No reemplaza los permisos de
Discord: unicamente anade una forma de restringir cuantas veces se puede ejecutar cierta
accion en una ventana de tiempo.

Está principalmente orientado a comandos de moderación.

## Conceptos principales

- **Configuracion de rol**: estructura plana guardada en la columna `roles` de la tabla
  `guilds`. Cada entrada se identifica por una clave (`id`) que elegimos nosotros, mientras
  que `roleId` referencia el rol real dentro del servidor.
- **Rate limits**: mapa `accion -> limite` donde cada limite es un objeto JSON con dos
  campos: `uses` (cantidad permitida) y `perSeconds` (ventana en segundos). Un valor `null`
  significa "sin limite". Si la clave no existe, el comando que consulte debera aplicar su
  comportamiento por defecto.

## API expuesta (`index.ts`)

Todos los helpers reciben el `guildId` y opcionalmente una instancia de base de datos de
Drizzle. Si no se pasa ninguna, se usa `db` (la exportacion principal de `src/db.ts`).

### `getGuildRoles(guildId)`
Devuelve una copia de todas las configuraciones registradas. Siempre regresa un objeto
propio para evitar mutaciones accidentales del estado persistido.

### `upsertRole(guildId, { id, roleId, rateLimits? })`
Crea o actualiza la entrada indicada. Si no se envian nuevos rate limits conservara los que
ya existian en la base de datos.

### `removeRole(guildId, id)`
Elimina por completo la configuracion asociada a la clave. Devuelve `true` cuando habia
algo que borrar y `false` si no existia.

### `setRoleRateLimit(guildId, id, action, limit)`
Actualiza (o crea) el limite para una accion concreta. El parametro `limit` es el objeto
completo con `uses` y `perSeconds` o `null` para quitar restricciones. Devuelve el registro
actualizado del rol.

### `clearRoleRateLimit(guildId, id, action)`
Borra la clave del mapa de rate limits, de modo que la accion vuelva a usar el comportamiento
por defecto del comando. Si el rol no existe se lanza un error.

### `getRoleRateLimit(guildId, id, action)`
Obtiene rapidamente el limite configurado para una accion. Devuelve `undefined` si nunca se
guardo nada y `null` cuando se indico explicitamente que no haya limite.

### `listRoles(guildId)`
Convierte el diccionario en un arreglo de `{ id, record }`, util para serializar en embeds o
respuestas HTTP.

## Comandos disponibles

Dentro de `/roles` se cargan subcomandos que envuelven estas utilidades:

- `/roles set`: registra o actualiza la vinculacion con un rol de Discord.
- `/roles remove`: elimina por completo una configuracion.
- `/roles list`: muestra los roles administrados y sus limites activos.
- `/roles set-limit`: define un limite puntual (`uses` + `perSeconds`).
- `/roles clear-limit`: borra el limite de una accion para volver al comportamiento base.
- `/roles dashboard`: abre un panel efimero con selects, botones y modales para editar
  el nombre visible, vincular un rol de Discord, ajustar limites y configurar overrides de
  alcance sin abandonar Discord. Utiliza sesiones de 5 minutos que pueden reabrirse.

Las acciones utilizadas por los comandos internos del bot son:

- `kick` para la expulsion (`/kick`).
- `ban` para el comando `/ban`.
- `warn add` para el subcomando `/warn add`.

Usa exactamente esas claves al configurar los limites si deseas cubrir esas rutas.

> Nota: el middleware usa `context.fullCommandName`, por lo que la clave debe coincidir con el nombre completo del comando (con espacios), tal como aparece en Discord.

## Flujo habitual

1. Al cargar un comando de moderacion, el middleware consulta `getRoleRateLimit` para
   decidir si se supera el limite antes de ejecutar la accion.
2. Ofrecer comandos administrativos que llamen a `upsertRole`, `setRoleRateLimit` y
   `clearRoleRateLimit` para que el staff ajuste los limites sin reiniciar el bot.
3. Opcionalmente cachear en memoria las respuestas de `getGuildRoles`; las funciones
   siempre devuelven copias, por lo que la cache puede mutar su propia copia sin riesgo.

## Formato persistido

```json
"roles": {
  "moderacion-staff": {
    "roleId": "1234567890",
    "rateLimits": {
      "kick": { "uses": 10, "perSeconds": 86400 },
      "ban": { "uses": 3, "perSeconds": 86400 },
      "warn add": null
    }
  }
}
```

Cada clave del objeto raiz representa una configuracion de rol. Los nombres de las acciones
(`kick`, `ban`, etc.) quedan a criterio del comando que los utilice. 


## Sistema de cooldowns del bot

El sistema de cooldowns controla cuántas veces un usuario (o un recurso como un canal/guild) puede ejecutar un comando en un intervalo de tiempo.  
Esto evita abusos y garantiza un uso equilibrado de las funciones del bot.

### Estructura principal

- **`CooldownManager`** (`src/modules/cooldown/manager.ts`):  
  Clase de alto nivel que expone métodos para consultar, usar y resetear cooldowns.
- **`CooldownResource`** (`src/modules/cooldown/resource.ts`):  
  Encargado de persistir el estado de cada cooldown en caché o base de datos.

### Propiedades de configuración

Cada comando puede definir su propio cooldown en la propiedad `cooldown`:

- **`type`**: alcance del cooldown. Puede ser:
  - `user`: el cooldown se aplica por usuario.
  - `guild`: el cooldown se aplica por servidor.
  - `channel`: el cooldown se aplica por canal.
- **`interval`**: duración del cooldown en milisegundos.
- **`uses`**: cantidad de usos permitidos dentro del intervalo (por defecto uno).

Ejemplo:

```ts
{
  type: 'user',
  interval: 10_000,
  uses: { default: 1 }
}

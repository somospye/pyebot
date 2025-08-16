# Guía de Contribución

¡Bienvenido a la guía de contribución de **PyEBot**!
Antes de comenzar, asegurate de leer y seguir todas las instrucciones de este documento para que tu colaboración pueda integrarse sin problemas.

---

## 🚀 Preparar el entorno

1. **Haz un fork** de este repositorio desde el botón `Fork` en la parte superior.

2. **Clona tu fork en local**:

   ```bash
   git clone https://github.com/TU_USUARIO/pyebot
   cd pyebot
   ```

3. **Instala dependencias** con [pnpm](https://pnpm.io). Si no lo tenés, primero instalalo.

   ```bash
   pnpm install
   ```

4. **Configura [Lefthook](https://github.com/evilmartians/lefthook)**
   Es obligatorio ejecutar:

   ```bash
   lefthook install
   ```

   Esto asegura que se apliquen automáticamente las verificaciones de formato, lint y mensajes de commit antes de cada *commit*.

---

## 📝 Convenciones de commits

* Utilizamos el estándar [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
* **No uses emojis** en los mensajes de commit.
* Lefthook validará esto automáticamente.
* Este estándar es necesario para poder generar automáticamente los `changelogs` con [git-cliff](https://git-cliff.org).

---

## 🔑 Variables de entorno

Configura el archivo `.env` con las siguientes variables mínimas:

```env
TOKEN=DISCORD_TOKEN
CLIENT_ID=DISCORD_CLIENT_ID
```

Si querés habilitar las características de IA, agregá además:

```env
GOOGLE_GENAI_API_KEY=API_KEY
```

---

## 🤖 Levantar el bot

Para compilar y ejecutar el bot en modo normal:

```bash
pnpm start
```

Para levantarlo en modo desarrollo (recompilación automática):

```bash
pnpm dev
```

---

## 🗄️ Base de datos

Podés levantar la base de datos con Docker usando el archivo [docker-compose.yml](./docker-compose.yml):

```bash
docker-compose up -d
```

Configura las variables correspondientes en tu `.env`:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/pyebot
POSTGRES_DB=pyebot
POSTGRES_USER=postgres
POSTGRES_PASSWORD=PASSWORD
```

👉 Lo ideal es **solo cambiar la contraseña** (`POSTGRES_PASSWORD`) y mantener el resto igual.

### 📌 Migraciones con Drizzle

Antes de usar la base de datos, asegurate de correr las migraciones:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Esto creará y aplicará los cambios necesarios en la DB.

---

## 🔀 Pull Requests

1. Trabajá siempre en una rama nueva creada desde `main`.
   Ejemplo:

   ```bash
   git checkout -b feat/nombre-de-tu-feature
   ```

2. Asegurate de que tu código pase todas las validaciones antes de abrir la PR:

   ```bash
   pnpm lint
   pnpm fmt:check
   ```

   Aunque estas se verifican gracias a **Lefthook**, por lo que normalmente no es necesario ejecutar los comandos.

3. Escribe una descripción clara de los cambios en la PR. Si es una corrección de bug, explica cómo reproducirlo y cómo se resolvió.

4. Nombra la PR de forma coherente con el commit principal (siguiendo **Conventional Commits**).

5. Esperá la revisión. Se pedirá que ajustes el código si no cumple con las reglas o estilos definidos.
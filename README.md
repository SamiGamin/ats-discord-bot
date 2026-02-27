# 🚛 ATS Server Monitor Bot

Bot de Discord que monitorea tu servidor de **American Truck Simulator** y muestra el estado en tiempo real con un embed actualizable.

## ✨ Funciones

- 🟢 Detecta cuando se crea un convoy → muestra **EN LINEA**
- 📥 Detecta jugadores conectandose → los lista con nombre
- 📤 Detecta jugadores saliendo
- 🔴 Detecta cuando se cierra el convoy → muestra **FUERA DE LINEA**
- ⏱️ Muestra el tiempo en linea
- 🧩 Muestra los mods activos con links al Workshop
- 👑 Identifica al Host del servidor

## 📋 Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- Una cuenta de Discord
- American Truck Simulator

## 🚀 Instalacion

### 1. Crear el Bot en Discord

1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clic en **"New Application"** → nombre: **ATS Server Monitor**
3. Ve a **Bot** → clic en **"Reset Token"** → copia el **Token**
4. Activa **"Message Content Intent"**
5. Ve a **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Embed Links`, `Read Message History`
6. Copia la URL → pegala en el navegador → selecciona tu servidor → **Autorizar**

### 2. Configurar el Bot

1. Copia la carpeta `ats-discord-bot` dentro de tu carpeta de ATS:

   ```
   Documents/American Truck Simulator/ats-discord-bot/
   ```

2. Crea un archivo `.env` (o renombra `.env.example`) y pega tu token:

   ```
   DISCORD_TOKEN=tu_token_aqui
   ```

3. Abre una terminal en la carpeta e instala las dependencias:

   ```
   npm install
   ```

4. Inicia el bot:

   ```
   npm start
   ```

   O haz doble clic en `start-bot.bat` (Windows)

### 3. Configurar desde Discord

Una vez el bot este en linea, usa estos comandos:

| Comando | Descripcion |
|---------|-------------|
| `/config canal #canal` | Canal donde aparecera el embed |
| `/config servidor Nombre` | Nombre de tu servidor ATS |
| `/config sessionid ID/puerto` | ID de sesion del convoy |
| `/config logpath ruta` | Ruta al game.log.txt |
| `/config ver` | Ver la configuracion actual |
| `/mod agregar nombre url` | Agregar un mod (url opcional) |
| `/mod quitar numero` | Quitar un mod por numero |
| `/mod lista` | Ver mods configurados |
| `/mod limpiar` | Quitar todos los mods |
| `/estado` | Forzar actualizacion del embed |

## 📁 Estructura

```
ats-discord-bot/
├── bot.js          # Codigo principal del bot
├── config.json     # Configuracion (se genera automaticamente)
├── .env            # Token del bot (NO compartir)
├── .env.example    # Ejemplo del .env
├── package.json    # Dependencias
├── start-bot.bat   # Iniciar en Windows
└── README.md       # Este archivo
```

## ⚠️ Notas Importantes

- El bot **debe ejecutarse en la misma PC** donde corre ATS (lee el archivo `game.log.txt` local)
- **Nunca compartas** tu archivo `.env` (contiene el token secreto del bot)
- El archivo `config.json` se genera automaticamente con los comandos `/config`
- Si el embed desaparece, usa `/estado` para crear uno nuevo

## 📝 Licencia

Libre para uso personal y comunitario. Creditos a Convoy Latinos en Ruta.

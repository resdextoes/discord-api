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
    ],
    // Limity pamięci cache - kluczowe, by Render nie ubijał bota
    makeCache: (manager) => {
        if (manager.name === 'MessageManager') return 10; // Trzymaj tylko 10 ostatnich wiadomości
        if (manager.name === 'UserManager' || manager.name === 'GuildMemberManager') return 50; 
        return 0; // Reszta (np. reakcje) nie zajmuje RAMu
    }
});

// --- KONFIGURACJA ID ---
const GUILD_ID = '1439591884287639694';
const ROLE_ID = '1439593337488150568';
const ANNOUNCEMENT_CHANNEL_ID = '1453854451961041164'; 
const LOG_CHANNEL_ID = '1457442534396530809'; 
const LOSOWANIE_CHANNEL_ID = '1457760176244265125'; // Kanał dla komendy /los
const WEBSITE_CHANNEL_NAME = 'strona';

const APP_URL = process.env.APP_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` || `https://discord-api-jqj5.onrender.com`;

let cachedAdmins = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

const commands = [
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Usuwa wiadomości')
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('Liczba (1-100)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('los')
        .setDescription('Generuje losowy login i hasło')
].map(command => command.toJSON());

// --- POMOCNICZA FUNKCJA: GENEROWANIE ZNAKÓW ---
function generateRandomString(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
}

// --- FUNKCJA SELF-PING ---
function startSelfPing() {
    if (!APP_URL || APP_URL.includes('undefined')) return;
    
    // Zmieniamy na 13 minut (780 000 ms)
    setInterval(() => {
        https.get(APP_URL, (res) => {
            if (res.statusCode === 429) {
                console.warn('Self-ping: Otrzymano błąd 429 (Zwolnij!).');
            } else {
                console.log(`Self-ping (chyba okej): Status ${res.statusCode}`);
            }
        }).on('error', (err) => {
            console.error('Ping error:', err.message);
        });
    }, 780000); // 13 minut
}

// --- OBSŁUGA KOMENDY TEKSTOWEJ /LOS ---
client.on('messageCreate', async (message) => {
    // Sprawdzamy kanał, treść i czy autor nie jest botem
    if (message.channel.id === LOSOWANIE_CHANNEL_ID && !message.author.bot) {
        if (message.content.toLowerCase() === '/los') {
            const randomLogin = generateRandomString(4);
            const randomPassword = generateRandomString(6);

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎲 Wygenerowano nowe dane dostępu')
                .setDescription('Oto Twoje tymczasowe dane logowania:')
                .addFields(
                    { name: '👤 Login', value: `\`${randomLogin}\``, inline: true },
                    { name: '🔑 Hasło', value: `\`${randomPassword}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Generator FC Drewno' });

            await message.reply({ embeds: [embed] });
        }
    }
});

// --- ENDPOINT: LOGOWANIE WEJŚĆ (Z IP) ---
app.post('/log-access', async (req, res) => {
    try {
        // Dodajemy 'ip' do pobieranych danych z body
        const { name, surname, page, ip } = req.body; 
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        
        if (!channel) return res.status(404).json({ error: "Kanał nie istnieje" });

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔓 Uzyskano dostęp do mObywatela')
            .addFields(
                { name: '👤 Osoba', value: `**${name} ${surname}**`, inline: true },
                { name: '📄 Widok', value: `\`${page}\``, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip || 'Nie wykryto'}\``, inline: false },
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

app.post('/github-webhook', async (req, res) => {
    try {
        const data = req.body;
        if (!data.commits) return res.status(200).send('OK');
        const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID).catch(() => null);
        if (!channel) return res.status(404).send('Error');

        for (const commit of data.commits) {
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setAuthor({ name: commit.author.name || 'GitHub', iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' })
                .setTitle(`🛠️ Nowy commit: ${data.repository.name}`)
                .setURL(commit.url)
                .setDescription(`**Wiadomość:**\n${commit.message}`)
                .addFields(
                    { name: 'Gałąź', value: `\`${data.ref.split('/').pop()}\``, inline: true }, 
                    { name: 'Repozytorium', value: `[Link](${data.repository.html_url})`, inline: true }
                )
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Error');
    }
});

// --- KOMENDA SLASH: CLEAR ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 100) return interaction.reply({ content: 'Podaj liczbę 1-100', flags: [MessageFlags.Ephemeral] });
        
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply({ content: `Pomyślnie usunięto ${deleted.size} wiadomości.` });
        } catch (error) {
            console.error('Błąd clear:', error);
            await interaction.editReply({ content: 'Wystąpił błąd podczas usuwania wiadomości.' });
        }
    }
    if (interaction.commandName === 'los') {
        if (interaction.channelId !== LOSOWANIE_CHANNEL_ID) {
            return interaction.reply({ content: 'Tej komendy można używać tylko na wyznaczonym kanale!', flags: [MessageFlags.Ephemeral] });
        }

        const randomLogin = generateRandomString(4);
        const randomPassword = generateRandomString(6);

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎲 Wygenerowano nowe dane')
            .addFields(
                { name: '👤 Login', value: `\`${randomLogin}\``, inline: true },
                { name: '🔑 Hasło', value: `\`${randomPassword}\``, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
});

// --- POBIERANIE ADMINÓW ---
app.get('/admins', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedAdmins && (now - lastFetchTime < CACHE_DURATION)) return res.json(cachedAdmins);

        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // Pobieramy TYLKO członków z daną rolą, a nie cały serwer
        const role = await guild.roles.fetch(ROLE_ID);
        if (!role) return res.status(404).json({ error: "Rola nie istnieje" });

        const admins = role.members.map(m => {
            const activity = m.presence?.activities.find(act => act.type === 0);
            return {
                id: m.id,
                username: m.user.username,
                avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
                status: m.presence ? m.presence.status : 'offline',
                game: activity ? activity.name : null
            };
        });

        cachedAdmins = admins;
        lastFetchTime = now;
        res.json(admins);
    } catch (error) {
        console.error('Błąd /admins:', error);
        res.status(500).json({ error: "Błąd serwera" });
    }
});

// --- AKTUALIZACJA STATUSU ---
async function updateWebsiteStatus() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        const channel = guild.channels.cache.find(ch => ch.name === WEBSITE_CHANNEL_NAME);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🌐 Oficjalna Strona FC Drewno')
            .setURL('https://resdextoes.github.io/FC_Drewno/')
            .setAuthor({ name: 'FC Drewno', iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' })
            .setDescription('Strona jest stale aktualizowana.')
            .addFields(
                { name: 'Adres strony', value: '[resdextoes.github.io/FC_Drewno](https://resdextoes.github.io/FC_Drewno/)' },
                { name: 'Ostatnia auto-aktualizacja', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: 'Status bota', value: '🟢 Aktywny', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'System automatycznego odświeżania' });

        const messages = await channel.messages.fetch({ limit: 10 });
        const lastBotMessage = messages.find(m => m.author.id === client.user.id);

        if (lastBotMessage) await lastBotMessage.edit({ embeds: [embed] });
        else await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Status Update Error:', error.message);
    }
}

app.post('/website-update', async (req, res) => {
    await updateWebsiteStatus();
    res.status(200).json({ message: "OK" });
});

app.get('/', (req, res) => res.status(200).send('Żyje! chyba XDDDd'));

// --- INICJALIZACJA ---
client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log(`Bot online: ${client.user.tag}`);
        startSelfPing();
    } catch (error) {
        console.error('Rejestracja komend error:', error);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Serwer HTTP port: ${PORT}`));

client.login(process.env.DISCORD_TOKEN).then(() => {
    setTimeout(updateWebsiteStatus, 10000); // 10 sek po starcie
    setInterval(updateWebsiteStatus, 600000); // Co 10 minut (zamiast 5)
});
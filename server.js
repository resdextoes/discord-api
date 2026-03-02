import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, Options } from 'discord.js';
import express from 'express';
import cors from 'cors';
import https from 'https';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// --- KONFIGURACJA SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 10,
        PresenceManager: 50,
        ThreadManager: 0,
        ReactionManager: 0,
        GuildMemberManager: 100,
        UserManager: 100
    })
});

// --- KONFIGURACJA ID ---
const GUILD_ID = '1439591884287639694';
const ROLE_ID = '1439593337488150568';
const ANNOUNCEMENT_CHANNEL_ID = '1453854451961041164'; 
const LOG_CHANNEL_ID = '1457442534396530809'; 
const LOSOWANIE_CHANNEL_ID = '1457760176244265125';
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

function generateRandomString(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
}

// --- OBSŁUGA INTERAKCJI (SLASH COMMANDS) ---
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
        try {
            const randomLogin = generateRandomString(4);
            const randomPassword = generateRandomString(6);

            const { error } = await supabase
                .from('users')
                .insert([{ login: randomLogin, password: randomPassword }]);

            if (error) {
                console.error('Błąd Supabase:', error);
                return interaction.reply({ content: "❌ Błąd: Nie udało się zarezerwować loginu w bazie.", flags: [MessageFlags.Ephemeral] });
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎲 Wygenerowano nowe dane')
                .addFields(
                    { name: '👤 Login', value: `\`${randomLogin}\``, inline: true },
                    { name: '🔑 Hasło', value: `\`${randomPassword}\``, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Błąd /los slash:', err);
            await interaction.reply({ content: "Błąd podczas generowania danych.", flags: [MessageFlags.Ephemeral] });
        }
    }
});

// --- OBSŁUGA WIADOMOŚCI TEKSTOWYCH ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '/los' && message.channel.id === LOSOWANIE_CHANNEL_ID) {
        const randomLogin = generateRandomString(4);
        const randomPassword = generateRandomString(6);

        const { error } = await supabase
            .from('users')
            .insert([{ login: randomLogin, password: randomPassword }]);

        if (error) {
            console.error('Błąd zapisu tekstowego:', error);
            return message.reply("❌ Błąd bazy danych.");
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎲 Wygenerowano dane (Tekst)')
            .addFields(
                { name: '👤 Login', value: `\`${randomLogin}\``, inline: true },
                { name: '🔑 Hasło', value: `\`${randomPassword}\``, inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
});

// --- ENDPOINTY EXPRESS ---
app.post('/log-access', async (req, res) => {
    try {
        const { name, surname, page, ip } = req.body; 
        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return res.status(404).json({ error: "Kanał nie istnieje" });

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔓 Uzyskano dostęp')
            .addFields(
                { name: '👤 Osoba', value: `**${name} ${surname}**`, inline: true },
                { name: '📄 Widok', value: `\`${page}\``, inline: true },
                { name: '🌐 Adres IP', value: `\`${ip || 'Nie wykryto'}\``, inline: false }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        res.status(200).json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: "Błąd serwera" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('login', login)
            .eq('password', password)
            .single();

        if (error || !data) return res.status(401).json({ success: false, message: "Błąd logowania." });
        res.status(200).json({ success: true, user: data });
    } catch (err) {
        res.status(500).json({ error: "Błąd wewnętrzny" });
    }
});

app.get('/', (req, res) => res.status(200).send('Bot i Serwer żyją!'));

// --- START ---
client.once('ready', async () => {
    console.log(`✅ Zalogowano jako: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log('🚀 Komendy Slash zarejestrowane.');
    } catch (error) {
        console.error('Błąd rejestracji komend:', error);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 Serwer HTTP na porcie: ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ BŁĄD LOGOWANIA DO DISCORDA:', err);
});
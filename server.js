import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, Options } from 'discord.js';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// 1. SPRAWDZENIE KONFIGURACJI W LOGACH
console.log("--- STARTOWANIE BOTA ---");
console.log("URL bazy:", process.env.SUPABASE_URL ? "OK" : "BRAK!");
console.log("Klucz bazy:", process.env.SUPABASE_ANON_KEY ? "OK" : "BRAK!");

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const GUILD_ID = '1439591884287639694';

// Komendy
const commands = [
    new SlashCommandBuilder().setName('los').setDescription('Generuje login i hasło')
].map(command => command.toJSON());

// Generator
function generateRandomString(length) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) result += charset.charAt(Math.floor(Math.random() * charset.length));
    return result;
}

// 2. OBSŁUGA KOMENDY Z DEFER (NAPRAWA "NIE REAGUJE")
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'los') {
        try {
            // TO JEST KLUCZOWE: Mówimy Discordowi, że bot "myśli"
            await interaction.deferReply(); 
            console.log("Otrzymano komendę /los, generuję dane...");

            const randomLogin = generateRandomString(4);
            const randomPassword = generateRandomString(6);

            // Próba zapisu do Supabase
            const { error } = await supabase
                .from('users')
                .insert([{ login: randomLogin, password: randomPassword }]);

            if (error) {
                console.error("Błąd Supabase:", error.message);
                return await interaction.editReply(`❌ Błąd bazy: ${error.message}`);
            }

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎲 Nowe dane wygenerowane')
                .addFields(
                    { name: '👤 Login', value: `\`${randomLogin}\``, inline: true },
                    { name: '🔑 Hasło', value: `\`${randomPassword}\``, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
            console.log(`Pomyślnie wygenerowano dane dla: ${randomLogin}`);

        } catch (err) {
            console.error("KRYTYCZNY BŁĄD:", err);
            if (interaction.deferred) {
                await interaction.editReply("Wystąpił błąd krytyczny serwera.");
            }
        }
    }
});

client.once('ready', async () => {
    console.log(`✅ ZALOGOWANO JAKO: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log('🚀 Komendy zarejestrowane.');
    } catch (e) { console.error(e); }
});

app.get('/', (req, res) => res.send('Serwer działa.'));
app.listen(process.env.PORT || 10000, '0.0.0.0');

client.login(process.env.DISCORD_TOKEN).catch(err => console.error("Błąd logowania:", err));
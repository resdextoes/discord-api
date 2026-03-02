import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 10000;

// Logowanie startu
console.log("--- TESTOWA INICJALIZACJA ---");

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Endpoint dla Rendera (żeby usługa nie padła)
app.get('/', (req, res) => res.send('Serwer HTTP Działa. Czekam na Discorda...'));
app.listen(PORT, '0.0.0.0', () => console.log(`📡 Serwer Express na porcie ${PORT}`));

// FUNKCJA LOGOWANIA Z TIMEOUTEM
async function loginWithTimeout() {
    const token = process.env.DISCORD_TOKEN;
    
    if (!token) {
        console.error("❌ BŁĄD: Brak DISCORD_TOKEN w zmiennych środowiskowych!");
        return;
    }

    console.log("⏳ Próba logowania do Discorda (masz 15 sekund)...");

    const timeout = setTimeout(() => {
        console.error("⚠️ TIMEOUT: Discord nie odpowiedział w 15s. Prawdopodobnie IP Rendera jest zablokowane przez Discorda.");
        process.exit(1); // Restartujemy proces
    }, 15000);

    try {
        await client.login(token);
        clearTimeout(timeout);
        console.log(`✅ SUKCES! Zalogowano jako: ${client.user.tag}`);
    } catch (err) {
        clearTimeout(timeout);
        console.error("❌ BŁĄD DISCORDA:");
        console.error(err.message);
        if (err.message.includes('Used disallowed intents')) {
            console.error("👉 MUSISZ WŁĄCZYĆ INTENTS W DEVELOPER PORTAL!");
        }
    }
}

loginWithTimeout();

// Rejestracja komend (tylko jeśli się zaloguje)
client.once('ready', async () => {
    const commands = [new SlashCommandBuilder().setName('los').setDescription('Test generatora')].map(c => c.toJSON());
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, '1439591884287639694'), { body: commands });
        console.log('🚀 Komendy gotowe.');
    } catch (e) { console.error("Błąd komend:", e.message); }
});
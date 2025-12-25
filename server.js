import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import cors from 'cors';

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

// --- KONFIGURACJA ---
const GUILD_ID = '1439591884287639694';
const ROLE_ID = '1439593337488150568';
const ANNOUNCEMENT_CHANNEL_ID = '1453854451961041164';
// --------------------

client.once('ready', () => {
    console.log(`Bot online jako: ${client.user.tag}`);
});

app.get('/admins', async (req, res) => {
    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        const admins = members
            .filter(member => member.roles.cache.has(ROLE_ID))
            .map(member => ({
                id: member.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL({ extension: 'png', size: 128 }),
                status: member.presence ? member.presence.status : 'offline'
            }));
        res.json(admins);
    } catch (error) {
        console.error('Błąd /admins:', error.message);
        res.status(500).json({ error: 'Błąd pobierania adminów' });
    }
});

app.post('/github-webhook', async (req, res) => {
    try {
        const data = req.body;
        
        // Diagnostyka w logach Render
        console.log("--- SPRAWDZANIE DOSTĘPNYCH KANAŁÓW ---");
        client.channels.cache.forEach(ch => {
            if (ch.type === 0) console.log(`Dostępny kanał: #${ch.name} | ID: ${ch.id}`);
        });
        console.log("-------------------------------------");

        if (!data.commits) return res.status(200).send('Brak commitów');

        const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID).catch(() => null);

        if (!channel) {
            console.error(`BŁĄD: Bot nie widzi kanału o ID ${ANNOUNCEMENT_CHANNEL_ID}`);
            return res.status(404).send('Nie znaleziono kanału');
        }

        for (const commit of data.commits) {
            const message = `🛠️ **[${data.repository.name}]** Nowy commit!\n` +
                            `> **Autor:** ${commit.author.name}\n` +
                            `> **Wiadomość:** ${commit.message}\n` +
                            `> ${commit.url}`;
            await channel.send(message);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error("Błąd webhooka:", error.message);
        res.status(500).send('Błąd serwera');
    }
});

app.get('/', (req, res) => res.send('System bota działa poprawnie.'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer Express działa na porcie ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
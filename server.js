const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

const GUILD_ID = 'TWÓJ_ID_SERWERA';
const ROLE_ID = 'TWÓJ_ID_ROLI_ADMINA';

client.once('ready', () => {
    console.log(`Bot online: ${client.user.tag}`);
});

app.get('/admins', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch({ withPresences: true });
        
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
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/', (req, res) => {
    res.send('API is running');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);

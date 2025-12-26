import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
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

const GUILD_ID = '1439591884287639694';
const ROLE_ID = '1439593337488150568';
const ANNOUNCEMENT_CHANNEL_ID = '1453854451961041164'; 
const WEBSITE_CHANNEL_NAME = 'strona';

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
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
].map(command => command.toJSON());

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
        console.log(`Bot online: ${client.user.tag}`);
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 100) return interaction.reply({ content: '1-100', flags: [MessageFlags.Ephemeral] }).catch(() => {});
        
        let responded = false;
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => { responded = true; });
            const deleted = await interaction.channel.bulkDelete(amount, true).catch(err => {
                if (err.code === 10008) return new Map();
                throw err;
            });
            if (!responded) await interaction.editReply({ content: `Pomyślnie usunięto ${deleted.size} wiadomości.` }).catch(() => {});
        } catch (error) {
            if (!responded) await interaction.editReply({ content: 'Błąd usuwania.' }).catch(() => {});
        }
    }
});

app.get('/admins', async (req, res) => {
    try {
        const now = Date.now();
        if (cachedAdmins && (now - lastFetchTime < CACHE_DURATION)) return res.json(cachedAdmins);

        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        const admins = members.filter(m => m.roles.cache.has(ROLE_ID)).map(m => {
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
        res.status(500).json({ error: "Błąd pobierania danych" });
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

        const messages = await channel.messages.fetch({ limit: 20 });
        const lastBotMessage = messages.find(m => m.author.id === client.user.id);

        if (lastBotMessage) {
            await lastBotMessage.edit({ embeds: [embed] });
        } else {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error(error.message);
    }
}

app.post('/website-update', async (req, res) => {
    await updateWebsiteStatus();
    res.status(200).json({ message: "Zaktualizowano status strony." });
});

app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Port: ${PORT}`));

client.login(process.env.DISCORD_TOKEN).then(() => {
    setTimeout(updateWebsiteStatus, 5000);
    setInterval(updateWebsiteStatus, 300000); 
});
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

client.once('clientReady', async () => {
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
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: 'Podaj liczbę 1-100', flags: [MessageFlags.Ephemeral] });
        }
        
        try {
            const messages = await interaction.channel.bulkDelete(amount, true);
            return interaction.reply({ content: `Usunięto ${messages.size} wiadomości.`, flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.reply({ content: 'Błąd: Wiadomości starsze niż 14 dni?', flags: [MessageFlags.Ephemeral] });
            }
        }
    }
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
        res.status(500).json({ error: 'Error' });
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
                .setAuthor({ 
                    name: commit.author.name || 'GitHub User',
                    iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
                })
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

app.get('/', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Port: ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
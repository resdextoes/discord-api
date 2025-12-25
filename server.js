app.post('/website-update', async (req, res) => {
    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        const channel = guild.channels.cache.find(ch => ch.name === WEBSITE_CHANNEL_NAME);
        
        if (!channel) return res.status(404).json({ error: "Nie znaleziono kanału 'strona'" });

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🌐 Oficjalna Strona FC Drewno')
            .setURL('https://resdextoes.github.io/FC_Drewno/')
            .setAuthor({ name: 'FC Drewno', iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' })
            .setDescription('Strona jest stale aktualizowana. Kliknij w tytuł lub link poniżej, aby przejść do serwisu.')
            .addFields(
                { name: 'Adres strony', value: '[resdextoes.github.io/FC_Drewno](https://resdextoes.github.io/FC_Drewno/)' },
                { name: 'Ostatnia aktualizacja', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
                { name: 'Status', value: '🟢 Online', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Ostatnio odświeżono' });

        // Szukaj ostatniej wiadomości bota na tym kanale
        const messages = await channel.messages.fetch({ limit: 10 });
        const lastBotMessage = messages.find(m => m.author.id === client.user.id);

        if (lastBotMessage) {
            // Jeśli wiadomość już jest, edytuj ją
            await lastBotMessage.edit({ embeds: [embed] });
            res.status(200).json({ message: "Zaktualizowano istniejącą wiadomość" });
        } else {
            // Jeśli nie ma żadnej, wyślij nową
            await channel.send({ embeds: [embed] });
            res.status(200).json({ message: "Wysłano nową wiadomość" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
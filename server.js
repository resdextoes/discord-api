app.post('/github-webhook', async (req, res) => {
    try {
        const data = req.body;
        if (!data.commits) return res.status(200).send('OK');

        // DIAGNOSTYKA: Wypisuje wszystkie dostępne kanały w logach Render
        console.log("--- DIAGNOSTYKA KANAŁÓW ---");
        client.channels.cache.forEach(ch => console.log(`Widzę kanał: ${ch.name} (ID: ${ch.id})`));
        console.log("---------------------------");

        const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID).catch(() => null);

        if (!channel) {
            return res.status(404).send(`Nie znaleziono kanału o ID: ${ANNOUNCEMENT_CHANNEL_ID}`);
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
        console.error("Błąd:", error.message);
        res.status(500).send('Error');
    }
});
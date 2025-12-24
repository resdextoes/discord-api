import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// PODMIEŃ TYLKO ID SERWERA I ROLI
const GUILD_ID = "1439591884287639694";
const ADMIN_ROLE_ID = "1439593337488150568";

client.once("ready", () => {
  console.log(`Bot zalogowany jako ${client.user.tag}`);
});

app.get("/admins", async (req, res) => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const members = await guild.members.fetch();

    const admins = members
  .filter(m => m.roles.cache.has(ADMIN_ROLE_ID))
  .map(m => ({
    id: m.user.id, // To jest kluczowe!
    username: m.user.username,
    avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 })
  }));

    res.json(admins);
  } catch (error) {
    console.error("Błąd pobierania:", error);
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// TOKEN POBIERZEMY ZE ZMIENNYCH ŚRODOWISKOWYCH (DLA BEZPIECZEŃSTWA)
const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;

client.login(TOKEN);

app.listen(PORT, () => console.log(`Serwer działa na porcie ${PORT}`));

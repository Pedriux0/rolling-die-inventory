// Registers the slash commands with Discord for one server (guild).
// Guild commands update instantly; run this again whenever a command's
// name, description or options change. Usage: npm run deploy-commands
require('dotenv').config({ quiet: true });

const { REST, Routes } = require('discord.js');
const { commands } = require('../bot/commands');

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

async function main() {
  if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error('BOT_TOKEN, CLIENT_ID and GUILD_ID must be set in .env (see .env.example).');
  }

  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST().setToken(BOT_TOKEN);

  // PUT replaces the server's whole command list with this one
  const saved = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
  console.log(`Registered ${saved.length} commands: ${saved.map((c) => '/' + c.name).join(', ')}`);
}

main().catch((err) => {
  console.error('deploy-commands failed:', err.message);
  process.exitCode = 1;
});

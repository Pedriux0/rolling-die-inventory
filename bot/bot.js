// Creates the Discord client and routes slash commands to bot/commands.js.
// onActivity(activity) is called after every reply; app.js decides what to
// do with it (Milestone 7: save to bot_activity and push to the dashboard).
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { runCommand } = require('./commands');

// Never let a reply ping @everyone, @here, users or roles,
// even if someone searches for "@everyone".
const NO_PINGS = { parse: [] };

async function handleInteraction(interaction, onActivity) {
  if (!interaction.isChatInputCommand()) return;

  const term = interaction.options.getString('title', true).trim();
  let outcome;

  try {
    outcome = await runCommand(interaction.commandName, term);
  } catch (err) {
    console.error(`/${interaction.commandName} failed:`, err);
    outcome = { result: 'error', content: 'Sorry, something went wrong looking that up. Please try again.' };
  }

  try {
    await interaction.reply({ content: outcome.content, allowedMentions: NO_PINGS });
  } catch (err) {
    console.error('Could not send reply:', err);
    outcome.result = 'error';
  }

  await onActivity({
    command: interaction.commandName,
    args: term,
    result: outcome.result,
    discordUser: interaction.user.username
  });
}

// Logs the bot in. Returns the client so app.js could shut it down later.
function startBot({ token, onActivity }) {
  // Guilds is the only intent slash commands need (no message reading)
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (ready) => {
    console.log(`Discord bot logged in as ${ready.user.tag}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    handleInteraction(interaction, onActivity).catch((err) => {
      console.error('Interaction handler crashed:', err);
    });
  });

  client.login(token).catch((err) => {
    console.error('Discord login failed (check BOT_TOKEN in .env):', err.message);
  });

  return client;
}

module.exports = { startBot, handleInteraction };

// Creates the Discord client and routes slash commands to bot/commands.js.
// onActivity(activity) is called after every command reply; app.js saves
// it to bot_activity and pushes it to the dashboard.
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { runCommand, titleSuggestions } = require('./commands');

// Never let a reply ping @everyone, @here, users or roles,
// even if someone searches for "@everyone".
const NO_PINGS = { parse: [] };

// Suggestions while the user types a title. Fired on every keystroke, so
// it is deliberately NOT logged or sent to the dashboard.
async function handleAutocomplete(interaction) {
  try {
    const typed = interaction.options.getFocused();
    await interaction.respond(await titleSuggestions(typed));
  } catch (err) {
    console.error('Autocomplete failed:', err.message);
    await interaction.respond([]).catch(() => {}); // may already have expired
  }
}

// "title: catan, players: 4" — used for the log if a command crashes
function describeOptions(interaction) {
  return interaction.options.data.map((o) => `${o.name}: ${o.value}`).join(', ');
}

async function handleInteraction(interaction, onActivity) {
  if (interaction.isAutocomplete()) return handleAutocomplete(interaction);
  if (!interaction.isChatInputCommand()) return;

  let outcome;

  try {
    outcome = await runCommand(interaction.commandName, interaction.options);
  } catch (err) {
    console.error(`/${interaction.commandName} failed:`, err);
    outcome = {
      args: describeOptions(interaction),
      result: 'error',
      content: 'Sorry, something went wrong looking that up. Please try again.'
    };
  }

  try {
    await interaction.reply({ content: outcome.content, allowedMentions: NO_PINGS });
  } catch (err) {
    console.error('Could not send reply:', err);
    outcome.result = 'error';
  }

  await onActivity({
    command: interaction.commandName,
    args: outcome.args,
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

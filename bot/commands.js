// Slash command definitions and their handlers.
// Every handler queries SQLite at the moment of the command (no caching),
// so edits made on the website show up in the very next reply.
const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const gameModel = require('../models/gameModel');
const { toGameView } = require('../helpers/gameView');

const MAX_TITLE_LENGTH = 100;

// /stock, /price and /game take the same required "title" option.
// Autocomplete makes Discord ask suggestTitles() while the user types.
function titleCommand(name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Game title, or part of it')
        .setRequired(true)
        .setMaxLength(MAX_TITLE_LENGTH)
        .setAutocomplete(true)
    );
}

const findCommand = new SlashCommandBuilder()
  .setName('find')
  .setDescription('In-stock games for a number of players, optionally under a price')
  .addIntegerOption((option) =>
    option.setName('players').setDescription('How many people will play').setRequired(true).setMinValue(1).setMaxValue(99)
  )
  .addNumberOption((option) =>
    option.setName('max_price').setDescription('Highest price in dollars').setMinValue(0)
  );

// Titles and user input are escaped so * _ ~ | ` cannot break formatting
function bold(text) {
  return `**${escapeMarkdown(text)}**`;
}

function copies(n) {
  return n === 1 ? '1 copy' : `${n} copies`;
}

// ---------- What each command says about one game ----------

function stockAnswer(game) {
  return game.stock > 0
    ? `${bold(game.title)} is in stock: ${copies(game.stock)}.`
    : `${bold(game.title)} is out of stock right now.`;
}

function priceAnswer(game) {
  return `${bold(game.title)} costs ${toGameView(game).price}.`;
}

function gameAnswer(game) {
  const view = toGameView(game);
  const stock = game.stock > 0 ? `In stock (${copies(game.stock)})` : 'Out of stock';
  const lines = [
    `${bold(game.title)} · ${escapeMarkdown(view.category)}`,
    `Players: ${view.players} · Play time: ${view.playTime}`,
    `Price: ${view.price} · ${stock}`
  ];
  if (game.description) lines.push(`> ${escapeMarkdown(game.description)}`);
  return lines.join('\n');
}

// ---------- Shared lookup: found / several matches / not found ----------

// Returns { result, content }. result is what the dashboard will log:
// 'found' | 'list' | 'not_found'.
async function lookup(term, answer) {
  const matches = await gameModel.findByTitle(term);

  if (matches.length === 1) {
    return { result: 'found', content: answer(matches[0]) };
  }

  if (matches.length > 1) {
    const list = matches.map((game) => `• ${escapeMarkdown(game.title)}`).join('\n');
    return {
      result: 'list',
      content: `Several games match ${bold(term)}:\n${list}\nTry again with the full title.`
    };
  }

  return {
    result: 'not_found',
    content: `Sorry, we don't carry a game matching ${bold(term)}. Ask at the counter and we can look into ordering it!`
  };
}

// /stock, /price, /game: the logged args are just the title searched for
async function runTitleCommand(options, answer) {
  const term = options.getString('title', true).trim();
  return { args: term, ...(await lookup(term, answer)) };
}

// ---------- /find ----------

function findLine(game) {
  const view = toGameView(game);
  return `• ${escapeMarkdown(game.title)} (${view.players} players, ${view.playTime}, ${view.price})`;
}

async function runFind(options) {
  const players = options.getInteger('players', true);
  const maxPrice = options.getNumber('max_price'); // null when left out
  const priceText = maxPrice === null ? '' : ` up to ${toGameView({ price: maxPrice }).price}`;
  const args = `${players} ${players === 1 ? 'player' : 'players'}${priceText}`;

  const games = await gameModel.findForPlayers(players, maxPrice);
  if (games.length === 0) {
    return {
      args,
      result: 'not_found',
      content: `Sorry, no games in stock right now for ${args}.`
    };
  }

  return {
    args,
    result: games.length === 1 ? 'found' : 'list',
    content: `In stock for ${args}:\n${games.map(findLine).join('\n')}`
  };
}

const commands = [
  {
    data: titleCommand('stock', 'Is a game in stock, and how many copies?'),
    run: (options) => runTitleCommand(options, stockAnswer)
  },
  {
    data: titleCommand('price', 'How much does a game cost?'),
    run: (options) => runTitleCommand(options, priceAnswer)
  },
  {
    data: titleCommand('game', 'Full details: players, play time, category, price and stock'),
    run: (options) => runTitleCommand(options, gameAnswer)
  },
  { data: findCommand, run: runFind }
];

// Runs a command by name with its Discord options.
// Returns { args, result, content }: args and result go to the dashboard.
async function runCommand(name, options) {
  const command = commands.find((c) => c.data.name === name);
  if (!command) return { args: '', result: 'error', content: 'Sorry, I don\'t know that command.' };
  return command.run(options);
}

// Autocomplete choices for the title option (Discord allows 25 at most).
async function titleSuggestions(typed) {
  const titles = await gameModel.suggestTitles(typed.trim(), 25);
  return titles.map((title) => ({ name: title, value: title }));
}

module.exports = { commands, runCommand, titleSuggestions };

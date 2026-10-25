// Slash command definitions and their handlers.
// Every handler queries SQLite at the moment of the command (no caching),
// so edits made on the website show up in the very next reply.
const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const gameModel = require('../models/gameModel');
const { toGameView } = require('../helpers/gameView');

const MAX_TITLE_LENGTH = 100;

// Every command takes the same required "title" option
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
    );
}

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

const commands = [
  { data: titleCommand('stock', 'Is a game in stock, and how many copies?'), answer: stockAnswer },
  { data: titleCommand('price', 'How much does a game cost?'), answer: priceAnswer },
  { data: titleCommand('game', 'Full details: players, play time, category, price and stock'), answer: gameAnswer }
];

// Runs a command by name. Returns { result, content } for the reply.
async function runCommand(name, term) {
  const command = commands.find((c) => c.data.name === name);
  if (!command) return { result: 'error', content: 'Sorry, I don\'t know that command.' };
  return lookup(term, command.answer);
}

module.exports = { commands, runCommand };

// SQL for the bot activity log shown on the manager dashboard.
const db = require('../config/db');

const COLUMNS = 'id, command, args, result, discord_user, created_at';

// Saves one bot command and resolves with the stored row
// (including the id and created_at that SQLite filled in).
async function create({ command, args, result, discordUser }) {
  const { lastID } = await db.run(
    'INSERT INTO bot_activity (command, args, result, discord_user) VALUES (?, ?, ?, ?)',
    [command, args, result, discordUser]
  );
  return db.get(`SELECT ${COLUMNS} FROM bot_activity WHERE id = ?`, [lastID]);
}

// The most recent rows, newest first.
async function recent(limit = 25) {
  return db.all(`SELECT ${COLUMNS} FROM bot_activity ORDER BY id DESC LIMIT ?`, [limit]);
}

module.exports = { create, recent };

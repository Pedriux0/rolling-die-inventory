// SQL for manager accounts. Only password hashes are stored, never passwords.
const db = require('../config/db');

async function findByUsername(username) {
  return db.get(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username]
  );
}

async function create(username, passwordHash) {
  const result = await db.run(
    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
    [username, passwordHash]
  );
  return result.lastID;
}

module.exports = { findByUsername, create };

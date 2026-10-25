// Creates the tables and seeds the game inventory.
// Safe to run more than once: tables are only created if missing, and
// games whose title already exists are skipped (existing edits are kept).
const db = require('../config/db');

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS games (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    title             TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category          TEXT,
    min_players       INTEGER CHECK (min_players >= 1),
    max_players       INTEGER CHECK (max_players >= min_players),
    play_time_minutes INTEGER CHECK (play_time_minutes > 0),
    price             REAL NOT NULL CHECK (price >= 0),
    stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    description       TEXT,
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bot_activity (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    command      TEXT NOT NULL,
    args         TEXT,
    result       TEXT NOT NULL CHECK (result IN ('found', 'not_found', 'list', 'error')),
    discord_user TEXT,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
];

// [title, category, min, max, minutes, price, stock, description]
const GAMES = [
  ['Catan', 'Strategy', 3, 4, 90, 59.99, 6, 'Trade, build and settle the island of Catan.'],
  ['Wingspan', 'Strategy', 1, 5, 70, 79.99, 3, 'Attract birds to your wildlife preserves in this engine-building game.'],
  ['Ticket to Ride', 'Family', 2, 5, 60, 64.99, 4, 'Collect train cards and claim railway routes across North America.'],
  ['Carcassonne', 'Family', 2, 5, 45, 44.99, 5, 'Place tiles to build a medieval landscape of cities, roads and fields.'],
  ['Pandemic', 'Cooperative', 2, 4, 45, 49.99, 2, 'Work together to stop four diseases from spreading across the world.'],
  ['Azul', 'Abstract', 2, 4, 45, 49.99, 0, 'Draft colourful tiles to decorate the walls of a royal palace.'],
  ['Codenames', 'Party', 2, 8, 15, 24.99, 8, 'Give one-word clues so your team can find its secret agents.'],
  ['7 Wonders', 'Strategy', 3, 7, 30, 64.99, 2, 'Draft cards to grow an ancient civilization and build a wonder.'],
  ['Splendor', 'Strategy', 2, 4, 30, 44.99, 3, 'Collect gems and buy developments as a Renaissance merchant.'],
  ['Dixit', 'Party', 3, 8, 30, 44.99, 0, 'Tell stories about dreamlike pictures and guess each other\'s cards.'],
  ['King of Tokyo', 'Family', 2, 6, 30, 44.99, 4, 'Roll dice as giant monsters fighting to rule Tokyo.'],
  ['Terraforming Mars', 'Strategy', 1, 5, 120, 79.99, 1, 'Lead a corporation making Mars habitable for humanity.'],
  ['Exploding Kittens', 'Card Game', 2, 5, 15, 24.99, 10, 'A card game of luck and strategy, and avoiding exploding kittens.'],
  ['Sushi Go!', 'Card Game', 2, 5, 15, 14.99, 7, 'Pass hands of cards to build the best plate of sushi.'],
  ['The Crew: The Quest for Planet Nine', 'Cooperative', 2, 5, 20, 19.99, 5, 'A cooperative trick-taking game set on a space mission.']
];

const INSERT_GAME = `
  INSERT INTO games
    (title, category, min_players, max_players, play_time_minutes, price, stock, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(title) DO NOTHING`;

async function main() {
  for (const sql of SCHEMA) {
    await db.run(sql);
  }

  let added = 0;
  for (const game of GAMES) {
    const result = await db.run(INSERT_GAME, game);
    added += result.changes;
  }

  const { count } = await db.get('SELECT COUNT(*) AS count FROM games');
  console.log(`Database ready at ${db.DB_FILE}`);
  console.log(`Seeded ${added} new game(s); ${count} game(s) in total.`);
}

main()
  .catch((err) => {
    console.error('init-db failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());

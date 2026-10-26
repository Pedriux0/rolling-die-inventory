// All SQL for the games table. Values always travel as ? placeholders,
// never concatenated into the SQL string.
const db = require('../config/db');

const COLUMNS = `id, title, category, min_players, max_players,
  play_time_minutes, price, stock, description, updated_at`;

// Turns a search term into a LIKE pattern. % and _ are LIKE wildcards,
// so they are escaped with a backslash to be matched literally
// (searching "100%" should not match every title).
function likePattern(term) {
  return '%' + term.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%';
}

// Games for the public list, optionally narrowed by title search and
// category. Only fixed SQL fragments are joined; user values go in params.
async function findAll({ search = '', category = '' } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("title LIKE ? ESCAPE '\\'");
    params.push(likePattern(search));
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return db.all(
    `SELECT ${COLUMNS} FROM games ${where} ORDER BY title COLLATE NOCASE`,
    params
  );
}

// Every category with how many games in it match the search.
// SUM(condition) counts matching rows, so a category with no matches
// still appears with 0 instead of disappearing from the filter.
async function countByCategory(search = '') {
  return db.all(
    `SELECT category, SUM(title LIKE ? ESCAPE '\\') AS count
     FROM games
     GROUP BY category
     ORDER BY category COLLATE NOCASE`,
    [likePattern(search)]
  );
}

// Bot lookup, run fresh on every command (no caching):
// 1. exact title (case-insensitive because the column is COLLATE NOCASE)
// 2. otherwise every title containing the term, up to `limit` rows.
async function findByTitle(term, limit = 10) {
  const exact = await db.get(`SELECT ${COLUMNS} FROM games WHERE title = ?`, [term]);
  if (exact) return [exact];

  return db.all(
    `SELECT ${COLUMNS} FROM games
     WHERE title LIKE ? ESCAPE '\\'
     ORDER BY title COLLATE NOCASE
     LIMIT ?`,
    [likePattern(term), limit]
  );
}

// /find: in-stock games that support `players`, optionally at or under
// maxPrice. The optional filter adds one fixed SQL fragment; the value
// still goes in as a placeholder.
async function findForPlayers(players, maxPrice = null, limit = 20) {
  const params = [players, players];
  let priceFilter = '';
  if (maxPrice !== null) {
    priceFilter = 'AND price <= ?';
    params.push(maxPrice);
  }
  params.push(limit);

  return db.all(
    `SELECT ${COLUMNS} FROM games
     WHERE stock > 0 AND min_players <= ? AND max_players >= ? ${priceFilter}
     ORDER BY title COLLATE NOCASE
     LIMIT ?`,
    params
  );
}

// Autocomplete: titles containing the typed text, those that start with
// it listed first. An empty term matches every title.
async function suggestTitles(term, limit = 25) {
  const prefix = term.replace(/[\\%_]/g, (ch) => '\\' + ch) + '%';
  const rows = await db.all(
    `SELECT title FROM games
     WHERE title LIKE ? ESCAPE '\\'
     ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, title COLLATE NOCASE
     LIMIT ?`,
    [likePattern(term), prefix, limit]
  );
  return rows.map((row) => row.title);
}

async function findById(id) {
  return db.get(`SELECT ${COLUMNS} FROM games WHERE id = ?`, [id]);
}

// Values in the same order as the columns in INSERT and UPDATE below
function gameParams(game) {
  return [
    game.title, game.category, game.min_players, game.max_players,
    game.play_time_minutes, game.price, game.stock, game.description
  ];
}

async function create(game) {
  const result = await db.run(
    `INSERT INTO games
       (title, category, min_players, max_players, play_time_minutes, price, stock, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    gameParams(game)
  );
  return result.lastID;
}

// Resolves with the number of rows changed (0 if the id does not exist)
async function update(id, game) {
  const result = await db.run(
    `UPDATE games
     SET title = ?, category = ?, min_players = ?, max_players = ?,
         play_time_minutes = ?, price = ?, stock = ?, description = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [...gameParams(game), id]
  );
  return result.changes;
}

async function remove(id) {
  const result = await db.run('DELETE FROM games WHERE id = ?', [id]);
  return result.changes;
}

// True when an INSERT/UPDATE failed because the title is already taken
// (the UNIQUE rule on games.title is the final guard against duplicates).
function isDuplicateTitle(err) {
  return err.code === 'SQLITE_CONSTRAINT' && err.message.includes('games.title');
}

module.exports = {
  findAll, countByCategory, findByTitle, findForPlayers, suggestTitles,
  findById, create, update, remove, isDuplicateTitle
};

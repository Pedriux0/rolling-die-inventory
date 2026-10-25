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
  findAll, countByCategory, findById, create, update, remove, isDuplicateTitle
};

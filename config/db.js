// One shared SQLite connection for the whole app (web, bot and scripts).
// sqlite3 is callback-based, so run/get/all are wrapped in Promises
// to let models use async/await.
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_FILE = path.join(__dirname, '..', 'rolling-die.db');
const db = new sqlite3.Database(DB_FILE);

// INSERT / UPDATE / DELETE. Resolves with { lastID, changes }.
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    // A regular function (not an arrow) so sqlite3 can set `this`
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// SELECT a single row. Resolves with the row, or undefined if none.
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

// SELECT many rows. Resolves with an array (empty if none).
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { run, get, all, close, DB_FILE };

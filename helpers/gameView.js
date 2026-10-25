// Turns a games row into ready-to-print values for the Mustache views.
// Mustache is logic-less, so every decision (in stock? which label?)
// is made here. Shared by the public page and the manager list.

const PIP_COUNT = 8; // the players column draws seats 1-8

// Formats 1234.5 as "$1,234.50"
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

function playersLabel(min, max) {
  if (!min || !max) return '—';
  return min === max ? `${min}` : `${min}–${max}`;
}

// One dot per seat, filled for the player counts the game supports.
function playerPips(min, max) {
  if (!min || !max) return [];
  return Array.from({ length: PIP_COUNT }, (_, i) => ({ on: i + 1 >= min && i + 1 <= max }));
}

function toGameView(game) {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    category: game.category || '—',
    players: playersLabel(game.min_players, game.max_players),
    pips: playerPips(game.min_players, game.max_players),
    playTime: game.play_time_minutes ? `${game.play_time_minutes} min` : '—',
    price: money.format(game.price),
    stock: game.stock,
    inStock: game.stock > 0
  };
}

module.exports = { toGameView };

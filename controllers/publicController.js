// Public, read-only inventory page. No login, no edit controls.
const gameModel = require('../models/gameModel');
const { toGameView } = require('../helpers/gameView');

const MAX_QUERY_LENGTH = 100;

// Query values can arrive as arrays (?q=a&q=b) or be very long,
// so accept only a trimmed, length-limited string.
function cleanQuery(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_QUERY_LENGTH) : '';
}

// Builds a /games link that keeps the current search and category.
function gamesLink(search, category) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (category) params.set('category', category);
  const query = params.toString();
  return query ? `/games?${query}` : '/games';
}

function categoryCards(counts, search, selected) {
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const cards = [{ label: 'All games', count: total, href: gamesLink(search, ''), selected: !selected }];

  for (const row of counts) {
    if (!row.category) continue;
    cards.push({
      label: row.category,
      count: row.count,
      href: gamesLink(search, row.category),
      selected: row.category === selected
    });
  }
  return cards;
}

// The line under the title, counted from the rows actually shown.
function summaryLine(games) {
  const inStock = games.filter((g) => g.inStock).length;
  const noun = games.length === 1 ? 'game' : 'games';
  return `${games.length} ${noun} · ${inStock} in stock, ${games.length - inStock} out of stock`;
}

async function listGames(req, res) {
  const search = cleanQuery(req.query.q);
  const category = cleanQuery(req.query.category);

  try {
    const [rows, counts] = await Promise.all([
      gameModel.findAll({ search, category }),
      gameModel.countByCategory(search)
    ]);
    const games = rows.map(toGameView);

    res.render('games', {
      title: 'Games — The Rolling Die',
      search,
      category,
      games,
      summary: summaryLine(games),
      categories: categoryCards(counts, search, category),
      clearSearchHref: gamesLink('', category)
    });
  } catch (err) {
    console.error('Could not load games:', err);
    res.status(500).render('games', {
      title: 'Games — The Rolling Die',
      search,
      category,
      error: true
    });
  }
}

module.exports = { listGames };

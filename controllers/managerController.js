// Manager area (behind requireLogin): list, add, edit and delete games,
// and the live bot activity dashboard.
const gameModel = require('../models/gameModel');
const activityModel = require('../models/activityModel');
const { toGameView } = require('../helpers/gameView');
const { toActivityView } = require('../helpers/activityView');

const DASHBOARD_ROWS = 25;

const FIELDS = [
  'title', 'category', 'min_players', 'max_players',
  'play_time_minutes', 'price', 'stock', 'description'
];

// ---------- Form reading and validation ----------

// Only the expected fields, as trimmed strings (anything else is ignored).
function readForm(body) {
  const form = {};
  for (const name of FIELDS) {
    form[name] = typeof body[name] === 'string' ? body[name].trim() : '';
  }
  return form;
}

// Returns the number if value is a whole number within [min, max], else null.
function wholeNumber(value, min, max) {
  if (!/^\d{1,6}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

// Returns a list of error messages; an empty list means the form is valid.
function validateGame(form) {
  const errors = [];

  if (!form.title) errors.push('Title is required.');
  if (form.title.length > 100) errors.push('Title must be 100 characters or fewer.');
  if (form.category.length > 40) errors.push('Category must be 40 characters or fewer.');
  if (form.description.length > 500) errors.push('Description must be 500 characters or fewer.');

  const min = wholeNumber(form.min_players, 1, 99);
  const max = wholeNumber(form.max_players, 1, 99);
  if (min === null) errors.push('Minimum players must be a whole number from 1 to 99.');
  if (max === null) errors.push('Maximum players must be a whole number from 1 to 99.');
  if (min !== null && max !== null && min > max) {
    errors.push('Minimum players cannot be more than maximum players.');
  }

  if (wholeNumber(form.play_time_minutes, 1, 1440) === null) {
    errors.push('Play time must be a whole number of minutes from 1 to 1440.');
  }
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(form.price)) {
    errors.push('Price must be 0 or more, with at most 2 decimals (for example 49.99).');
  }
  if (wholeNumber(form.stock, 0, 99999) === null) {
    errors.push('Stock must be a whole number of 0 or more.');
  }

  return errors;
}

// Converts a validated form into the values stored in the database.
function toGame(form) {
  return {
    title: form.title,
    category: form.category || null,
    min_players: Number(form.min_players),
    max_players: Number(form.max_players),
    play_time_minutes: Number(form.play_time_minutes),
    price: Number(form.price),
    stock: Number(form.stock),
    description: form.description || null
  };
}

// ---------- Rendering helpers ----------

async function renderForm(res, { id, form, errors = [] }) {
  const counts = await gameModel.countByCategory();
  res.render('game-form', {
    title: id ? `Edit ${form.title || 'game'} — The Rolling Die` : 'Add game — The Rolling Die',
    heading: id ? 'Edit game' : 'Add game',
    action: id ? `/manager/games/${id}` : '/manager/games',
    submitLabel: id ? 'Save changes' : 'Add game',
    form,
    errors,
    hasErrors: errors.length > 0,
    categories: counts.filter((row) => row.category).map((row) => row.category)
  });
}

// Shows a one-time message on the next page, then forgets it.
function setFlash(req, message) {
  req.session.flash = message;
}

function takeFlash(req) {
  const message = req.session.flash;
  delete req.session.flash;
  return message;
}

// ---------- Route handlers ----------

async function list(req, res, next) {
  try {
    const games = (await gameModel.findAll()).map(toGameView);
    res.render('manager', {
      title: 'Manager — The Rolling Die',
      games,
      gameCount: games.length,
      flash: takeFlash(req)
    });
  } catch (err) {
    next(err);
  }
}

async function newForm(req, res, next) {
  try {
    await renderForm(res, { form: readForm({}) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  const form = readForm(req.body);
  const errors = validateGame(form);

  try {
    if (errors.length === 0) {
      await gameModel.create(toGame(form));
      setFlash(req, `Added "${form.title}".`);
      return res.redirect('/manager');
    }
  } catch (err) {
    if (!gameModel.isDuplicateTitle(err)) return next(err);
    errors.push(`A game called "${form.title}" already exists.`);
  }

  try {
    res.status(400);
    await renderForm(res, { form, errors });
  } catch (err) {
    next(err);
  }
}

async function editForm(req, res, next) {
  try {
    const game = await gameModel.findById(req.params.id);
    if (!game) return next(); // falls through to the 404 page

    // Pre-fill the form with the stored values, as strings like a real post
    const form = {};
    for (const name of FIELDS) form[name] = game[name] === null ? '' : String(game[name]);
    await renderForm(res, { id: game.id, form });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  const id = req.params.id;
  const form = readForm(req.body);
  const errors = validateGame(form);

  try {
    if (errors.length === 0) {
      const changed = await gameModel.update(id, toGame(form));
      if (changed === 0) return next(); // the game was deleted meanwhile
      setFlash(req, `Saved "${form.title}".`);
      return res.redirect('/manager');
    }
  } catch (err) {
    if (!gameModel.isDuplicateTitle(err)) return next(err);
    errors.push(`Another game is already called "${form.title}".`);
  }

  try {
    res.status(400);
    await renderForm(res, { id, form, errors });
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const game = await gameModel.findById(req.params.id);
    if (!game) return next();

    await gameModel.remove(game.id);
    setFlash(req, `Deleted "${game.title}".`);
    res.redirect('/manager');
  } catch (err) {
    next(err);
  }
}

// Live dashboard: the latest rows from the database now; new ones are
// pushed over socket.io by public/js/dashboard.js.
async function dashboard(req, res, next) {
  try {
    const activity = (await activityModel.recent(DASHBOARD_ROWS)).map(toActivityView);
    res.render('dashboard', {
      title: 'Bot activity — The Rolling Die',
      activity,
      maxRows: DASHBOARD_ROWS,
      notFoundCount: activity.filter((a) => a.notFound).length
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, newForm, create, editForm, update, destroy, dashboard };

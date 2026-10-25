// Entry point: wires Express, views, sessions and (in later milestones)
// socket.io and the Discord bot together in one process.
require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const mustacheExpress = require('mustache-express');
const { sessionMiddleware } = require('./config/session');
const requireLogin = require('./middleware/requireLogin');
const publicController = require('./controllers/publicController');
const authController = require('./controllers/authController');
const managerController = require('./controllers/managerController');
const { startBot } = require('./bot/bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Mustache views; partials (header/footer) live in views/partials
app.engine('mustache', mustacheExpress(path.join(__dirname, 'views', 'partials'), '.mustache'));
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false })); // parses HTML form posts
app.use(sessionMiddleware);

// Lets every view know who is logged in (used by the header)
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  next();
});

// Public, read-only inventory (no login needed)
app.get(['/', '/games'], publicController.listGames);

// Login / logout
app.get('/login', authController.showLogin);
app.post('/login', authController.login);
app.post('/logout', authController.logout);

// Manager area: everything under /manager requires a logged-in user
// (mutations are POST only; :id(\\d+) only matches numeric ids)
app.use('/manager', requireLogin);
app.get('/manager', managerController.list);
app.get('/manager/games/new', managerController.newForm);
app.post('/manager/games', managerController.create);
app.get('/manager/games/:id(\\d+)/edit', managerController.editForm);
app.post('/manager/games/:id(\\d+)', managerController.update);
app.post('/manager/games/:id(\\d+)/delete', managerController.destroy);

// No route matched (or a controller called next() for a missing game)
app.use((req, res) => {
  res.status(404).render('not-found', { title: 'Not found — The Rolling Die' });
});

// Last resort: log the error, show a generic message (no stack trace)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again.');
});

app.listen(PORT, () => {
  console.log(`The Rolling Die running at http://localhost:${PORT}`);
});

// Discord bot in the same process. Without a token the website still runs.
// (Milestone 7 replaces the console log with saving + live dashboard push.)
if (process.env.BOT_TOKEN) {
  startBot({
    token: process.env.BOT_TOKEN,
    onActivity: async (activity) => console.log('Bot activity:', activity)
  });
} else {
  console.warn('BOT_TOKEN not set: Discord bot not started.');
}

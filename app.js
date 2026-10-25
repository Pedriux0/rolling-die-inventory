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
app.use('/manager', requireLogin);
app.get('/manager', managerController.index);

// Last resort: log the error, show a generic message (no stack trace)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again.');
});

app.listen(PORT, () => {
  console.log(`The Rolling Die running at http://localhost:${PORT}`);
});

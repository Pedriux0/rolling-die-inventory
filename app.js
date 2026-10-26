// Entry point: wires Express, views, sessions, socket.io and the Discord
// bot together in one process, so the bot and the dashboard share one `io`.
require('dotenv').config({ quiet: true });

const path = require('path');
const http = require('http');
const express = require('express');
const mustacheExpress = require('mustache-express');
const { Server } = require('socket.io');
const { sessionMiddleware } = require('./config/session');
const requireLogin = require('./middleware/requireLogin');
const publicController = require('./controllers/publicController');
const authController = require('./controllers/authController');
const managerController = require('./controllers/managerController');
const activityModel = require('./models/activityModel');
const { toActivityView } = require('./helpers/activityView');
const { startBot } = require('./bot/bot');

const app = express();
const server = http.createServer(app); // shared by Express and socket.io
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Mustache views; partials (header/footer) live in views/partials
app.engine('mustache', mustacheExpress(path.join(__dirname, 'views', 'partials'), '.mustache'));
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));
app.set('io', io); // lets logout disconnect that session's sockets

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
app.get('/manager/dashboard', managerController.dashboard);
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

// ---------- socket.io: live dashboard, managers only ----------

// Same session as the website, so a socket knows who is logged in
io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
  const { session } = socket.request;
  if (!session || !session.user) {
    socket.disconnect(true); // logged out: no events, ever
    return;
  }
  socket.join('managers');
  socket.join(`session:${session.id}`); // so logout can close this socket
});

// Called by the bot after every reply: save it, then push it live.
async function recordActivity(activity) {
  try {
    const row = await activityModel.create(activity);
    io.to('managers').emit('botactivity', toActivityView(row));
  } catch (err) {
    console.error('Could not record bot activity:', err);
  }
}

server.listen(PORT, () => {
  console.log(`The Rolling Die running at http://localhost:${PORT}`);
});

// Discord bot in the same process. Without a token the website still runs.
if (process.env.BOT_TOKEN) {
  startBot({ token: process.env.BOT_TOKEN, onActivity: recordActivity });
} else {
  console.warn('BOT_TOKEN not set: Discord bot not started.');
}

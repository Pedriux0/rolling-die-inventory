// Entry point: wires Express, views and (in later milestones) sessions,
// socket.io and the Discord bot together in one process.
require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const mustacheExpress = require('mustache-express');

const app = express();
const PORT = process.env.PORT || 3000;

// Mustache views; partials (header/footer) live in views/partials
app.engine('mustache', mustacheExpress(path.join(__dirname, 'views', 'partials'), '.mustache'));
app.set('view engine', 'mustache');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

// Placeholder route, replaced by the public inventory page in Milestone 3
app.get('/', (req, res) => {
  res.render('home', { title: 'The Rolling Die' });
});

app.listen(PORT, () => {
  console.log(`The Rolling Die running at http://localhost:${PORT}`);
});

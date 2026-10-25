// Manager login and logout.
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const { COOKIE_NAME } = require('../config/session');

const LOGIN_ERROR = 'Invalid username or password.';

// Compared against when the username does not exist, so a wrong username
// takes as long as a wrong password and response time reveals nothing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

function renderLogin(res, { username = '', error = '' } = {}) {
  res.render('login', { title: 'Manager login — The Rolling Die', username, error });
}

function showLogin(req, res) {
  if (req.session.user) return res.redirect('/manager');
  renderLogin(res);
}

async function login(req, res, next) {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  try {
    const user = username ? await userModel.findByUsername(username) : undefined;
    const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordOk) {
      res.status(401);
      return renderLogin(res, { username, error: LOGIN_ERROR });
    }

    // New session ID on login, so an ID planted before login is useless
    // (prevents session fixation).
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = { id: user.id, username: user.username };
      req.session.save((saveErr) => (saveErr ? next(saveErr) : res.redirect('/manager')));
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(COOKIE_NAME);
    res.redirect('/');
  });
}

module.exports = { showLogin, login, logout };

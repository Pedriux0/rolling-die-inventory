// Session middleware, in its own module so Express now and socket.io
// later (Milestone 7) share exactly the same sessions.
const session = require('express-session');

const COOKIE_NAME = 'rollingdie.sid';
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

// Refuse to start with a missing or placeholder secret: anyone who knows
// the secret can forge a logged-in session cookie.
const secret = process.env.SESSION_SECRET;
if (!secret || secret === 'change-me') {
  throw new Error('Set a long random SESSION_SECRET in .env (see .env.example).');
}

const sessionMiddleware = session({
  name: COOKIE_NAME,
  secret,
  resave: false,
  saveUninitialized: false, // no cookie is set until someone logs in
  cookie: {
    httpOnly: true,  // page JavaScript cannot read the cookie
    sameSite: 'lax', // not sent on cross-site POSTs (blocks CSRF from other sites)
    secure: process.env.NODE_ENV === 'production', // HTTPS-only when deployed
    maxAge: EIGHT_HOURS
  }
});

module.exports = { sessionMiddleware, COOKIE_NAME };

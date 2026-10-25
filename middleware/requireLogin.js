// Guards the manager area: only requests whose session holds a logged-in
// user get through; everyone else is sent to the login page.
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login');
}

module.exports = requireLogin;

// Manager area (behind requireLogin). Game CRUD arrives in Milestone 5
// and the live dashboard in Milestone 7.

function index(req, res) {
  res.render('manager', { title: 'Manager — The Rolling Die' });
}

module.exports = { index };

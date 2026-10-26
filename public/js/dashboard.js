// Live bot activity feed on the manager dashboard.
// New rows are filled with textContent, never innerHTML: the search text
// comes from Discord users and must never be treated as HTML.
(function () {
  const feed = document.getElementById('feed');
  const template = document.getElementById('feed-row-template');
  const emptyRow = document.getElementById('feed-empty');
  const status = document.getElementById('live-status');
  const lookupCount = document.getElementById('lookup-count');
  const notFoundCount = document.getElementById('not-found-count');
  const maxRows = Number(feed.dataset.maxRows) || 25;

  // Times arrive as UTC ISO strings; show them in the browser's local time
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

  function showLocalTime(timeElement) {
    const date = new Date(timeElement.dateTime);
    if (!Number.isNaN(date.getTime())) timeElement.textContent = timeFormat.format(date);
  }

  function updateCounts() {
    lookupCount.textContent = feed.querySelectorAll('.feed-row').length;
    notFoundCount.textContent = feed.querySelectorAll('.feed-row.is-not-found').length;
  }

  function setStatus(state, text) {
    status.dataset.state = state;
    status.textContent = text;
  }

  function addRow(activity) {
    const row = template.content.firstElementChild.cloneNode(true);
    if (activity.notFound) row.classList.add('is-not-found');

    const time = row.querySelector('.feed-time');
    time.dateTime = activity.time;
    showLocalTime(time);

    row.querySelector('.feed-query').textContent = activity.args;
    row.querySelector('.feed-meta').textContent = `${activity.command} · ${activity.discordUser}`;

    const pill = row.querySelector('.pill');
    pill.classList.add(activity.pillClass);
    pill.textContent = activity.resultLabel;

    feed.prepend(row);
    emptyRow.hidden = true;

    // Keep only the newest rows, like the page did on load
    const rows = feed.querySelectorAll('.feed-row');
    for (let i = maxRows; i < rows.length; i++) rows[i].remove();
    updateCounts();
  }

  feed.querySelectorAll('.feed-time').forEach(showLocalTime);

  // Served by socket.io itself; sends the session cookie automatically
  const socket = io();

  socket.on('connect', () => setStatus('live', 'Live'));

  socket.on('disconnect', (reason) => {
    // The server closes the socket on purpose when there is no login
    // (e.g. after logout or a server restart); it will not reconnect.
    if (reason === 'io server disconnect') {
      setStatus('off', 'Disconnected. Log in again to see live activity.');
    } else {
      setStatus('waiting', 'Reconnecting…');
    }
  });

  socket.on('botactivity', addRow);
})();

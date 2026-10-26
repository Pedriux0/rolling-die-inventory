// Turns a bot_activity row into display values. Used both when the
// dashboard page is rendered and for the live socket.io event, so a row
// looks the same whichever way it arrived.

const RESULT_LABELS = {
  found: 'Found',
  list: 'Several matches',
  not_found: 'Not in store',
  error: 'Error'
};

// Only "not in store" gets the red highlight; it shows what customers want
const PILL_CLASSES = {
  found: 'pill-neutral',
  list: 'pill-neutral',
  not_found: 'pill-out',
  error: 'pill-warn'
};

// SQLite's CURRENT_TIMESTAMP is UTC text like "2026-10-25 14:03:09";
// make it a real ISO date so browsers convert it to local time.
function toIsoUtc(sqliteTimestamp) {
  return sqliteTimestamp.replace(' ', 'T') + 'Z';
}

function toActivityView(row) {
  return {
    id: row.id,
    command: `/${row.command}`,
    args: row.args,
    result: row.result,
    resultLabel: RESULT_LABELS[row.result] || row.result,
    pillClass: PILL_CLASSES[row.result] || 'pill-neutral',
    notFound: row.result === 'not_found',
    discordUser: row.discord_user,
    time: toIsoUtc(row.created_at)
  };
}

module.exports = { toActivityView };

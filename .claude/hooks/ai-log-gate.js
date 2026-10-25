#!/usr/bin/env node
/**
 * ai-log-gate.js — makes the ai_log.txt update MANDATORY between milestones.
 *
 * Adapted from the idea in the gist linked by the assignment
 * (michaelewens/9a1bc5a97f3f9bbb79453e5b682df462): a UserPromptSubmit hook,
 * because its output is injected into Claude's context (a Stop hook's is not).
 * Differences from the gist: Node instead of Python (Node is already required
 * by the project), raw prompt capture, and a HARD block instead of a nudge.
 *
 * Modes:
 *   prompt         UserPromptSubmit hook. Records every prompt to
 *                  .claude/prompt_log.jsonl (tokens redacted). If a milestone is
 *                  waiting for its ai_log.txt entry, BLOCKS the prompt (exit 2).
 *   session        SessionStart hook. Tells Claude the current milestone/log status.
 *   done <n> <t>   Claude runs this when milestone n is finished. Opens the gate.
 *   check          Exit 1 if a log entry is still pending (used by git pre-commit).
 *   status         Print the current state.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const AI_LOG = path.join(ROOT, 'ai_log.txt');
const STATE = path.join(ROOT, '.claude', 'ai-log-state.json');
const PROMPT_LOG = path.join(ROOT, '.claude', 'prompt_log.jsonl');
const SOFT_REMINDER_EVERY = 6; // prompts without touching ai_log.txt (from the gist's THRESHOLD idea)

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); }
  catch { return { milestone: 0, title: '', awaitingLog: false, completedAt: 0, promptsSinceLog: 0, lastLogMtime: 0 }; }
}
function writeState(s) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}
function logMtime() {
  try { return fs.statSync(AI_LOG).mtimeMs; } catch { return 0; }
}
function logText() {
  try { return fs.readFileSync(AI_LOG, 'utf8'); } catch { return ''; }
}

// The gate opens only when ai_log.txt was saved AFTER the milestone finished
// AND contains a heading for that milestone. Touching the file is not enough.
function entrySatisfied(s) {
  if (!s.awaitingLog) return true;
  const heading = new RegExp(`=+\\s*Milestone\\s+${s.milestone}\\b`, 'i');
  return logMtime() > s.completedAt && heading.test(logText());
}

// Never store secrets in the prompt log (it ships inside implementation.zip).
function redact(text) {
  return String(text)
    .replace(/[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{27,40}/g, '[REDACTED_DISCORD_TOKEN]')
    .replace(/(BOT_TOKEN|SESSION_SECRET|PASSWORD)\s*[=:]\s*\S+/gi, '$1=[REDACTED]');
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

const mode = process.argv[2] || 'prompt';
const s = readState();

if (mode === 'prompt') {
  let input = {};
  try { input = JSON.parse(readStdin() || '{}'); } catch {}
  const pending = !entrySatisfied(s);

  fs.mkdirSync(path.dirname(PROMPT_LOG), { recursive: true });
  fs.appendFileSync(PROMPT_LOG, JSON.stringify({
    time: new Date().toISOString(),
    milestone: s.milestone,
    blocked: pending,
    prompt: redact(input.prompt || '')
  }) + '\n');

  if (pending) {
    process.stderr.write(
      `\n🛑 BLOCKED: Milestone ${s.milestone} ("${s.title}") is done but its ai_log.txt entry is missing.\n` +
      `   Open ai_log.txt, add a section starting with "=== Milestone ${s.milestone}: ${s.title} ===",\n` +
      `   fill in Tool / What I asked / What the AI produced / What I changed, fixed or verified,\n` +
      `   save the file, then resend your prompt (this one was not sent).\n`
    );
    process.exit(2); // UserPromptSubmit exit 2 = prompt is blocked and erased
  }

  if (s.awaitingLog) { // was pending, now satisfied -> close it
    s.awaitingLog = false;
    console.log(`ai_log.txt entry for Milestone ${s.milestone} confirmed. You may start Milestone ${s.milestone + 1} when Juan asks.`);
  }

  const m = logMtime();
  if (m !== s.lastLogMtime) { s.lastLogMtime = m; s.promptsSinceLog = 0; }
  else {
    s.promptsSinceLog += 1;
    if (s.promptsSinceLog % SOFT_REMINDER_EVERY === 0) {
      console.log(`Reminder: ${s.promptsSinceLog} prompts since ai_log.txt last changed. At the end of your reply, remind Juan to jot down any bug, rejected output, or fix from this stretch in ai_log.txt while it is fresh.`);
    }
  }
  writeState(s);
  process.exit(0);
}

if (mode === 'done') {
  const n = parseInt(process.argv[3], 10);
  const title = process.argv.slice(4).join(' ') || `Milestone ${n}`;
  if (!Number.isInteger(n)) { console.error('Usage: done <milestone-number> <title>'); process.exit(1); }
  Object.assign(s, { milestone: n, title, awaitingLog: true, completedAt: Date.now() });
  writeState(s);
  console.log(`Milestone ${n} marked done. Gate CLOSED until ai_log.txt has "=== Milestone ${n}: ${title} ===" saved.`);
  process.exit(0);
}

if (mode === 'session') {
  if (!entrySatisfied(s)) {
    console.log(`AI LOG PENDING: Milestone ${s.milestone} ("${s.title}") finished but ai_log.txt has no entry for it. Before anything else, tell Juan to write it. Do not start new work.`);
  } else {
    console.log(`AI log status: last completed milestone = ${s.milestone}${s.title ? ` ("${s.title}")` : ''}. Log is up to date.`);
  }
  process.exit(0);
}

if (mode === 'check') {
  if (!entrySatisfied(s)) {
    console.error(`\n🛑 Commit blocked: write the ai_log.txt entry for Milestone ${s.milestone} ("${s.title}") first.\n`);
    process.exit(1);
  }
  process.exit(0);
}

if (mode === 'status') {
  console.log(JSON.stringify({ ...s, entrySatisfied: entrySatisfied(s) }, null, 2));
  process.exit(0);
}

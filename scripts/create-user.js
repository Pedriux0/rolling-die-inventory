// Creates a manager account from the terminal (there is no public signup).
// Usage: npm run create-user -- <username>
// The password is typed at a hidden prompt, not passed as an argument,
// so it never ends up in the shell history.
const readline = require('readline');
const { Writable } = require('stream');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const userModel = require('../models/userModel');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;

// readline normally echoes what you type; writing its output to a stream
// that discards everything hides the password. Lines are read through an
// async iterator, which buffers them, so input that arrives early
// (e.g. piped in) is not lost before the question is asked.
const silentOutput = new Writable({ write: (chunk, encoding, done) => done() });
const rl = readline.createInterface({ input: process.stdin, output: silentOutput, terminal: true });
const lines = rl[Symbol.asyncIterator]();

async function askHidden(prompt) {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  process.stdout.write('\n');
  if (done) throw new Error('No input received.');
  return value;
}

async function main() {
  const username = (process.argv[2] || '').trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Usage: npm run create-user -- <username>  (3-30 letters, numbers, _ . -)');
  }

  if (await userModel.findByUsername(username)) {
    throw new Error(`User "${username}" already exists.`);
  }

  const password = await askHidden('Password: ');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if ((await askHidden('Confirm password: ')) !== password) {
    throw new Error('Passwords do not match.');
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await userModel.create(username, hash);
  console.log(`Manager "${username}" created.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    db.close();
  });

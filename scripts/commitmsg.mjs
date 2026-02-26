/**
 * commitmsg.mjs — NFXinit git-hooks commit-msg gate runner
 * Validates conventional commit format.
 *
 * Usage (called automatically by git):
 *   node commitmsg.mjs <commit-msg-file>
 *
 * Conventional commit format:
 *   type(scope): description
 *   Types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert
 *
 * Debug: GATES_DEBUG=1 git commit -m "..."
 */
import { readFileSync } from 'fs';
import { ok, fail } from './run.mjs';

const DEBUG = process.env.GATES_DEBUG === '1';
function dbg(...a) { if (DEBUG) process.stderr.write('[DEBUG] ' + a.join(' ') + '\n'); }

const msgFile = process.argv[2];
if (!msgFile) {
    process.stderr.write('Usage: node commitmsg.mjs <commit-msg-file>\n');
    process.exit(1);
}

let msg = '';
try {
    msg = readFileSync(msgFile, 'utf8').trim();
} catch (e) {
    process.stderr.write(`❌ Could not read commit message file: ${msgFile}\n`);
    process.exit(1);
}

dbg('Commit message:', JSON.stringify(msg));

// Strip comment lines (lines starting with #)
const stripped = msg.split('\n').filter(l => !l.startsWith('#')).join('\n').trim();
const subject = stripped.split('\n')[0].trim();

dbg('Subject line:', JSON.stringify(subject));

// Allow merge/revert commits
if (/^Merge\s/i.test(subject) || /^Revert\s/i.test(subject)) {
    ok(`Commit message: merge/revert commit (allowed)`);
    process.exit(0);
}

// Conventional commit pattern
const pattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?(!)?:\s.{1,100}$/;

if (!pattern.test(subject)) {
    fail(
        `Commit message does not follow Conventional Commits format.\n` +
        `  Got:    "${subject}"\n\n` +
        `  Format: type(scope): description\n` +
        `  Types:  feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert\n\n` +
        `  Examples:\n` +
        `    feat: add user authentication\n` +
        `    fix(auth): resolve token expiry bug\n` +
        `    chore(deps): update dependencies\n` +
        `    feat!: breaking API change`
    );
    process.exit(1);
}

ok(`Commit message: "${subject}"`);
process.exit(0);

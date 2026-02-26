#!/usr/bin/env node
/**
 * auto-push.mjs — Standalone GitHub auto-push CLI
 *
 * Usage:
 *   node git-hooks/scripts/auto-push.mjs \
 *     --repo  https://github.com/org/repo.git \
 *     --path  ./my-project \
 *     --name  my-project \
 *     [--branch feat/my-branch]   # optional, default: feat/<name>-init
 *
 * What it does:
 *   1. Validates the GitHub HTTPS URL
 *   2. `git init` (no-op if already initialized)
 *   3. `git remote add / set-url origin <repo>`
 *   4. `git checkout -b <branch>`
 *   5. `git add .`
 *   6. `git commit -m "feat: initial scaffold"`
 *   7. `git push -u origin <branch>`
 *   8. Prints the Pull Request compare URL
 *
 * Safety:
 *   - NEVER pushes to main/master directly
 *   - ONLY accepts valid HTTPS github.com URLs
 */
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';

// ── Colour helpers ────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

const ok = (m) => process.stdout.write(`${GREEN}✅ ${m}${RESET}\n`);
const warn = (m) => process.stdout.write(`${YELLOW}⚠  ${m}${RESET}\n`);
const err = (m) => process.stderr.write(`${RED}${BOLD}❌ ${m}${RESET}\n`);
const info = (m) => process.stdout.write(`${CYAN}ℹ  ${m}${RESET}\n`);

// ── Argument parsing ──────────────────────────────────────────────────────────
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            args[argv[i].slice(2)] = argv[i + 1] || '';
            i++;
        }
    }
    return args;
}

const args = parseArgs(process.argv.slice(2));

// --help
if ('help' in args || process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(`
${BOLD}auto-push.mjs${RESET} — Standalone GitHub auto-push CLI

${BOLD}Usage:${RESET}
  node git-hooks/scripts/auto-push.mjs \\
    --repo  https://github.com/org/repo.git \\
    --path  ./my-project \\
    --name  my-project \\
    [--branch feat/my-branch]

${BOLD}Options:${RESET}
  --repo     GitHub HTTPS repo URL (required)
  --path     Path to the project directory (default: current directory)
  --name     Project name used to generate branch name (required unless --branch given)
  --branch   Override the target branch name (default: feat/<name>-init)
  --message  Override the commit message (default: "feat: initial scaffold")
  --help     Show this help

${BOLD}Safety:${RESET}
  • Only accepts valid HTTPS github.com URLs
  • Never pushes directly to main/master
  • Uses feature branch naming: feat/<name>-init
`);
    process.exit(0);
}

// ── Validate inputs ───────────────────────────────────────────────────────────
const repoUrl = args['repo'] || '';
const projPath = resolve(args['path'] || process.cwd());
const projName = args['name'] || 'project';
const commitMsg = args['message'] || 'feat: initial scaffold';

if (!repoUrl) {
    err('--repo is required. Example: --repo https://github.com/org/repo.git');
    process.exit(1);
}

// Validate GitHub HTTPS URL
const githubUrlPattern = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/;
if (!githubUrlPattern.test(repoUrl)) {
    err(`Invalid GitHub URL: "${repoUrl}"`);
    err('Must be: https://github.com/<org>/<repo>.git');
    process.exit(1);
}

if (!existsSync(projPath)) {
    err(`Project path does not exist: ${projPath}`);
    process.exit(1);
}

// Build branch name
function sanitizeBranchName(name) {
    return name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'project';
}

const featureBranch = args['branch'] || `feat/${sanitizeBranchName(projName)}-init`;

// Validate no push to main/master
if (featureBranch === 'main' || featureBranch === 'master') {
    err(`Branch "${featureBranch}" is not allowed. Use a feature branch.`);
    process.exit(1);
}

// ── Git helpers ───────────────────────────────────────────────────────────────
function git(gitArgs, label) {
    const r = spawnSync('git', gitArgs, {
        cwd: projPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60_000,
        maxBuffer: 10 * 1024 * 1024, // 10MB to prevent ENOBUFS on large git add outputs
    });
    if (r.error) {
        err(`${label}: ${r.error.message}`);
        return false;
    }
    if (r.status !== 0) {
        const msg = (r.stderr || r.stdout || '').trim();
        err(`${label} failed: ${msg}`);
        return false;
    }
    ok(label);
    return true;
}

// ── Main push flow ────────────────────────────────────────────────────────────
process.stdout.write('\n');
process.stdout.write(`${BOLD}${CYAN}🚀 Auto-pushing to GitHub → ${GREEN}${featureBranch}${RESET}\n`);
process.stdout.write(`   Repo: ${repoUrl}\n`);
process.stdout.write(`   Path: ${projPath}\n\n`);

// Step 1: git init
if (!git(['init'], 'git init')) process.exit(1);

// Step 2: remote setup
const hasRemote = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: projPath, stdio: 'pipe', encoding: 'utf8',
}).status === 0;

if (hasRemote) {
    if (!git(['remote', 'set-url', 'origin', repoUrl], `git remote set-url origin`)) process.exit(1);
} else {
    if (!git(['remote', 'add', 'origin', repoUrl], `git remote add origin`)) process.exit(1);
}

// Step 3: create feature branch
let branchResult = spawnSync('git', ['checkout', '-b', featureBranch], {
    cwd: projPath, encoding: 'utf8', stdio: 'pipe',
});
if (branchResult.status !== 0) {
    // Branch may already exist — try to switch
    branchResult = spawnSync('git', ['checkout', featureBranch], {
        cwd: projPath, encoding: 'utf8', stdio: 'pipe',
    });
    if (branchResult.status !== 0) {
        err(`Could not create/switch to branch "${featureBranch}": ${(branchResult.stderr || '').trim()}`);
        process.exit(1);
    }
}
ok(`git checkout -b ${featureBranch}`);

// Step 4: git add
if (!git(['add', '.'], 'git add .')) process.exit(1);

// Step 5: git commit
if (!git(['commit', '-m', commitMsg], `git commit -m "${commitMsg}"`)) {
    warn('Hint: check that pre-commit gates pass. Use GATES_DEBUG=1 for details.');
    process.exit(1);
}

// Step 6: git push
if (!git(['push', '-u', 'origin', featureBranch], `git push -u origin ${featureBranch}`)) {
    warn('Make sure the GitHub repo exists and you have push access.');
    process.exit(1);
}

// Step 7: print PR URL
const prBase = repoUrl.replace(/\.git$/, '');
const prUrl = `${prBase}/compare/${featureBranch}`;

process.stdout.write('\n');
process.stdout.write(`${GREEN}${BOLD}🎉 Pushed to GitHub!${RESET}\n`);
process.stdout.write(`   Branch : ${CYAN}${featureBranch}${RESET}\n`);
process.stdout.write(`   Open PR: ${CYAN}${prUrl}${RESET}\n`);
process.stdout.write('\n');

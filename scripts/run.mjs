/**
 * run.mjs — Exec helpers for NFXinit git-hooks gate runners
 * Cross-platform: works on Windows, macOS, Linux
 * NOTE: Uses process.stdout/stderr.write intentionally — no console.log so
 *       the debug_detector gate never flags this infrastructure file.
 */
import { execSync, spawnSync } from 'child_process';

export const RESET = '\x1b[0m';
export const RED = '\x1b[31m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const CYAN = '\x1b[36m';
export const BOLD = '\x1b[1m';

const _w = (s) => process.stdout.write(s + '\n');
const _e = (s) => process.stderr.write(s + '\n');

export function ok(msg) { _w(`${GREEN}✅ ${msg}${RESET}`); }
export function warn(msg) { _w(`${YELLOW}⚠  ${msg}${RESET}`); }
export function fail(msg) { _e(`${RED}${BOLD}❌ ${msg}${RESET}`); }
export function info(msg) { _w(`${CYAN}ℹ  ${msg}${RESET}`); }

/**
 * Run a shell command string. Returns { success, stdout, stderr }.
 * Does NOT throw — callers decide what to do on failure.
 */
export function run(cmd, opts = {}) {
    try {
        const stdout = execSync(cmd, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            ...opts,
        });
        return { success: true, stdout: stdout || '', stderr: '' };
    } catch (e) {
        return {
            success: false,
            stdout: e.stdout || '',
            stderr: e.stderr || e.message || '',
        };
    }
}

/**
 * Run a command with explicit args array (no shell escaping needed).
 * Safe on Windows paths with spaces. Returns { success, stdout, stderr, status }.
 * opts may include: cwd, env, timeout.
 */
export function runArgs(args, opts = {}) {
    const [cmd, ...rest] = args;
    const result = spawnSync(cmd, rest, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: opts.timeout || 30_000,
        cwd: opts.cwd || process.cwd(),
        env: opts.env || process.env,
    });
    const success = result.status === 0 && !result.error;
    return {
        success,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        status: result.status ?? -1,
    };
}

/**
 * Check if a CLI tool is available on PATH.
 */
export function toolExists(name) {
    const check = process.platform === 'win32'
        ? spawnSync('where', [name], { stdio: 'pipe' })
        : spawnSync('which', [name], { stdio: 'pipe' });
    return check.status === 0;
}

/**
 * Get list of staged files (forward-slash paths on all platforms).
 */
export function getStagedFiles() {
    const { stdout } = run('git diff --cached --name-only --diff-filter=ACM');
    return stdout.split('\n').map(f => f.trim().replace(/\\/g, '/')).filter(Boolean);
}

/**
 * Get list of commits being pushed (for pre-push).
 * Returns array of { hash, subject }
 */
export function getPushCommits(localRef, remoteRef) {
    const range = remoteRef === '0000000000000000000000000000000000000000'
        ? localRef
        : `${remoteRef}..${localRef}`;
    const { stdout } = run(`git log --pretty=format:"%H %s" ${range}`);
    return stdout.split('\n').filter(Boolean).map(line => {
        const [hash, ...rest] = line.split(' ');
        return { hash, subject: rest.join(' ') };
    });
}

/**
 * Exit with code 1 after printing a summary of failures.
 */
export function exitWithFailures(failures) {
    _e('');
    _e(`${RED}${BOLD}Gate failures (${failures.length})${RESET}`);
    failures.forEach(f => _e(`  ${RED}• ${f}${RESET}`));
    _e('');
    process.exit(1);
}

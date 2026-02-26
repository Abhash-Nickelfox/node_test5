/**
 * precommit.mjs — NFXinit git-hooks pre-commit gate runner
 * Runs all enabled pre-commit gates. Fails fast on any error.
 *
 * Gates:
 *   1.  Trailing whitespace + EOF newline
 *   2.  Large file blocker (>10MB)
 *   3.  Binary file detector
 *   4.  Temp/junk file detector
 *   5.  Debug statement detector
 *   6.  Secret scanner (gitleaks)
 *   7.  Lockfile required
 *   8.  Formatter (Prettier / black)
 *   9.  Lint (ESLint / ruff)
 *   10. Gitignore validation
 *
 * Debug: GATES_DEBUG=1 git commit -m "..."
 */
import { readFileSync, statSync, existsSync } from 'fs';
import { extname, basename, resolve, join, dirname } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ok, warn, fail, info, run, runArgs, toolExists, getStagedFiles, exitWithFailures } from './run.mjs';
import { isGateEnabled, isGateApplicable, getStack } from './detect.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug logging — set GATES_DEBUG=1 to enable verbose output
const DEBUG = process.env.GATES_DEBUG === '1';
function dbg(...a) { if (DEBUG) process.stderr.write('[DEBUG] ' + a.join(' ') + '\n'); }

// ── Repo root resolution ──────────────────────────────────────────────────────
let _repoRoot = null;
function getRepoRoot() {
    if (_repoRoot) return _repoRoot;
    try {
        const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
            encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (r.status === 0 && r.stdout.trim()) {
            _repoRoot = r.stdout.trim();
            dbg('RepoRoot (git):', _repoRoot);
            return _repoRoot;
        }
    } catch (_) { }
    // Fallback: two levels up from scripts/ → git-hooks root
    _repoRoot = resolve(__dirname, '..', '..');
    dbg('RepoRoot (fallback):', _repoRoot);
    return _repoRoot;
}

/**
 * Auto-detect the project stack from the working directory.
 */
function detectStack() {
    const cfgStack = getStack();
    if (cfgStack && cfgStack !== 'auto') return cfgStack;
    if (existsSync('manage.py')) return 'django';
    const hasNextConfig = ['next.config.js', 'next.config.mjs', 'next.config.ts'].some(f => existsSync(f));
    if (hasNextConfig) return 'nextjs';
    if (existsSync('package.json') && existsSync('src/main.ts')) return 'nestjs';
    if (existsSync('package.json')) return 'nodejs';
    return 'unknown';
}

const failures = [];
const staged = getStagedFiles();
const stack = detectStack();
const isNodeStack = ['nextjs', 'nestjs', 'nodejs'].includes(stack);

info(`Pre-commit: checking ${staged.length} staged file(s) [stack: ${stack}]...`);
dbg('Staged files:', staged.join(', '));

// ── 1. Trailing whitespace + EOF newline ──────────────────────────────────────
if (isGateEnabled('trailing_whitespace') || isGateEnabled('eof_newline')) {
    const textExts = ['.js', '.mjs', '.ts', '.tsx', '.jsx', '.py', '.md', '.json', '.yaml', '.yml', '.toml', '.env', '.txt', '.css', '.scss', '.html'];
    for (const file of staged) {
        if (!existsSync(file)) continue;
        const ext = extname(file).toLowerCase();
        if (!textExts.includes(ext)) continue;
        try {
            const content = readFileSync(file, 'utf8');
            const lines = content.split('\n');
            if (isGateEnabled('trailing_whitespace')) {
                const trailingLines = lines.map((l, i) => ({ l, i })).filter(({ l }) => /[ \t]+$/.test(l));
                if (trailingLines.length > 0) {
                    failures.push(`Trailing whitespace in ${file} (lines: ${trailingLines.map(x => x.i + 1).join(', ')})`);
                }
            }
            if (isGateEnabled('eof_newline')) {
                if (content.length > 0 && !content.endsWith('\n')) {
                    failures.push(`Missing EOF newline in ${file}`);
                }
            }
        } catch (_) { }
    }
    if (failures.length === 0) ok('Trailing whitespace + EOF newline');
}

// ── 2. Large file blocker (>10MB) ─────────────────────────────────────────────
if (isGateEnabled('large_file_blocker')) {
    const MAX_BYTES = 10 * 1024 * 1024;
    let hasLarge = false;
    for (const file of staged) {
        try {
            const size = statSync(file).size;
            if (size > MAX_BYTES) {
                failures.push(`Large file staged: ${file} (${(size / 1024 / 1024).toFixed(1)}MB > 10MB limit)`);
                hasLarge = true;
            }
        } catch (_) { }
    }
    if (!hasLarge) ok('Large file blocker');
}

// ── 3. Binary file detector ───────────────────────────────────────────────────
if (isGateEnabled('binary_detector')) {
    const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.tar', '.gz', '.rar', '.7z', '.jar', '.war', '.class', '.pyc', '.pyo', '.wasm'];
    const binaryFiles = staged.filter(f => binaryExts.includes(extname(f).toLowerCase()));
    if (binaryFiles.length > 0) {
        failures.push(`Binary files staged (use Git LFS instead): ${binaryFiles.join(', ')}`);
    } else {
        ok('Binary file detector');
    }
}

// ── 4. Temp/junk file detector ────────────────────────────────────────────────
if (isGateEnabled('temp_junk_detector')) {
    const junkPatterns = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.tmp', '.temp', '.bak', '.swp', '.swo'];
    const junkFiles = staged.filter(f => junkPatterns.some(p => basename(f) === p || f.endsWith(p)));
    if (junkFiles.length > 0) {
        failures.push(`Junk/temp files staged: ${junkFiles.join(', ')}`);
    } else {
        ok('Temp/junk file detector');
    }
}

// ── 5. Debug statement detector ───────────────────────────────────────────────
if (isGateEnabled('debug_detector')) {
    const debugPatterns = [
        { pattern: /\bconsole\.log\s*\(/, label: 'console.log', exts: ['.js', '.mjs', '.ts', '.tsx', '.jsx'] },
        { pattern: /\bdebugger\b/, label: 'debugger', exts: ['.js', '.mjs', '.ts', '.tsx', '.jsx'] },
        { pattern: /\bprint\s*\(/, label: 'print()', exts: ['.py'] },
        { pattern: /\bpdb\.set_trace\(/, label: 'pdb.set_trace()', exts: ['.py'] },
        { pattern: /\bbreakpoint\s*\(/, label: 'breakpoint()', exts: ['.py'] },
        { pattern: /\bvar_dump\s*\(/, label: 'var_dump()', exts: ['.php'] },
    ];
    let hasDebug = false;
    for (const file of staged) {
        if (!existsSync(file)) continue;
        // SKIP gate runner scripts themselves — they contain these patterns intentionally
        const normFile = file.replace(/\\/g, '/');
        const isGateRunner = normFile.includes('scripts/gates/')
            || normFile.includes('.githooks/')
            || normFile.includes('git-hooks/scripts/')
            || /(^|\/)scripts\/[^/]+\.mjs$/.test(normFile);  // scripts/*.mjs at project root
        if (isGateRunner) continue;
        const ext = extname(file).toLowerCase();
        try {
            const content = readFileSync(file, 'utf8');
            for (const { pattern, label, exts } of debugPatterns) {
                if (exts.includes(ext) && pattern.test(content)) {
                    if (!isNodeStack) {
                        failures.push(`Debug statement found in ${file}: ${label}`);
                    }
                    hasDebug = true;
                }
            }
        } catch (_) { }
    }
    if (hasDebug && isNodeStack) {
        warn(`Debug statement check: warning-only for ${stack} stack.`);
        hasDebug = false;
    }
    if (!hasDebug) ok('Debug statement detector');
}

// ── 6. Secret scanner (gitleaks) ──────────────────────────────────────────────
if (isGateEnabled('secret_scanner')) {
    if (!toolExists('gitleaks')) {
        failures.push(
            'Secret scanner: gitleaks is not installed.\n' +
            '  Fix: https://github.com/gitleaks/gitleaks#installing\n' +
            '  macOS:   brew install gitleaks\n' +
            '  Windows: winget install gitleaks  OR  choco install gitleaks\n' +
            '  Linux:   https://github.com/gitleaks/gitleaks/releases'
        );
    } else {
        const repoRoot = getRepoRoot();
        const cfgPath = join(repoRoot, '.gitleaks.toml');
        const hasCfg = existsSync(cfgPath);

        const glArgs = ['protect', '--staged', '--verbose'];
        if (hasCfg) glArgs.push('--config', cfgPath);

        dbg('gitleaks args:', JSON.stringify(glArgs), 'cwd:', repoRoot);

        const gl = spawnSync('gitleaks', glArgs, {
            cwd: repoRoot,
            shell: false,
            stdio: 'inherit',
        });

        if (gl.status !== 0) {
            const configNote = hasCfg ? ` --config "${cfgPath}"` : '';
            failures.push(
                'Secret scanner (gitleaks): potential secrets found in staged files.\n' +
                `  Re-run: gitleaks protect --staged --verbose${configNote}\n` +
                '  Or allowlist scaffold placeholders in .gitleaks.toml.'
            );
        } else {
            ok('Secret scanner (gitleaks)');
        }
    }
}

// ── 7. Lockfile required ───────────────────────────────────────────────────────
if (isGateEnabled('lockfile_required')) {
    const hasPackageJson = staged.includes('package.json') || existsSync('package.json');
    const hasPyproject = staged.includes('pyproject.toml') || existsSync('pyproject.toml');
    const hasLockfile = existsSync('package-lock.json') || existsSync('yarn.lock') ||
        existsSync('pnpm-lock.yaml') || existsSync('poetry.lock') || existsSync('Pipfile.lock');
    if ((hasPackageJson || hasPyproject) && !hasLockfile) {
        failures.push('Lockfile missing: run  npm install  OR  poetry install  to generate one.');
    } else {
        ok('Lockfile check');
    }
}

// ── 8. Formatter ──────────────────────────────────────────────────────────────
if (isGateEnabled('formatter')) {
    const hasPrettier = existsSync('.prettierrc') || existsSync('.prettierrc.json') || existsSync('prettier.config.js');
    if (hasPrettier && toolExists('npx')) {
        const { success } = run('npx prettier --check . --ignore-unknown 2>&1');
        if (!success) {
            failures.push('Formatter: Prettier check failed.\n  Fix: npx prettier --write .');
        } else {
            ok('Formatter (Prettier)');
        }
    } else if (toolExists('black')) {
        const pyFiles = staged.filter(f => f.endsWith('.py'));
        if (pyFiles.length > 0) {
            const { success } = run(`black --check ${pyFiles.join(' ')}`);
            if (!success) {
                failures.push('Formatter: black check failed.\n  Fix: black ' + pyFiles.join(' '));
            } else {
                ok('Formatter (black)');
            }
        }
    }
}

// ── 9. Lint ────────────────────────────────────────────────────────────────────
if (isGateEnabled('lint')) {
    const hasEslint = existsSync('.eslintrc') || existsSync('.eslintrc.json') || existsSync('.eslintrc.js') ||
        existsSync('eslint.config.js') || existsSync('eslint.config.mjs');
    if (hasEslint && toolExists('npx')) {
        const jsFiles = staged.filter(f => ['.js', '.mjs', '.ts', '.tsx', '.jsx'].includes(extname(f)));
        if (jsFiles.length > 0) {
            if (isNodeStack) {
                warn(`ESLint skipped for ${stack} in pre-commit (runs at pre-push).`);
            } else {
                const { success } = run(`npx eslint ${jsFiles.join(' ')} --max-warnings=0`);
                if (!success) {
                    failures.push('Lint: ESLint found errors.\n  Fix: npx eslint --fix ' + jsFiles.join(' '));
                } else {
                    ok('Lint (ESLint)');
                }
            }
        }
    } else if (toolExists('ruff')) {
        const pyFiles = staged.filter(f => f.endsWith('.py'));
        if (pyFiles.length > 0) {
            const { success } = run(`ruff check ${pyFiles.join(' ')}`);
            if (!success) {
                failures.push('Lint: ruff found errors.\n  Fix: ruff check --fix ' + pyFiles.join(' '));
            } else {
                ok('Lint (ruff)');
            }
        }
    }
}

// ── 10. Gitignore validation ───────────────────────────────────────────────────
if (isGateEnabled('gitignore_validation')) {
    if (!existsSync('.gitignore')) {
        failures.push('No .gitignore file found. Create one to avoid committing unwanted files.');
    } else {
        ok('Gitignore validation');
    }
}

// ── Final result ───────────────────────────────────────────────────────────────
if (failures.length > 0) {
    exitWithFailures(failures);
} else {
    process.stdout.write('\n');
    process.stdout.write('\x1b[32m\x1b[1m✅ All pre-commit gates passed!\x1b[0m\n');
    process.stdout.write('\n');
}

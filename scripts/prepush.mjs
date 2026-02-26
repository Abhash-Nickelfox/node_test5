/**
 * prepush.mjs — NFXinit git-hooks pre-push gate runner
 * Reads push info from stdin (local-ref local-sha remote-ref remote-sha).
 *
 * Gates:
 *   1.  Prevent push to main/master
 *   2.  Branch naming convention
 *   3.  Commit message lint (conventional commits)
 *   4.  Signed commits (enterprise mode only)
 *   5.  Full lint (ESLint / ruff)
 *   6.  TypeScript type check
 *   7.  Unit tests
 *   8.  CVE scan (npm audit / pip-audit)
 *   9.  Docker scan (trivy)
 *   10. DB migration check (Django)
 *   11. API schema diff
 *
 * Debug: GATES_DEBUG=1 git push
 */
import { readFileSync, existsSync } from 'fs';
import { ok, warn, fail, info, run, toolExists, getPushCommits, exitWithFailures } from './run.mjs';
import { isGateEnabled, isGateApplicable, loadConfig, getStack } from './detect.mjs';

// Debug logging
const DEBUG = process.env.GATES_DEBUG === '1';
function dbg(...a) { if (DEBUG) process.stderr.write('[DEBUG] ' + a.join(' ') + '\n'); }

const failures = [];

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

const stack = detectStack();
const isNodeStack = ['nextjs', 'nestjs', 'nodejs'].includes(stack);

// Read push info from stdin
let stdinData = '';
try {
    stdinData = readFileSync('/dev/stdin', 'utf8');
} catch (_) {
    // Windows: stdin may not be /dev/stdin — fall through
    try {
        stdinData = readFileSync(0, 'utf8'); // fd 0 = stdin
    } catch (_) { }
}

// Parse: "<local-ref> <local-sha1> <remote-ref> <remote-sha1>"
const pushLines = stdinData.trim().split('\n').filter(Boolean);
const localRef = pushLines[0]?.split(' ')[0] || 'HEAD';
const localSha = pushLines[0]?.split(' ')[1] || 'HEAD';
const remoteRef = pushLines[0]?.split(' ')[2] || '';
const remoteSha = pushLines[0]?.split(' ')[3] || '0000000000000000000000000000000000000000';

dbg('Push info:', { localSha, remoteRef, remoteSha });
info(`Pre-push: validating push to ${remoteRef || 'remote'} [stack: ${stack}]...`);

// ── 1. Prevent push to main/master ────────────────────────────────────────────
if (isGateEnabled('prevent_main_push')) {
    const { stdout: currentBranch } = run('git rev-parse --abbrev-ref HEAD');
    const branch = currentBranch.trim();
    if (branch === 'main' || branch === 'master') {
        failures.push(
            `Direct push to '${branch}' is not allowed.\n` +
            `  Create a feature branch: git checkout -b feat/your-feature\n` +
            `  Then open a Pull Request.`
        );
    } else {
        ok(`Branch protection (pushing from '${branch}')`);
    }
}

// ── 2. Branch naming convention ───────────────────────────────────────────────
if (isGateEnabled('branch_naming')) {
    const { stdout: branchOut } = run('git rev-parse --abbrev-ref HEAD');
    const branch = branchOut.trim();
    const validPattern = /^(feat|fix|docs|chore|refactor|hotfix|release|style|test|ci|build|perf)\/[a-z0-9._-]+$|^(main|master|develop|development|staging|production)$/;
    if (!validPattern.test(branch)) {
        failures.push(
            `Branch name '${branch}' does not follow naming convention.\n` +
            `  Use: feat/description, fix/description, chore/description, etc.\n` +
            `  Example: git checkout -b feat/user-authentication`
        );
    } else {
        ok(`Branch naming: '${branch}'`);
    }
}

// ── 3. Commit message lint (conventional commits) ─────────────────────────────
if (isGateEnabled('commit_msg_lint')) {
    const commits = getPushCommits(localSha, remoteSha);
    const conventionalPattern = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?(!)?:\s.+/;
    const badCommits = commits.filter(c => !conventionalPattern.test(c.subject));
    if (badCommits.length > 0) {
        failures.push(
            `Commit message lint failed for ${badCommits.length} commit(s):\n` +
            badCommits.map(c => `  • ${c.hash.slice(0, 7)}: ${c.subject}`).join('\n') +
            `\n  Format: type(scope): description\n` +
            `  Types: feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
        );
    } else {
        ok(`Commit message lint (${commits.length} commit(s))`);
    }
}

// ── 4. Signed commits (enterprise mode only) ──────────────────────────────────
const requireSigned = loadConfig().requireSignedCommits || false;
if (requireSigned && isGateEnabled('signed_commits')) {
    const { stdout: signingKey } = run('git config --get user.signingkey');
    const { stdout: gpgSignEnabled } = run('git config --get commit.gpgsign');
    if (!signingKey.trim() || gpgSignEnabled.trim() !== 'true') {
        failures.push(
            'Signed commits required (enterprise mode).\n' +
            '  Setup: gpg --gen-key && git config --global user.signingkey <KEY_ID>\n' +
            '         git config --global commit.gpgsign true'
        );
    } else {
        ok('Signed commits (GPG key configured)');
    }
} else {
    dbg('Signed commits check skipped (requireSignedCommits=false)');
}

// ── 5. Full lint ───────────────────────────────────────────────────────────────
if (isGateEnabled('full_lint')) {
    const hasEslint = existsSync('.eslintrc') || existsSync('.eslintrc.json') ||
        existsSync('eslint.config.js') || existsSync('eslint.config.mjs');
    if (hasEslint && toolExists('npx')) {
        const { success } = run('npx eslint . --max-warnings=0');
        if (!success) {
            if (isNodeStack) {
                warn(`Full lint: ESLint warning-only for ${stack} stack.`);
            } else {
                failures.push('Full lint: ESLint found errors.\n  Fix: npx eslint . --fix');
            }
        } else {
            ok('Full lint (ESLint)');
        }
    } else if (toolExists('ruff')) {
        const { success } = run('ruff check .');
        if (!success) {
            failures.push('Full lint: ruff found errors.\n  Fix: ruff check --fix .');
        } else {
            ok('Full lint (ruff)');
        }
    }
}

// ── 6. TypeScript type check ───────────────────────────────────────────────────
if (isGateEnabled('typecheck')) {
    if (existsSync('tsconfig.json') && toolExists('npx')) {
        const { success } = run('npx tsc --noEmit');
        if (!success) {
            if (isNodeStack) {
                warn(`TypeScript type check: warning-only for ${stack} stack.`);
            } else {
                failures.push('TypeScript: type check failed.\n  Run: npx tsc --noEmit  to see errors.');
            }
        } else {
            ok('TypeScript type check');
        }
    }
}

// ── 7. Unit tests ──────────────────────────────────────────────────────────────
if (isGateEnabled('unit_tests')) {
    if (existsSync('package.json')) {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        if (pkg.scripts?.test) {
            const { success } = run('npm test -- --passWithNoTests 2>&1');
            if (!success) {
                failures.push('Unit tests failed.\n  Run: npm test  to see details.');
            } else {
                ok('Unit tests');
            }
        }
    } else if (toolExists('pytest')) {
        const { success } = run('pytest --tb=short -q 2>&1');
        if (!success) {
            failures.push('Unit tests (pytest) failed.\n  Run: pytest  to see details.');
        } else {
            ok('Unit tests (pytest)');
        }
    }
}

// ── 8. CVE scan ────────────────────────────────────────────────────────────────
if (isGateEnabled('cve_scan')) {
    if (existsSync('package.json') && toolExists('npm')) {
        const { success } = run('npm audit --audit-level=high --json 2>&1');
        if (!success) {
            failures.push('CVE scan: npm audit found HIGH/CRITICAL vulnerabilities.\n  Run: npm audit  for details.\n  Fix: npm audit fix');
        } else {
            ok('CVE scan (npm audit)');
        }
    } else if (existsSync('requirements.txt') || existsSync('pyproject.toml')) {
        if (toolExists('pip-audit')) {
            const { success } = run('pip-audit -q 2>&1');
            if (!success) {
                failures.push('CVE scan: pip-audit found vulnerabilities.\n  Run: pip-audit  for details.');
            } else {
                ok('CVE scan (pip-audit)');
            }
        } else {
            warn('CVE scan: pip-audit not installed.  pip install pip-audit');
        }
    }
}

// ── 9. Docker scan (only if Dockerfile exists) ────────────────────────────────
if (isGateEnabled('docker_scan')) {
    if (existsSync('Dockerfile')) {
        if (!toolExists('trivy')) {
            failures.push(
                'Docker scan: trivy is not installed.\n' +
                '  Fix: https://aquasecurity.github.io/trivy/latest/getting-started/installation/\n' +
                '  macOS: brew install trivy\n' +
                '  Windows: winget install AquaSecurity.Trivy'
            );
        } else {
            const { success } = run('trivy fs --exit-code 1 --severity HIGH,CRITICAL . 2>&1');
            if (!success) {
                failures.push('Docker scan: trivy found HIGH/CRITICAL vulnerabilities.\n  Run: trivy fs .  for details.');
            } else {
                ok('Docker scan (trivy)');
            }
        }
    }
}

// ── 10. DB migration check (Django) ───────────────────────────────────────────
if (isGateEnabled('db_migration_check')) {
    if (existsSync('manage.py')) {
        const { success, stdout } = run('python manage.py showmigrations --plan 2>&1');
        if (stdout.includes('[ ]')) {
            failures.push('DB migrations: Unapplied Django migrations detected.\n  Run: python manage.py migrate');
        } else {
            ok('DB migration check (Django)');
        }
    }
}

// ── 11. API schema diff ───────────────────────────────────────────────────────
if (isGateEnabled('api_schema_diff')) {
    const schemaFiles = ['openapi.json', 'openapi.yaml', 'swagger.json', 'swagger.yaml'];
    const currentSchema = schemaFiles.find(f => existsSync(f));
    const prevSchema = existsSync('openapi.prev.json') ? 'openapi.prev.json' : null;
    if (currentSchema && prevSchema) {
        if (toolExists('openapi-diff')) {
            const { success } = run(`openapi-diff ${prevSchema} ${currentSchema} 2>&1`);
            if (!success) {
                warn('API schema diff: Breaking changes detected. Review before pushing.');
            } else {
                ok('API schema diff');
            }
        } else {
            warn('API schema diff: openapi-diff not installed.  npm i -g openapi-diff');
        }
    }
}

// ── Final result ───────────────────────────────────────────────────────────────
if (failures.length > 0) {
    exitWithFailures(failures);
} else {
    process.stdout.write('\n');
    process.stdout.write('\x1b[32m\x1b[1m✅ All pre-push gates passed!\x1b[0m\n');
    process.stdout.write('\n');
}

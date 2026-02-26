/**
 * detect.mjs — Load gate configuration
 * Looks for config in (in order):
 *   1. .gates/config.json   (in current working directory — NFXinit generated)
 *   2. git-hooks/config/gates.json  (relative to this script — default config)
 */
import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config search order
const candidatePaths = [
    join(process.cwd(), '.gates', 'config.json'),
    join(__dirname, '..', 'config', 'gates.json'),
];

let _config = null;

export function loadConfig() {
    if (_config) return _config;

    for (const p of candidatePaths) {
        if (existsSync(p)) {
            try {
                _config = JSON.parse(readFileSync(p, 'utf8'));
                return _config;
            } catch (e) {
                process.stderr.write(`❌ Failed to parse ${p}: ${e.message}\n`);
                process.exit(1);
            }
        }
    }

    // No config found — use safe defaults (all gates enabled)
    process.stderr.write('⚠  No gates config found. Using built-in defaults.\n');
    _config = { stack: 'auto', enabledGates: {} };
    return _config;
}

export function getFeatures() {
    return loadConfig().features || {};
}

export function getEnabledGates() {
    return loadConfig().enabledGates || {};
}

export function getStack() {
    return loadConfig().stack || 'auto';
}

export function isGateEnabled(gateName) {
    const gates = getEnabledGates();
    // If gate is missing from config, treat as enabled (safe default)
    if (!(gateName in gates)) return true;
    return gates[gateName] === 'enabled';
}

export function isGateApplicable(gateName) {
    const gates = getEnabledGates();
    return gates[gateName] !== 'not_applicable';
}

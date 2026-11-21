'use strict';

/**
 * Jest network guard: proxy settings (Stage 3a, decision D5).
 *
 * A proxy on loopback would let traffic leave the machine while the guard's
 * socket hook sees only a local connection. globalSetup removes proxy
 * settings from the Jest parent process before any worker starts (workers
 * inherit its environment), setup.js removes them again in every test
 * file's environment, and the heartbeat records any that were still there.
 * In CI any proxy setting refuses the run. Only variable names are ever
 * recorded, never values. Nothing outside the Jest process tree is changed.
 */

const NAME_PATTERNS = [
  /(^|_)(https?|all|ftp|socks5?|no)_proxy$/i, // HTTP_PROXY, https_proxy, ALL_PROXY, NO_PROXY, YARN_HTTPS_PROXY, GLOBAL_AGENT_HTTPS_PROXY ...
  /^npm_config_(https_)?proxy$/i,
  /^npm_config_noproxy$/i,
  /^GLOBAL_AGENT_/i,
  /^NODE_USE_ENV_PROXY$/i,
];
const FLAG = '--use-env-proxy';

function isProxyName(name) {
  return NAME_PATTERNS.some((re) => re.test(name));
}

function nodeOptionsHasFlag(value) {
  return String(value || '').split(/\s+/).some((t) => t === FLAG || t.startsWith(`${FLAG}=`));
}

/** Names of the proxy settings present (sorted). Never values. */
function findProxySettings(env = process.env, execArgv = process.execArgv) {
  const names = Object.keys(env).filter((k) => isProxyName(k) && env[k] !== undefined && env[k] !== '');
  if (nodeOptionsHasFlag(env.NODE_OPTIONS)) names.push(`NODE_OPTIONS:${FLAG}`);
  if ((execArgv || []).some((a) => a === FLAG || a.startsWith(`${FLAG}=`))) names.push(`execArgv:${FLAG}`);
  return names.sort();
}

/**
 * Remove proxy settings from `env` in place. Returns the names removed. A
 * proxy flag in this process's own execArgv cannot be removed (it is already
 * in effect, and Jest passes it to its workers): it is returned in
 * `unremovable`, and callers must refuse the run.
 */
function sanitize(env = process.env, execArgv = process.execArgv) {
  const removed = [];
  for (const k of Object.keys(env)) {
    if (isProxyName(k)) {
      if (env[k] !== undefined && env[k] !== '') removed.push(k);
      delete env[k];
    }
  }
  if (nodeOptionsHasFlag(env.NODE_OPTIONS)) {
    env.NODE_OPTIONS = String(env.NODE_OPTIONS).split(/\s+/).filter((t) => t && t !== FLAG && !t.startsWith(`${FLAG}=`)).join(' ');
    removed.push(`NODE_OPTIONS:${FLAG}`);
  }
  const unremovable = (execArgv || []).some((a) => a === FLAG || a.startsWith(`${FLAG}=`)) ? [`execArgv:${FLAG}`] : [];
  return { removed: removed.sort(), unremovable };
}

module.exports = { isProxyName, findProxySettings, sanitize };

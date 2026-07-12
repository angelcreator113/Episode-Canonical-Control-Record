#!/usr/bin/env node
/**
 * print-db-env.js — F-Deploy-1 G2 prerequisite P4 (Fix Plan v1.36 §1).
 *
 * Resolves DB_* env from Secrets Manager secret episode-metadata/dev/database
 * via the instance role's default credential chain (FD-55 decision (b), scope
 * per FD-58). Consumed by deploy-dev.yml's on-box script:
 *     eval "$(node scripts/print-db-env.js)"
 *
 * CONTRACT:
 *   - stdout carries ONLY shell export lines — nothing else, ever. The caller
 *     evals stdout blind.
 *   - All diagnostics go to stderr.
 *   - FAIL-LOUD: on ANY error (secret unreachable, missing/empty key, parse
 *     failure) this exits non-zero having written ZERO bytes to stdout. A
 *     partial or empty export set silently eval'd is the RF-2 clobber-family
 *     failure (deploy-dev.yml header; Fix Plan v1.31): the eval must either
 *     yield a complete environment or visibly fail the deploy.
 *   - Carries no credentials. Reads via the instance role only.
 */

'use strict';

const AWS = require('aws-sdk');

const SECRET_ID = process.env.DB_SECRET_ID || 'episode-metadata/dev/database';
const REGION = process.env.AWS_REGION || 'us-east-1';

// secret JSON key -> exported env var (keys verified against the live secret,
// Fix Plan v1.36 session 2026-07-12; env names per src/config/sequelize.js,
// src/config/database.js, ecosystem.config.js)
const KEY_MAP = {
  host: 'DB_HOST',
  port: 'DB_PORT',
  dbname: 'DB_NAME',
  username: 'DB_USER',
  password: 'DB_PASSWORD',
};

/** Single-quote shell escaping: close quote, escaped literal quote, reopen. */
function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

async function main() {
  const sm = new AWS.SecretsManager({ region: REGION });

  let raw;
  try {
    const res = await sm.getSecretValue({ SecretId: SECRET_ID }).promise();
    raw = res.SecretString;
  } catch (err) {
    process.stderr.write(
      `print-db-env: FAILED to read secret ${SECRET_ID} (region ${REGION}): ` +
      `${err.code || err.name}: ${err.message}\n` +
      `print-db-env: no exports emitted; failing loudly per contract.\n`
    );
    process.exit(1);
  }

  if (!raw) {
    process.stderr.write(
      `print-db-env: secret ${SECRET_ID} has no SecretString (binary secret?). Failing.\n`
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(
      `print-db-env: secret ${SECRET_ID} SecretString is not valid JSON: ${err.message}\n`
    );
    process.exit(1);
  }

  const lines = [];
  const missing = [];
  for (const [secretKey, envName] of Object.entries(KEY_MAP)) {
    const value = parsed[secretKey];
    if (value === undefined || value === null || String(value).length === 0) {
      missing.push(secretKey);
    } else {
      lines.push(`export ${envName}=${shellQuote(value)}`);
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      `print-db-env: secret ${SECRET_ID} missing/empty key(s): ${missing.join(', ')}. ` +
      `No exports emitted (all-or-nothing per contract).\n`
    );
    process.exit(1);
  }

  // Single atomic write: stdout gets the complete set or nothing.
  process.stdout.write(lines.join('\n') + '\n');
  process.stderr.write(
    `print-db-env: resolved ${lines.length} DB_* exports from ${SECRET_ID} (values not shown).\n`
  );
}

main().catch((err) => {
  process.stderr.write(`print-db-env: unexpected failure: ${err && err.stack || err}\n`);
  process.exit(1);
});

'use strict';

const HEADING = '## Validation run (paste raw output, H1)';

const REQUIRED_COMMANDS = [
  'node scripts/validate-routes.js',
  'bash scripts/lint-silent-catches.sh',
  'bash scripts/audit-cost-exposure.sh',
  'node scripts/check-root-junk.js',
];

const EXIT_LINE = 'EXIT: 0';

// Finds a line strictly before `upTo` (and at or after `fromIndex`) whose
// trimmed content is exactly EXIT_LINE. Returns true/false — the boundary,
// not a cursor, is what keeps command N's exit line from being satisfied by
// a later command's own "EXIT: 0" line.
function hasExitLineInRange(text, fromIndex, upTo) {
  let lineStart = fromIndex;
  while (lineStart < upTo) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1 || lineEnd > upTo) lineEnd = upTo;
    if (text.slice(lineStart, lineEnd).trim() === EXIT_LINE) {
      return true;
    }
    lineStart = lineEnd + 1;
  }
  return false;
}

// Checks a PR body against the validation-block contract (issue #1488).
// Returns { ok: true } when the body makes no validation claim (no heading,
// or empty/null body) or satisfies the contract, otherwise
// { ok: false, reason } naming the specific missing command or exit line.
function checkValidationBlock(body) {
  if (!body || !body.includes(HEADING)) {
    return { ok: true };
  }

  const block = body.slice(body.indexOf(HEADING));

  // Resolve each command's position first (each search starts after the
  // previous command's own string), which is what enforces ordering.
  const commandIndexes = [];
  let cursor = 0;
  for (const command of REQUIRED_COMMANDS) {
    const commandIndex = block.indexOf(command, cursor);
    if (commandIndex === -1) {
      return { ok: false, reason: `missing command: \`${command}\`` };
    }
    commandIndexes.push(commandIndex);
    cursor = commandIndex + command.length;
  }

  // Then verify each command's exit line appears before the next command's
  // string (or before the end of the block, for the last command).
  for (let i = 0; i < REQUIRED_COMMANDS.length; i += 1) {
    const command = REQUIRED_COMMANDS[i];
    const searchFrom = commandIndexes[i] + command.length;
    const searchUpTo = i + 1 < commandIndexes.length ? commandIndexes[i + 1] : block.length;

    if (!hasExitLineInRange(block, searchFrom, searchUpTo)) {
      return {
        ok: false,
        reason: `missing \`${EXIT_LINE}\` line after \`${command}\``,
      };
    }
  }

  return { ok: true };
}

module.exports = { checkValidationBlock, HEADING, REQUIRED_COMMANDS, EXIT_LINE };

if (require.main === module) {
  const body = process.env.PR_BODY || '';
  const result = checkValidationBlock(body);

  if (result.ok) {
    console.log('PR validation block check passed.');
    process.exit(0);
  }

  console.error(`PR validation block check failed: ${result.reason}`);
  process.exit(1);
}

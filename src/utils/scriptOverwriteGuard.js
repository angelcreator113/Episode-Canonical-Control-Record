'use strict';

/**
 * Shared refusal check for script generators that replace the entire
 * episode.script_content with freshly-generated text, discarding whatever
 * was there before. Task #1622: with no schema change and no versioning
 * available yet (see docs/SCRIPT_PIPELINE.md §3, #1619), the only
 * protection against silently destroying an authored or hand-edited
 * script is refusing the replace unless the caller explicitly confirms it.
 *
 * Not applied to writers that update script_content without discarding
 * it (e.g. the /inject route, which only swaps its own [EVENT:]/
 * [LOCATION_HINT:] tag lines and preserves everything else) — those
 * aren't the silent-loss risk this guard exists for.
 */

const OVERWRITE_FLAG = 'confirmOverwrite';

function hasExistingScript(scriptContent) {
  return typeof scriptContent === 'string' && scriptContent.trim().length > 0;
}

function isOverwriteConfirmed(requestBody) {
  return requestBody?.[OVERWRITE_FLAG] === true;
}

/**
 * @param {string|null|undefined} existingScriptContent — episode.script_content as it stands now
 * @param {object} requestBody — the request body to check for the confirm flag
 * @returns {boolean} true if the write should be refused
 */
function scriptOverwriteBlocked(existingScriptContent, requestBody) {
  return hasExistingScript(existingScriptContent) && !isOverwriteConfirmed(requestBody);
}

function scriptOverwriteRefusalBody() {
  return {
    success: false,
    error: 'This episode already has a script. Resend with confirmOverwrite: true to replace it.',
    code: 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED',
  };
}

module.exports = {
  OVERWRITE_FLAG,
  scriptOverwriteBlocked,
  scriptOverwriteRefusalBody,
};

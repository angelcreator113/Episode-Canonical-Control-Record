/**
 * Test helper (issue #3714): preloaded with `node -r` into a child process,
 * records every module file the process loads and, when it exits, writes the
 * list as JSON to the file named by TRACE_REQUIRES_OUT. Used to prove a
 * disabled worker never loads the models, the scene worker, the video
 * renderer, Bull, pg or an AI SDK.
 */
'use strict';

const fs = require('fs');
const Module = require('module');

const out = process.env.TRACE_REQUIRES_OUT;
const loaded = new Set();
const original = Module._load;

Module._load = function traced(request, parent, isMain) {
  try {
    loaded.add(Module._resolveFilename(request, parent, isMain));
  } catch (err) {
    loaded.add(`unresolved:${request}:${err.code || 'error'}`);
  }
  return original.apply(this, arguments);
};

process.on('exit', () => {
  if (out) fs.writeFileSync(out, JSON.stringify([...loaded]));
});

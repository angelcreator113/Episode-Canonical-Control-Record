/**
 * The footage-only worker is isolated (Voice plan V2; Evoni, 2026-10-30:
 * "cannot start scene generation, paid Claude jobs, or video exports").
 *
 * Each check runs in a fresh Node process, so what it lists is exactly
 * what loading the worker loads: none of episode-worker's pieces (scene
 * generation, video export, Bull/Redis queues), no AI SDK or cost tracker,
 * no ElevenLabs, no feed scheduler. The process connects to no database
 * (models are only defined), and the flag-off worker loads not even the
 * models. ecosystem.config.js and episode-worker's start.js never name it,
 * so `pm2 start ecosystem.config.js` and the existing worker never start it.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const FORBIDDEN = /sceneGenerationWorker|videoRenderer|src\/workers\/start|\/src\/queues\/|node_modules\/(bull|bullmq|ioredis|redis)\/|@anthropic-ai|aiCostTracker|feedScheduler|amberSession|elevenlabs|cfoAgent|pulseQueue/i;

/** Loads `code` in a fresh process with the given flags; resolves the project files and packages it loaded. */
function loaded(code, env = {}) {
  const script = `${code}
    setTimeout(() => {
      const ks = Object.keys(require.cache).map((k) => k.replace(${JSON.stringify(ROOT)}, '.'));
      process.stdout.write('\\n@@' + JSON.stringify(ks));
      process.exit(0);
    }, 300);`;
  const out = execFileSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, NODE_ENV: 'test', DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/never', ...env },
    encoding: 'utf8',
    timeout: 60000,
  });
  return JSON.parse(out.slice(out.lastIndexOf('@@') + 2));
}

describe('the footage-only worker loads nothing else', () => {
  test('switched on: its services and the models only; no scene generation, export, queues, AI or ElevenLabs', () => {
    const mods = loaded(`
      const w = require('./src/workers/voiceFootageWorker');
      require('./src/services/voiceFootageExtract');
      require('./src/services/rawClipMedia');
      require('./src/services/voiceStudioService');
      require('./src/models');
    `, { VOICE_FROM_FOOTAGE: 'on', VOICE_STUDIO: 'on' });
    expect(mods.some((m) => m.endsWith('src/workers/voiceFootageWorker.js'))).toBe(true);
    expect(mods.filter((m) => FORBIDDEN.test(m))).toEqual([]);
  }, 60000);

  test('switched off: main() idles and loads not even the models', () => {
    const mods = loaded(`
      const w = require('./src/workers/voiceFootageWorker');
      w.main();
    `, { VOICE_FROM_FOOTAGE: '', VOICE_STUDIO: 'on' });
    expect(mods.some((m) => /\/src\/models\/index\.js$/.test(m))).toBe(false);
    expect(mods.filter((m) => FORBIDDEN.test(m))).toEqual([]);
  }, 60000);

  test('nothing starts it by accident: not in ecosystem.config.js, not in episode-worker, not in the API', () => {
    const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(read('ecosystem.config.js')).not.toMatch(/voiceFootageWorker|voice-worker/);
    expect(read('ecosystem.dev.config.js')).not.toMatch(/voiceFootageWorker|voice-worker/);
    // Code that loads it (a comment naming the file is fine).
    const loads = /require\([^)]*voiceFootageWorker/;
    expect(read('src/workers/start.js')).not.toMatch(/voiceFootage/);
    expect(read('src/app.js')).not.toMatch(loads);
    expect(read('src/server.js')).not.toMatch(loads);
  });
});

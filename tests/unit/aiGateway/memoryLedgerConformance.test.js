'use strict';

/**
 * The reference ledger against the shared G2 contract (ledgerConformance.js).
 * The Postgres ledger runs the same contract in
 * tests/integration/aigwLedger.integration.test.js.
 */

const { createReferenceLedger } = require('../../../src/aiGateway/memoryLedger');
const { withLimits } = require('../../../src/aiGateway/constants');
const { makeClock, deterministicBytes } = require('./_harness');
const { defineLedgerConformance } = require('./ledgerConformance');

defineLedgerConformance('in-memory reference', async () => {
  const clock = makeClock();
  const s = { released: false };
  const caps = { dailyMicros: null, imageDailyMicros: null };
  const ledger = createReferenceLedger({
    clock, caps, readSafety: () => ({ state: { allowSubmissions: s.released } }),
    limits: withLimits({ permitTtlMs: 1000 }), randomBytes: deterministicBytes(11),
  });
  return {
    ledger,
    release: async () => { s.released = true; },
    stop: async () => { s.released = false; },
    setCaps: async ({ dailyMicros, imageDailyMicros }) => { caps.dailyMicros = dailyMicros; caps.imageDailyMicros = imageDailyMicros; },
    expire: async () => clock.advance(1500),
    reconcile: (id, opts) => ledger.reconcile(id, opts),
    close: async () => {},
  };
});

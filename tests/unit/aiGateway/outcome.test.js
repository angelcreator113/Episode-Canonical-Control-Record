'use strict';

const { classifyOutcome } = require('../../../src/aiGateway/outcome');

describe('gateway outcome classification', () => {
  test.each([
    ['DNS failure', { kind: 'error', code: 'ENOTFOUND' }, 'not_sent'],
    ['DNS retry', { kind: 'error', code: 'EAI_AGAIN' }, 'not_sent'],
    ['connection refused', { kind: 'error', code: 'ECONNREFUSED' }, 'not_sent'],
    ['TLS certificate failure', { kind: 'error', code: 'CERT_HAS_EXPIRED' }, 'not_sent'],
    ['pre-send code but bytes were written', { kind: 'error', code: 'ECONNREFUSED', requestBytesWritten: true }, 'unknown'],
    ['timeout', { kind: 'error', code: 'ETIMEDOUT' }, 'unknown'],
    ['axios timeout', { kind: 'error', code: 'ECONNABORTED' }, 'unknown'],
    ['reset', { kind: 'error', code: 'ECONNRESET' }, 'unknown'],
    ['broken pipe', { kind: 'error', code: 'EPIPE' }, 'unknown'],
    ['error without a code', { kind: 'error' }, 'unknown'],
    ['caller disconnected', { kind: 'disconnect' }, 'unknown'],
    ['upstream closed early', { kind: 'upstream_closed' }, 'unknown'],
    ['stream ended without final usage', { kind: 'stream_incomplete' }, 'unknown'],
    ['429', { kind: 'response', status: 429 }, 'unknown'],
    ['408', { kind: 'response', status: 408 }, 'unknown'],
    ['409', { kind: 'response', status: 409 }, 'unknown'],
    ['500', { kind: 'response', status: 500 }, 'unknown'],
    ['503', { kind: 'response', status: 503 }, 'unknown'],
    ['529 overloaded', { kind: 'response', status: 529 }, 'unknown'],
    ['2xx without its result', { kind: 'response', status: 200, resultPresent: false }, 'unknown'],
    ['2xx with a task id', { kind: 'response', status: 200, resultPresent: true, taskId: 't1' }, 'accepted'],
    ['2xx with a synchronous result', { kind: 'response', status: 200, resultPresent: true }, 'provider_succeeded'],
    ['400 validation rejection', { kind: 'response', status: 400 }, 'failed_confirmed'],
    ['401', { kind: 'response', status: 401 }, 'failed_confirmed'],
    ['3xx', { kind: 'response', status: 302 }, 'unknown'],
    ['missing status', { kind: 'response' }, 'unknown'],
    ['no evidence at all', {}, 'unknown'],
  ])('%s -> %s', (_l, evidence, phase) => {
    const r = classifyOutcome(evidence);
    expect(r.phase).toBe(phase);
    expect(r.retryAllowed).toBe(phase === 'not_sent');
  });
});

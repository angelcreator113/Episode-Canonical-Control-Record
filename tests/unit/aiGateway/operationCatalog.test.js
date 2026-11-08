'use strict';

const { OPERATIONS, resolveOperation, operationById, cacheTtls } = require('../../../src/aiGateway/operationCatalog');

describe('operation catalogue (allowlist)', () => {
  test.each([
    ['api.anthropic.com', 'POST', '/v1/messages', 'anthropic.messages', 'submission'],
    ['api.openai.com', 'POST', '/v1/images/generations', 'openai.images.generations', 'submission'],
    ['api.openai.com', 'POST', '/v1/images/edits', 'openai.images.edits', 'submission'],
    ['fal.run', 'POST', '/fal-ai/flux/dev', 'fal.run', 'submission'],
    ['fal.run', 'POST', '/fal-ai/flux-pro/v1.1', 'fal.run', 'submission'],
    ['fal.run', 'POST', '/fal-ai/flux-pro/kontext', 'fal.run', 'submission'],
    ['api.dev.runwayml.com', 'POST', '/v1/image_to_video', 'runway.image_to_video', 'submission'],
    ['api.dev.runwayml.com', 'GET', '/v1/tasks/abc-123', 'runway.task_status', 'status'],
    ['api.replicate.com', 'POST', '/v1/predictions', 'replicate.predictions.create', 'submission'],
    ['api.replicate.com', 'POST', '/v1/models/meta/sam-2-large/predictions', 'replicate.models.predictions.create', 'submission'],
    ['api.replicate.com', 'GET', '/v1/predictions/abc123', 'replicate.prediction_status', 'status'],
    ['api.elevenlabs.io', 'POST', '/v1/text-to-speech/voice123', 'elevenlabs.tts', 'submission'],
    ['api.remove.bg', 'POST', '/v1.0/removebg', 'removebg', 'submission'],
  ])('%s %s %s -> %s (%s)', (host, method, path, id, cls) => {
    const r = resolveOperation({ host, method, path });
    expect(r).not.toBeNull();
    expect(r.operation.id).toBe(id);
    expect(r.operation.cls).toBe(cls);
  });

  test.each([
    ['cancel a Replicate prediction', 'api.replicate.com', 'POST', '/v1/predictions/abc/cancel'],
    ['Anthropic count_tokens', 'api.anthropic.com', 'POST', '/v1/messages/count_tokens'],
    ['Anthropic batches', 'api.anthropic.com', 'POST', '/v1/messages/batches'],
    ['Runway remove-background (unverified, S5)', 'api.runwayml.com', 'POST', '/v1/remove-background'],
    ['Runway delete task', 'api.dev.runwayml.com', 'DELETE', '/v1/tasks/abc'],
    ['an unlisted fal model', 'fal.run', 'POST', '/fal-ai/some-other-model'],
    ['a query string', 'api.anthropic.com', 'POST', '/v1/messages?beta=true'],
    ['the wrong host', 'evil.example.com', 'POST', '/v1/messages'],
    ['the wrong method', 'api.anthropic.com', 'GET', '/v1/messages'],
    ['path traversal', 'api.dev.runwayml.com', 'GET', '/v1/tasks/../../admin'],
  ])('%s is refused (not allowlisted)', (_label, host, method, path) => {
    expect(resolveOperation({ host, method, path })).toBeNull();
  });

  test('every operation has a class, host, method and path; submissions declare a body kind', () => {
    for (const op of OPERATIONS) {
      expect(['submission', 'status']).toContain(op.cls);
      expect(typeof op.host).toBe('string');
      expect(op.path).toBeInstanceOf(RegExp);
      if (op.cls === 'submission') expect(['json', 'multipart']).toContain(op.bodyKind);
      if (op.cls === 'submission' && op.bodyKind === 'json') expect(typeof op.billingFields).toBe('function');
      if (op.cls === 'status') expect(Number.isInteger(op.taskRefGroup)).toBe(true);
    }
    expect(operationById('nope')).toBeNull();
  });

  test('Anthropic billing fields bind model, max_tokens, stream, tier, tools and cache TTLs', () => {
    const op = operationById('anthropic.messages');
    const f = op.billingFields({
      model: 'm', max_tokens: 9, stream: true, tools: [{}, {}],
      system: [{ type: 'text', text: 'x', cache_control: { type: 'ephemeral', ttl: '1h' } }],
      messages: [{ role: 'user', content: [{ type: 'text', text: 'y', cache_control: { type: 'ephemeral' } }] }],
    });
    expect(f).toEqual({ model: 'm', max_tokens: 9, stream: true, service_tier: null, tools: 2, cache_ttls: ['1h', '5m'] });
    expect(cacheTtls({})).toEqual([]);
  });
});

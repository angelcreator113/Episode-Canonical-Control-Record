/**
 * SEC-2 (Evoni's admin-only ruling, 2026-10-29): the asset-roles registry
 * (/api/v1/roles) and the configuration check (/api/v1/assets/config/check)
 * are admin only. Both were optionalAuth, so anyone could create, change,
 * delete or bulk-assign roles, and read the first 8 characters of the AWS
 * access key ID. The real routers and auth middleware; services and models
 * are stand-ins, so no database is touched.
 */
jest.mock('../../../src/services/AssetRoleService', () => ({
  getRolesForShow: jest.fn(async () => []),
  getRoleUsageStats: jest.fn(async () => ({})),
  getRoleByKey: jest.fn(async () => ({ role_key: 'HOST' })),
  createRole: jest.fn(async () => ({ role_key: 'NEW' })),
  updateRole: jest.fn(async () => ({ role_key: 'HOST' })),
  deleteRole: jest.fn(async () => ({ deleted: true })),
  bulkAssignRoles: jest.fn(async () => ({ succeeded: 1, failed: 0, errors: [] })),
  getAssetsByRole: jest.fn(async () => []),
  validateRequiredRoles: jest.fn(async () => ({ valid: true })),
}));
jest.mock('../../../src/services/AssetService', () => ({}));
jest.mock('../../../src/models', () => ({ models: {} }));
jest.mock('../../../src/services/imageCostService', () => ({ isBudgetError: () => false }));

const express = require('express');
const request = require('supertest');
const TokenService = require('../../../src/services/tokenService');
const roleService = require('../../../src/services/AssetRoleService');

const app = express();
app.use(express.json());
app.use('/api/v1/roles', require('../../../src/routes/roles'));
app.use('/api/v1/assets', require('../../../src/routes/assets'));

const token = (groups) => TokenService.generateTokenPair({ id: `sec2-${groups.join('-') || 'none'}`, email: 'sec2@test.dev', name: 'sec2', groups, role: groups[0] }).accessToken;
const SHOW = '00000000-0000-0000-0000-000000000001';

const ROUTES = [
  ['get', `/api/v1/roles?show_id=${SHOW}`],
  ['get', `/api/v1/roles/stats?show_id=${SHOW}`],
  ['get', `/api/v1/roles/HOST?show_id=${SHOW}`],
  ['post', '/api/v1/roles', { show_id: SHOW, role_key: 'NEW', role_label: 'New' }],
  ['put', '/api/v1/roles/HOST', { show_id: SHOW, role_label: 'Changed' }],
  ['delete', `/api/v1/roles/HOST?show_id=${SHOW}`],
  ['post', '/api/v1/roles/bulk-assign', { assignments: [{ assetId: 'a', roleKey: 'HOST' }] }],
  ['get', `/api/v1/roles/HOST/assets?show_id=${SHOW}`],
  ['post', '/api/v1/roles/validate-required', { show_id: SHOW, providedRoles: {} }],
  ['get', '/api/v1/assets/config/check'],
];
const send = ([method, url, body], auth) => {
  let r = request(app)[method](url);
  if (auth) r = r.set('Authorization', `Bearer ${auth}`);
  return body ? r.send(body) : r;
};

describe('SEC-2: roles and config check are admin only', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each(ROUTES.map((r) => [`${r[0].toUpperCase()} ${r[1].split('?')[0]}`, r]))('%s: 401 without sign-in, 403 for a non-admin, nothing called', async (_name, route) => {
    expect((await send(route, null)).status).toBe(401);
    expect((await send(route, token(['USER']))).status).toBe(403);
    for (const fn of Object.values(roleService)) expect(fn).not.toHaveBeenCalled();
  });

  test('an admin reaches every roles route', async () => {
    for (const route of ROUTES.slice(0, 9)) {
      // eslint-disable-next-line no-await-in-loop
      const res = await send(route, token(['ADMIN']));
      expect([401, 403]).not.toContain(res.status);
    }
  });

  test('the config check answers an admin without any part of the AWS key ID', async () => {
    const prev = process.env.AWS_ACCESS_KEY_ID;
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLEKEYID1234';
    try {
      const res = await send(ROUTES[9], token(['ADMIN']));
      expect(res.status).toBe(200);
      expect(res.body.data.awsAccessKeyId).toBe('configured');
      expect(JSON.stringify(res.body)).not.toContain('AKIAEXAM');
    } finally {
      if (prev === undefined) delete process.env.AWS_ACCESS_KEY_ID; else process.env.AWS_ACCESS_KEY_ID = prev;
    }
  });
});

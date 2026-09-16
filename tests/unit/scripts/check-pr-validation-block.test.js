const { checkValidationBlock } = require('../../../scripts/check-pr-validation-block');

const VALID_BODY = `Some PR description.

## Validation run (paste raw output, H1)

$ node scripts/validate-routes.js
All routes registered.
EXIT: 0

$ bash scripts/lint-silent-catches.sh
No silent catches found.
EXIT: 0

$ bash scripts/audit-cost-exposure.sh
No cost exposure findings.
EXIT: 0

$ node scripts/check-root-junk.js
No root junk found.
EXIT: 0
`;

describe('checkValidationBlock', () => {
  it('passes when the body has no heading', () => {
    const body = 'Just a regular PR description with no validation claim.';
    expect(checkValidationBlock(body)).toEqual({ ok: true });
  });

  it('passes for a correct body', () => {
    expect(checkValidationBlock(VALID_BODY)).toEqual({ ok: true });
  });

  it('fails when a variant like (exit 0) is used instead of EXIT: 0', () => {
    const body = VALID_BODY.replace(
      '$ node scripts/validate-routes.js\nAll routes registered.\nEXIT: 0',
      '$ node scripts/validate-routes.js\nAll routes registered.\n(exit 0)'
    );
    const result = checkValidationBlock(body);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('node scripts/validate-routes.js');
  });

  it('fails when the third command is missing', () => {
    const body = VALID_BODY.replace(
      '$ bash scripts/audit-cost-exposure.sh\nNo cost exposure findings.\nEXIT: 0\n\n',
      ''
    );
    const result = checkValidationBlock(body);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('bash scripts/audit-cost-exposure.sh');
  });

  it('fails when the four commands are out of order', () => {
    const body = `## Validation run (paste raw output, H1)

$ bash scripts/lint-silent-catches.sh
No silent catches found.
EXIT: 0

$ node scripts/validate-routes.js
All routes registered.
EXIT: 0

$ bash scripts/audit-cost-exposure.sh
No cost exposure findings.
EXIT: 0

$ node scripts/check-root-junk.js
No root junk found.
EXIT: 0
`;
    const result = checkValidationBlock(body);
    expect(result.ok).toBe(false);
  });

  it('passes for an empty body', () => {
    expect(checkValidationBlock('')).toEqual({ ok: true });
    expect(checkValidationBlock(null)).toEqual({ ok: true });
    expect(checkValidationBlock(undefined)).toEqual({ ok: true });
  });
});

// Task #2139 — cleanEventName, the one quotation-mark cleanup shared by the
// creation draft and the suggest-names handler. The #2137 cases.
const { cleanEventName } = require('../../../src/utils/cleanEventName');

describe('cleanEventName', () => {
  test('apostrophes inside the name are kept, straight and curly', () => {
    expect(cleanEventName("Maya's Golden Hour")).toBe("Maya's Golden Hour");
    expect(cleanEventName('Maya’s Golden Hour')).toBe('Maya’s Golden Hour');
  });

  test('single quotes wrapping the whole name are stripped', () => {
    expect(cleanEventName("'Golden Hour'")).toBe('Golden Hour');
    expect(cleanEventName('‘Golden Hour’')).toBe('Golden Hour');
  });

  test('a lone single quote at one end is left as written', () => {
    expect(cleanEventName("Golden Hour'")).toBe("Golden Hour'");
  });

  test('double quotes, straight and curly, are stripped anywhere', () => {
    expect(cleanEventName('"Golden Hour"')).toBe('Golden Hour');
    expect(cleanEventName('“Golden  "Hour"”')).toBe('Golden Hour');
    expect(cleanEventName('“Maya’s Golden Hour”')).toBe('Maya’s Golden Hour');
    expect(cleanEventName(`"'Golden Hour'"`)).toBe('Golden Hour');
  });

  test('whitespace is collapsed and trimmed; empty or non-string gives \'\'', () => {
    expect(cleanEventName('  Golden   Hour  ')).toBe('Golden Hour');
    expect(cleanEventName('"“”"')).toBe('');
    expect(cleanEventName(undefined)).toBe('');
    expect(cleanEventName(42)).toBe('');
  });
});

import { describe, test, expect } from 'vitest';
import { formFromShow, formErrors, showUpdate, saveErrorText, isColor, STATUSES } from './showEdit';

const SHOW = {
  id: 's1', name: 'Styling Adventures with Lala', description: 'Lala styles events.', genre: 'Fashion',
  status: 'active', icon: '👗', color: '#5B4B8A',
  metadata: { tagline: 'Every event, a look', required_slots: ['body', 'shoes'], lala_home: { city: 'Echo Park' } },
};

describe('showEdit (Evoni, 2026-10-07)', () => {
  test('the form reads the show\'s own fields, the tagline from metadata', () => {
    expect(formFromShow(SHOW)).toEqual({
      name: 'Styling Adventures with Lala', tagline: 'Every event, a look', description: 'Lala styles events.',
      genre: 'Fashion', status: 'active', icon: '👗', color: '#5B4B8A',
    });
    // An unknown status or a bad colour does not reach the form.
    expect(formFromShow({ name: 'X', status: 'draft', color: 'blue' })).toMatchObject({ status: 'active', color: '' });
    expect(formFromShow({ name: 'X', metadata: '{"tagline":"t"}' }).tagline).toBe('t');
  });

  test('only the name is required; a colour must be #RRGGBB; the status one of the four', () => {
    expect(formErrors(formFromShow(SHOW))).toEqual({});
    expect(formErrors({ ...formFromShow(SHOW), name: ' ' })).toHaveProperty('name');
    expect(formErrors({ ...formFromShow(SHOW), description: '', genre: '' })).toEqual({});
    expect(formErrors({ ...formFromShow(SHOW), color: '#12' })).toHaveProperty('color');
    expect(formErrors({ ...formFromShow(SHOW), status: 'draft' })).toHaveProperty('status');
    expect(STATUSES.map((s) => s.value)).toEqual(['active', 'in_development', 'archived', 'cancelled']);
    expect(isColor('#a1b2c3')).toBe(true);
  });

  test('the save keeps the show\'s settings in metadata and sends only its own fields', () => {
    const body = showUpdate({ ...formFromShow(SHOW), name: ' New name ', tagline: 'A new line', genre: '' }, SHOW);
    expect(body).toEqual({
      name: 'New name', description: 'Lala styles events.', genre: null, status: 'active', icon: '👗', color: '#5B4B8A',
      metadata: { tagline: 'A new line', required_slots: ['body', 'shoes'], lala_home: { city: 'Echo Park' } },
    });
    expect(Object.keys(body)).not.toContain('category');
    expect(Object.keys(body)).not.toContain('primaryColor');
    expect(showUpdate({ ...formFromShow(SHOW), tagline: '' }, SHOW).metadata).not.toHaveProperty('tagline');
  });

  test('save errors in plain words', () => {
    expect(saveErrorText({ response: { data: { message: 'Validation error: name must be unique' } } })).toBe('Another show already has that name.');
    expect(saveErrorText({ message: 'Network Error' })).toMatch(/Couldn't reach the server/);
    expect(saveErrorText({ response: { data: { error: 'Failed to update show', message: 'boom' } } })).toBe("The show wasn't saved: boom");
  });
});

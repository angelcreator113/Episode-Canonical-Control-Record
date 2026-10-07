/** Uploading several angles at once: names and labels from the files. */
import { describe, test, expect } from 'vitest';
import { angleNameFromFile, uniqueAngleLabel, uploadedAnglePayloads } from './angleUpload';

describe('angle upload names', () => {
  test('a file name becomes a readable angle name', () => {
    expect(angleNameFromFile('front-door_v2.JPG')).toBe('Front door v2');
    expect(angleNameFromFile('.png', 2)).toBe('Uploaded angle 3');
  });

  test('labels are capitals with underscores, unique against the set', () => {
    expect(uniqueAngleLabel('Front door v2', [])).toBe('FRONT_DOOR_V2');
    expect(uniqueAngleLabel('Wide', ['WIDE', 'wide_2'])).toBe('WIDE_3');
    expect(uniqueAngleLabel('', [])).toBe('UPLOAD');
  });

  test('payloads keep file order and never repeat a label', () => {
    const files = [{ name: 'garden.jpg' }, { name: 'garden.png' }, { name: 'Pool view.webp' }];
    expect(uploadedAnglePayloads(files, ['GARDEN'])).toEqual([
      { angle_name: 'Garden', angle_label: 'GARDEN_2', angle_description: 'Uploaded image' },
      { angle_name: 'Garden', angle_label: 'GARDEN_3', angle_description: 'Uploaded image' },
      { angle_name: 'Pool view', angle_label: 'POOL_VIEW', angle_description: 'Uploaded image' },
    ]);
  });
});

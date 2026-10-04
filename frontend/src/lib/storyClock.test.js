import { describe, test, expect } from 'vitest';
import { postOrder, storyLabel } from './storyClock';

describe('storyClock (screens)', () => {
  test('a post\'s story label from its stamp or its episode', () => {
    expect(storyLabel(postOrder({ story_order: 27 }))).toBe('After Ep 2');
    expect(storyLabel(postOrder({ episode_id: 'e', episode: { episode_number: 3 }, timeline_position: 'before_episode' }))).toBe('Before Ep 3');
    expect(storyLabel(postOrder({ episode_id: 'e', episode: { episode_number: 3 } }))).toBe('During Ep 3');
    expect(storyLabel(postOrder({ story_order: 7 }))).toBe('Backstory');
    expect(storyLabel(postOrder({}))).toBeNull();
  });
});

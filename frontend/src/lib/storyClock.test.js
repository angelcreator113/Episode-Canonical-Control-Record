import { describe, test, expect } from 'vitest';
import { postOrder, storyLabel, beatOrder } from './storyClock';

describe('storyClock (screens)', () => {
  test('a post\'s story label from its stamp or its episode', () => {
    expect(storyLabel(postOrder({ story_order: 27 }))).toBe('After Ep 2');
    expect(storyLabel(postOrder({ episode_id: 'e', episode: { episode_number: 3 }, timeline_position: 'before_episode' }))).toBe('Before Ep 3');
    expect(storyLabel(postOrder({ episode_id: 'e', episode: { episode_number: 3 } }))).toBe('During Ep 3');
    expect(storyLabel(postOrder({ story_order: 7 }))).toBe('Backstory');
    expect(storyLabel(postOrder({}))).toBeNull();
  });
  test("an event's moments: Announced, Invitation sent, Lala arrives (Task 2937)", () => {
    expect(storyLabel(32)).toBe('Announced Ep 3');
    expect(storyLabel(33)).toBe('Invitation sent Ep 3');
    expect(storyLabel(34)).toBe('Lala arrives Ep 3');
  });

  test("a beat's story order is its episode's During, as the server's (Task 2986)", () => {
    expect(beatOrder(1)).toBe(15);
    expect(beatOrder('3')).toBe(35);
    expect(beatOrder(null)).toBeNull();
    expect(beatOrder(undefined)).toBeNull();
    expect(beatOrder('')).toBeNull();
    expect(beatOrder('x')).toBeNull();
  });
});

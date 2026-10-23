/**
 * The Person tab's sections (Evoni, 2026-10-23, "one person page"): who
 * they are, their Pulse account, relationships, episode history and what
 * the writers know, each from the one read GET /api/v1/person/:id.
 */
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PersonWho, { roleOf } from './PersonWho';
import PersonPulse from './PersonPulse';
import PersonRelationships, { knowsLine } from './PersonRelationships';
import PersonEpisodes from './PersonEpisodes';
import PersonWriters from './PersonWriters';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Who they are', () => {
  const WHO = { name: 'Marcus Hale', online_as: 'Truthville', aliases: ['Truth', 'M.H.'], role_type: 'support', summary: 'A producer who never says what he wants.' };

  test('name, online name, also known as, role and a line about them', () => {
    wrap(<PersonWho who={WHO} />);
    const sec = screen.getByTestId('person-who');
    expect(within(sec).getByText('Marcus Hale')).toBeTruthy();
    expect(within(sec).getByText('Truthville')).toBeTruthy();
    expect([...sec.querySelectorAll('.pw-aka')].map((e) => e.textContent)).toEqual(['Truth', 'M.H.']);
    expect(within(sec).getByText('Supporting')).toBeTruthy();
    expect(within(sec).getByText('A producer who never says what he wants.')).toBeTruthy();
  });

  test('no other names, no line yet: says so, and Overview is one tap away', () => {
    const openTab = vi.fn();
    wrap(<PersonWho who={{ name: 'Dre', aliases: [], role_type: null }} openTab={openTab} />);
    expect(screen.getByText('No other names recorded.')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Write who they are on Overview' }));
    expect(openTab).toHaveBeenCalledWith('overview');
  });

  test('the role as The cast says it', () => {
    expect(roleOf({ is_lala: true, role_type: 'special' })).toBe('Protagonist');
    expect(roleOf({ role_label: 'The peer', role_type: 'support' })).toBe('The peer');
    expect(roleOf({ role_type: 'villain' })).toBe('Villain');
    expect(roleOf({})).toBeNull();
  });
});

describe('Their Pulse account', () => {
  const PULSE = { id: 7, handle: 'truthville', display_name: 'Truthville', platform: 'instagram', follower_tier: 'micro', follower_count: '48K', link: '/pulse?profile=7' };

  test('handle, followers, their tie to Lala and a link to the profile', () => {
    wrap(<PersonPulse pulse={PULSE} lalaTie={{ from: 'story', tie: 'direct', words: 'love interest, love interest, now lovers' }} />);
    const sec = screen.getByTestId('person-pulse');
    expect(within(sec).getByText('@truthville')).toBeTruthy();
    expect(within(sec).getByText('Micro · 48K')).toBeTruthy();
    expect(sec.textContent).toContain('love interest, love interest, now lovers (from their relationship)');
    expect(within(sec).getByRole('link', { name: /Open their Pulse profile/ }).getAttribute('href')).toBe('/pulse?profile=7');
  });

  test('Lala herself has no tie to Lala', () => {
    wrap(<PersonPulse pulse={PULSE} lalaTie={null} isLala />);
    expect(screen.queryByText('With Lala')).toBeNull();
  });

  test('none: "Not on the Pulse yet" and where to match one', () => {
    wrap(<PersonPulse pulse={null} lalaTie={null} />);
    expect(screen.getByText('Not on the Pulse yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Match them to a Pulse person on The cast' }).getAttribute('href')).toBe('/character-registry');
  });
});

describe('Relationships', () => {
  const RELS = [
    { id: 'r1', other: { id: 'lala', name: 'Lala' }, kind: 'love interest', stage: 'lovers', love_interest: true, public_state: 'secret', public_label: 'Secret',
      known_by: ['Jade Monroe'], online: { differs: true, says: 'bestie' }, link: '/relationships?rel=r1' },
    { id: 'r2', other: { id: 'jade', name: 'Jade Monroe' }, kind: 'sister', stage: null, love_interest: false, public_state: 'rumoured', public_label: 'Rumoured',
      known_by: [], online: { differs: false, says: 'family' }, link: '/relationships?rel=r2' },
  ];

  test('each with its stage, heart, who knows, different online, and a link to it', () => {
    wrap(<PersonRelationships characterId="c1" relationships={RELS} />);
    const r1 = screen.getByTestId('prl-r1');
    expect(r1.getAttribute('href')).toBe('/relationships?rel=r1');
    expect(within(r1).getByRole('img', { name: 'Love interest' })).toBeTruthy();
    expect(within(r1).getByText('now lovers')).toBeTruthy();
    expect(within(r1).getByText('Secret')).toBeTruthy();
    expect(within(r1).getByText('Different online').getAttribute('title')).toBe('On The Pulse: bestie');
    expect(r1.textContent).toContain('Jade Monroe knows.');

    const r2 = screen.getByTestId('prl-r2');
    expect(within(r2).queryByRole('img', { name: 'Love interest' })).toBeNull();
    expect(within(r2).getByText('Rumoured')).toBeTruthy();
    expect(within(r2).queryByText('Different online')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open in Relationships' }).getAttribute('href')).toBe('/relationships?char=c1');
  });

  test('who knows, in words', () => {
    expect(knowsLine({ known_by: [], public_state: 'secret' })).toBe('Only the two of them know.');
    expect(knowsLine({ known_by: [], public_state: 'known' })).toBeNull();
    expect(knowsLine({ known_by: ['Jade', 'Dre', 'Nia'] })).toBe('Jade, Dre and Nia know.');
  });

  test('none yet', () => {
    wrap(<PersonRelationships characterId="c1" relationships={[]} />);
    expect(screen.getByText('No confirmed relationships yet.')).toBeTruthy();
  });
});

describe('Episode history', () => {
  const EPS = [
    { id: 'e3', episode_number: 3, title: 'Rooftop', via: ['guest'], record: null, changes: [], events: [{ id: 'v1', name: 'Rooftop Launch', role: 'guest' }], link: '/episodes/e3' },
    { id: 'e2', episode_number: 2, title: 'The Gala', via: ['story record'], record: { status: 'draft', knew: 'Lala was seeing someone', learned: 'it was him', changed: null }, changes: [], events: [], link: '/episodes/e2' },
    { id: 'e1', episode_number: 1, title: 'Pilot', via: ['relationship'], record: null, changes: [{ relationship_id: 'r1', with: 'Lala', stage: 'flirting → lovers', note: 'They kissed.' }], events: [], link: '/episodes/e1' },
  ];

  test('newest first, each with what changed for them and an "Episode N" link', () => {
    wrap(<PersonEpisodes episodes={EPS} />);
    const items = screen.getAllByRole('listitem').filter((li) => li.classList.contains('pep-item'));
    expect(items.map((li) => li.querySelector('.pep-num').textContent)).toEqual(['Episode 3', 'Episode 2', 'Episode 1']);
    expect(within(items[0]).getByRole('link', { name: /Episode 3/ }).getAttribute('href')).toBe('/episodes/e3');
    expect(within(items[0]).getByText('Guest at the event')).toBeTruthy();
    expect(within(items[0]).getByText('Rooftop Launch')).toBeTruthy();
    expect(within(items[0]).getByText('Nothing recorded for them in this episode yet.')).toBeTruthy();
    expect(within(items[1]).getByText('Lala was seeing someone')).toBeTruthy();
    expect(within(items[1]).getByText('it was him')).toBeTruthy();
    expect(within(items[1]).queryByText('Changed')).toBeNull();
    expect(within(items[1]).getByText('Record not saved yet')).toBeTruthy();
    expect(items[2].textContent).toContain('With Lala: flirting → lovers — They kissed.');
  });

  test('none yet', () => {
    wrap(<PersonEpisodes episodes={[]} />);
    expect(screen.getByText('Not in an episode yet.')).toBeTruthy();
  });
});

describe('What the writers know', () => {
  test("the script writer's lines, word for word", () => {
    wrap(<PersonWriters writers={{
      in_cast_block: true,
      lala: ['With Lala in the story: love interest (They kiss)', 'With Lala: love interest: They kiss'],
      family: ["Marcus: Jade's brother"], family_block: "THEIR FAMILY (stay consistent with it):\n- Marcus: Jade's brother",
      secrecy: ["Lala and Marcus's romance is SECRET: only Jade knows. Nobody else mentions it."],
    }} />);
    const pres = [...screen.getByTestId('person-writers').querySelectorAll('pre')].map((p) => p.textContent);
    expect(pres).toEqual([
      'With Lala in the story: love interest (They kiss)\nWith Lala: love interest: They kiss',
      "THEIR FAMILY (stay consistent with it):\n- Marcus: Jade's brother",
      "- Lala and Marcus's romance is SECRET: only Jade knows. Nobody else mentions it.",
    ]);
    expect(screen.queryByTestId('pwr-no-cast')).toBeNull();
  });

  test('no Pulse profile: only the who-knows lines reach a script', () => {
    wrap(<PersonWriters writers={{ in_cast_block: false, lala: [], family: [], family_block: null, secrecy: [] }} />);
    expect(screen.getByTestId('pwr-no-cast')).toBeTruthy();
    expect(screen.getByText('Nothing about them yet beyond their profile.')).toBeTruthy();
  });
});

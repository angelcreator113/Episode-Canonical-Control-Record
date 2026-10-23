/**
 * The person read's pieces (Evoni, 2026-10-23, "one person page", shown in
 * the tabs they belong to): the header's also-known-as and one line, their
 * Pulse account, a relationship's story truth in its Connections row,
 * episode history and what the writers know.
 */
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PersonWho, { summaryOf } from './PersonWho';
import PersonPulse from './PersonPulse';
import PersonRelationship, { knowsLine, LoveHeart } from './PersonRelationships';
import PersonEpisodes from './PersonEpisodes';
import PersonWriters from './PersonWriters';

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Who they are, in the header', () => {
  test('the other names they go by and one line about them', () => {
    wrap(<PersonWho aliases={['Truth', ' M.H. ', 'Marcus Hale', '']} summary="A producer who never says what he wants." name="Marcus Hale" />);
    const who = screen.getByTestId('person-who');
    expect([...who.querySelectorAll('.pw-aka')].map((e) => e.textContent)).toEqual(['Truth', 'M.H.']);
    expect(screen.getByTestId('person-summary').textContent).toBe('A producer who never says what he wants.');
  });

  test('nothing to add: nothing shown', () => {
    const { container } = wrap(<PersonWho aliases={[]} summary={null} />);
    expect(container.textContent).toBe('');
  });

  test('one line: the first sentence of their prose, else description, else core belief', () => {
    expect(summaryOf({ prose_overview: 'A producer. He collects favours.' })).toBe('A producer.');
    expect(summaryOf({ prose_overview: '  ', description: 'Quiet  and sharp' })).toBe('Quiet and sharp');
    expect(summaryOf({ core_belief: 'x'.repeat(250) })).toHaveLength(200);
    expect(summaryOf({})).toBeNull();
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

describe("A relationship's story truth", () => {
  const LM = { id: 'r1', other: { id: 'lala', name: 'Lala' }, kind: 'love interest', stage: 'lovers', love_interest: true, public_state: 'secret', public_label: 'Secret',
    known_by: ['Jade Monroe'], online: { differs: true, says: 'bestie' }, link: '/relationships?rel=r1' };
  const MJ = { id: 'r2', other: { id: 'jade', name: 'Jade Monroe' }, kind: 'sister', stage: null, love_interest: false, public_state: 'rumoured', public_label: 'Rumoured',
    known_by: [], online: { differs: false, says: 'family' }, link: '/relationships?rel=r2' };

  test('stage, Secret, who knows, different online, and a link to it', () => {
    wrap(<><LoveHeart rel={LM} /><PersonRelationship rel={LM} /></>);
    const r1 = screen.getByTestId('prl-r1');
    expect(screen.getByRole('img', { name: 'Love interest' })).toBeTruthy();
    expect(within(r1).getByText('now lovers')).toBeTruthy();
    expect(within(r1).getByText('Secret')).toBeTruthy();
    expect(within(r1).getByText('Different online').getAttribute('title')).toBe('On The Pulse: bestie');
    expect(r1.textContent).toContain('Jade Monroe knows.');
    expect(within(r1).getByRole('link', { name: /Open in Relationships/ }).getAttribute('href')).toBe('/relationships?rel=r1');
  });

  test('no heart and no "different" when it is not', () => {
    wrap(<><LoveHeart rel={MJ} /><PersonRelationship rel={MJ} /></>);
    expect(screen.queryByRole('img', { name: 'Love interest' })).toBeNull();
    expect(screen.getByText('Rumoured')).toBeTruthy();
    expect(screen.queryByText('Different online')).toBeNull();
  });

  test('nothing without the read', () => {
    const { container } = wrap(<><LoveHeart rel={undefined} /><PersonRelationship rel={undefined} /></>);
    expect(container.textContent).toBe('');
  });

  test('who knows, in words', () => {
    expect(knowsLine({ known_by: [], public_state: 'secret' })).toBe('Only the two of them know.');
    expect(knowsLine({ known_by: [], public_state: 'known' })).toBeNull();
    expect(knowsLine({ known_by: ['Jade', 'Dre', 'Nia'] })).toBe('Jade, Dre and Nia know.');
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

  test('bare: the list alone, for a card with its own heading', () => {
    wrap(<PersonEpisodes episodes={EPS.slice(0, 1)} bare />);
    expect(screen.queryByText('Episode history')).toBeNull();
    expect(screen.getByTestId('person-episodes').querySelectorAll('.pep-item')).toHaveLength(1);
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

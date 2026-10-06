/**
 * The Culture tab's front page, to Evoni's mock (Lalas_Social_Media_Page_3,
 * 2026-10-06): the year as twelve months with a dot per thing that happens,
 * the chosen month's list, and the cultural memory. Pure: CultureYear
 * loads and renders.
 *
 * What happens in a month, from three sources:
 *   event / micro  the cultural calendar (GET /calendar/events?event_type=
 *                  lalaverse_cultural): start_datetime, read in UTC as the
 *                  Events tab does; is_micro_event decides which.
 *   library        the show's own events (GET /world/:showId/events) that
 *                  have an event_date (a DATEONLY, read as text so no time
 *                  zone moves it); an event with no date is in the library
 *                  but not on the calendar.
 *   award          the award shows (data/calendarData AWARD_SHOWS, or the
 *                  page's saved edits) by their month name; they carry no day.
 *
 * Cultural memory: what the world remembers is what happened. When an
 * episode is completed, episodeCompletionService writes its outcome into
 * the Show Bible (source_document 'episode-completion', category
 * narrative: "Episode 1: … — SLAY Result"); those are the moments.
 */

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
export const KIND_LABEL = { event: 'Event', micro: 'Micro', library: 'Show event', award: 'Award' };
/** The short word on an item's date badge. */
export const BADGE_LABEL = { event: 'Event', micro: 'Micro', library: 'Show', award: 'Award' };

const utc = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : { month: d.getUTCMonth(), day: d.getUTCDate() };
};
const dateOnly = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? { month: Number(m[2]) - 1, day: Number(m[3]) } : null;
};
const words = (s) => String(s || '').replace(/_/g, ' ');

/**
 * Twelve months, each { month, name, short, items }. An item is { key,
 * kind, day, title, where, id }, by day (undated last), then title.
 */
export function yearMonths({ calendar = [], library = [], awards = [] } = {}) {
  const months = MONTH_NAMES.map((name, month) => ({ month, name, short: MONTH_SHORT[month], items: [] }));
  for (const ev of calendar || []) {
    const at = utc(ev?.start_datetime);
    if (!at || !ev.title) continue;
    months[at.month].items.push({
      key: `cal-${ev.id}`, id: ev.id, kind: ev.is_micro_event ? 'micro' : 'event', day: at.day,
      title: ev.title, where: ev.location_name || ev.lalaverse_district || words(ev.cultural_category) || null,
    });
  }
  for (const ev of library || []) {
    const at = dateOnly(ev?.event_date);
    if (!at || !ev.name) continue;
    months[at.month].items.push({
      key: `lib-${ev.id}`, id: ev.id, kind: 'library', day: at.day,
      title: ev.name, where: ev.venue_name || null, status: ev.status || null,
    });
  }
  for (const a of awards || []) {
    const month = MONTH_NAMES.indexOf(String(a?.month || '').trim());
    if (month === -1 || !a.name) continue;
    months[month].items.push({ key: `award-${a.name}`, kind: 'award', day: null, title: a.name, where: a.desc || null });
  }
  for (const m of months) {
    m.items.sort((a, b) => (a.day ?? 99) - (b.day ?? 99) || a.title.localeCompare(b.title));
  }
  return months;
}

/** "40 events in the library · 12 placed on the calendar · 18 cultural moments". */
export function yearSummary({ calendar = [], library = [] } = {}) {
  const placed = (library || []).filter((e) => dateOnly(e?.event_date)).length;
  return { library: (library || []).length, placed, cultural: (calendar || []).length };
}

/** The episodes' outcomes the world remembers, newest first: [{ id, title, text, when }]. */
export function memoryMoments(entries, limit = 4) {
  return (entries || [])
    .filter((e) => e?.status === 'active' && e.source_document === 'episode-completion' && e.category === 'narrative' && e.title)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map((e) => {
      const t = new Date(e.created_at);
      const lines = String(e.content || '').split('\n').map((l) => l.trim()).filter(Boolean);
      // The last line is the episode's narrative line when there is one.
      const story = lines.length > 5 ? lines[lines.length - 1] : (lines[1] || '');
      return {
        id: e.id,
        title: e.title,
        text: story,
        when: Number.isNaN(t.getTime()) ? null : t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    });
}

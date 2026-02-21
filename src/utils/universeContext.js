/**
 * universeContext.js
 * src/utils/universeContext.js
 *
 * Fetches the full universe -> show -> book chain for a given book
 * and returns a formatted string to prepend to every Claude prompt.
 *
 * Usage in any route:
 *   const { buildUniverseContext } = require('../utils/universeContext');
 *   const context = await buildUniverseContext(bookId, db);
 *   // then prepend to your prompt string
 */

async function buildUniverseContext(bookId, db) {
  const { StorytellerBook, BookSeries, Universe } = db;

  try {
    const book = await StorytellerBook.findByPk(bookId, {
      include: [
        {
          model: BookSeries,
          as: 'series',
          required: false,
          include: [
            {
              model: Universe,
              as: 'universe',
              required: false,
            },
          ],
        },
      ],
    });

    if (!book) return '';

    const parts = [];

    // ── Universe layer ─────────────────────────────────────────────────────
    const universe = book.series?.universe;
    if (universe) {
      parts.push(`=== UNIVERSE: ${universe.name} ===`);
      if (universe.description) {
        parts.push(`PHILOSOPHY: ${universe.description}`);
      }
      if (universe.core_themes?.length > 0) {
        parts.push(`CORE THEMES: ${universe.core_themes.join(', ')}`);
      }
      if (universe.world_rules) {
        parts.push(`WORLD RULES:\n${universe.world_rules}`);
      }
      if (universe.pnos_beliefs) {
        parts.push(`PNOS BELIEF SYSTEM:\n${universe.pnos_beliefs}`);
      }
      if (universe.narrative_economy) {
        parts.push(`NARRATIVE ECONOMY:\n${universe.narrative_economy}`);
      }
    }

    // ── Book Series layer ──────────────────────────────────────────────────
    const series = book.series;
    if (series) {
      parts.push(`\n=== BOOK SERIES: ${series.name} ===`);
      if (series.description) {
        parts.push(`SERIES DESCRIPTION: ${series.description}`);
      }
    }

    // ── Book layer ─────────────────────────────────────────────────────────
    parts.push(`\n=== CURRENT BOOK: ${book.title || book.character_name} ===`);
    if (book.description) {
      parts.push(`BOOK DESCRIPTION: ${book.description}`);
    }
    if (book.era_name) {
      parts.push(`ERA: ${book.era_name}`);
      if (book.era_description) {
        parts.push(`ERA TONE: ${book.era_description}`);
      }
    }

    if (parts.length === 0) return '';

    return `${parts.join('\n')}\n\n--- END CONTEXT ---\n\n`;

  } catch (err) {
    console.error('buildUniverseContext error:', err);
    return ''; // fail silently — never block generation
  }
}

module.exports = { buildUniverseContext };

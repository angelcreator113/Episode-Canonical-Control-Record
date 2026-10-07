'use strict';

/**
 * The values franchise_knowledge's ENUM columns accept, as the migrations
 * build them (src/migrations/20260307210000-create-franchise-knowledge.js;
 * no later migration widens them). A raw INSERT with any other value fails
 * with "invalid input value for enum". Three writers did exactly that
 * (Amber's push-page and world-development tools, and episode completion),
 * so none of their rows was ever saved (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md §5 finding 5b, fix-list
 * item 9).
 */
const FK_CATEGORIES = ['character', 'narrative', 'locked_decision', 'franchise_law', 'technical', 'brand', 'world'];
const FK_SEVERITIES = ['critical', 'important', 'context'];
const FK_EXTRACTED_BY = ['document_ingestion', 'conversation_extraction', 'direct_entry', 'system'];

/** Amber's rows are conversation_extraction with a review_note starting with this. */
const AMBER_NOTE_PREFIX = 'Amber:';

module.exports = { FK_CATEGORIES, FK_SEVERITIES, FK_EXTRACTED_BY, AMBER_NOTE_PREFIX };

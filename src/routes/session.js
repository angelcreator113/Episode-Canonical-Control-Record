'use strict';
/**
 * Session Briefing route
 * GET /api/v1/session/brief — Returns a creative session briefing
 *   with recent books, chapters in progress, and writing stats
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

router.get('/brief', async (req, res) => {
  try {
    const db = require('../models');
    const { StorytellerBook, StorytellerChapter, StorytellerLine } = db;

    // ── Recent books (last 5 updated) ──
    const recentBooks = await StorytellerBook.findAll({
      order: [['updated_at', 'DESC']],
      limit: 5,
      include: [{
        model: StorytellerChapter,
        as: 'chapters',
        attributes: ['id', 'title', 'chapter_number', 'draft_prose', 'scene_goal', 'updated_at'],
        order: [['chapter_number', 'ASC']],
      }],
    });

    // ── Chapters with drafts in progress ──
    const draftsInProgress = await StorytellerChapter.findAll({
      where: {
        draft_prose: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
      },
      order: [['updated_at', 'DESC']],
      limit: 6,
      include: [{
        model: StorytellerBook,
        as: 'book',
        attributes: ['id', 'title', 'character_name'],
      }],
    });

    // ── Total counts ──
    const totalBooks = await StorytellerBook.count();
    const totalChapters = await StorytellerChapter.count();

    let totalLines = 0;
    try {
      totalLines = await StorytellerLine.count();
    } catch (_) { /* table may not exist */ }

    // ── Word count from all drafts ──
    let totalWords = 0;
    try {
      const allDrafts = await StorytellerChapter.findAll({
        where: { draft_prose: { [Op.ne]: null } },
        attributes: ['draft_prose'],
      });
      totalWords = allDrafts.reduce((sum, ch) => {
        return sum + (ch.draft_prose || '').split(/\s+/).filter(Boolean).length;
      }, 0);
    } catch (_) { /* ignore */ }

    // ── Format response ──
    const books = recentBooks.map(b => ({
      id: b.id,
      title: b.title,
      character: b.character_name,
      status: b.status,
      canon: b.canon_status,
      chapterCount: b.chapters ? b.chapters.length : 0,
      lastTouched: b.updated_at,
      chapters: (b.chapters || []).map(ch => ({
        id: ch.id,
        number: ch.chapter_number,
        title: ch.title,
        hasDraft: !!(ch.draft_prose && ch.draft_prose.trim()),
        sceneGoal: ch.scene_goal,
        lastTouched: ch.updated_at,
      })),
    }));

    const drafts = draftsInProgress.map(ch => ({
      chapterId: ch.id,
      chapterTitle: ch.title,
      chapterNumber: ch.chapter_number,
      bookId: ch.book ? ch.book.id : null,
      bookTitle: ch.book ? ch.book.title : 'Unknown',
      character: ch.book ? ch.book.character_name : null,
      wordCount: (ch.draft_prose || '').split(/\s+/).filter(Boolean).length,
      lastTouched: ch.updated_at,
    }));

    // Pick a creative greeting
    const greetings = [
      'Welcome back, creator.',
      'The story awaits your voice.',
      'Ready to shape the narrative?',
      'Your characters have been waiting.',
      'The page is blank. The possibilities are infinite.',
      'Another session, another chapter unfolds.',
      'Let the words flow.',
      'The LalaVerse needs you.',
    ];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    res.json({
      greeting,
      stats: {
        totalBooks,
        totalChapters,
        totalLines,
        totalWords,
        draftsInProgress: drafts.length,
      },
      recentBooks: books,
      draftsInProgress: drafts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Session brief error:', error);
    res.status(500).json({ error: 'Failed to load session brief', details: error.message });
  }
});

module.exports = router;

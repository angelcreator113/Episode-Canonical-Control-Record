/**
 * manuscript-export.js
 * src/routes/manuscript-export.js
 *
 * Manuscript export — DOCX and PDF from approved/edited lines only.
 *
 * Routes:
 *   GET /api/v1/export/book/:bookId/docx   → Download Word document
 *   GET /api/v1/export/book/:bookId/pdf    → Download PDF
 *   GET /api/v1/export/book/:bookId/meta   → Export metadata (word count, chapters, etc)
 *
 * Register in app.js:
 *   const manuscriptExportRoutes = require('./routes/manuscript-export');
 *   app.use('/api/v1/export', manuscriptExportRoutes);
 *
 * Dependencies:
 *   npm install docx pdfkit
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const path     = require('path');

// Auth middleware — matches all other routes
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * fetchBook(db, bookId)
 * Returns book with chapters → lines, all sorted, approved/edited only.
 */
async function fetchBook(db, bookId) {
  const { StorytellerBook, StorytellerChapter, StorytellerLine } = db;

  const book = await StorytellerBook.findByPk(bookId, {
    include: [{
      model:   StorytellerChapter,
      as:      'chapters',
      include: [{
        model: StorytellerLine,
        as:    'lines',
      }],
    }],
  });

  if (!book) return null;

  // Sort chapters and filter lines
  const chapters = (book.chapters || [])
    .slice()
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
    .map(ch => ({
      id:    ch.id,
      title: ch.title || 'Untitled Chapter',
      lines: (ch.lines || ch.storyteller_lines || [])
        .filter(l => ['approved', 'edited'].includes(l.status))
        .sort((a, b) => (a.order_index || a.sort_order || 0) - (b.order_index || b.sort_order || 0))
        .map(l => ({
          id:         l.id,
          content:    l.content || l.text || '',
          source_type: l.source_type,
          source_tags: l.source_tags || {},
        }))
        .filter(l => l.content.trim().length > 0),
    }))
    .filter(ch => ch.lines.length > 0);

  const wordCount = chapters
    .flatMap(ch => ch.lines)
    .reduce((sum, l) => sum + l.content.trim().split(/\s+/).filter(Boolean).length, 0);

  return {
    id:          book.id,
    title:       book.title || 'Untitled',
    description: book.description || '',
    character:   book.character || '',
    chapters,
    wordCount,
    chapterCount: chapters.length,
    lineCount:   chapters.flatMap(ch => ch.lines).length,
  };
}

/**
 * isLalaLine(line)
 * Returns true if this line is a Lala proto-voice moment.
 */
function isLalaLine(line) {
  const tags = line.source_tags || {};
  return (
    tags.lala === true ||
    tags.suggestion_type === 'lala' ||
    line.source_type === 'lala'
  );
}

/**
 * safeFilename(title)
 * Converts book title to a safe filename.
 */
function safeFilename(title) {
  return (title || 'manuscript')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

// ── META endpoint ──────────────────────────────────────────────────────────

router.get('/book/:bookId/meta', optionalAuth, async (req, res) => {
  try {
    const db   = req.app.get('db') || require('../models');
    const book = await fetchBook(db, req.params.bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const WORDS_PER_MINUTE = 250;

    res.json({
      title:         book.title,
      character:     book.character,
      word_count:    book.wordCount,
      chapter_count: book.chapterCount,
      line_count:    book.lineCount,
      reading_minutes: Math.max(1, Math.round(book.wordCount / WORDS_PER_MINUTE)),
      chapters: book.chapters.map(ch => ({
        title:      ch.title,
        line_count: ch.lines.length,
        word_count: ch.lines.reduce((sum, l) =>
          sum + l.content.trim().split(/\s+/).filter(Boolean).length, 0),
      })),
    });
  } catch (err) {
    console.error('GET /export/meta error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DOCX export ────────────────────────────────────────────────────────────

router.get('/book/:bookId/docx', optionalAuth, async (req, res) => {
  try {
    const db   = req.app.get('db') || require('../models');
    const book = await fetchBook(db, req.params.bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const {
      Document, Packer, Paragraph, TextRun,
      AlignmentType, HeadingLevel, PageBreak,
      PageNumber, NumberFormat, Footer, Header,
    } = require('docx');

    const children = [];

    // ── Title page ──────────────────────────────────────────────────────
    if (book.character) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2880 }, // 2 inches from top
        children: [
          new TextRun({
            text: book.character.toUpperCase(),
            font: 'Georgia',
            size: 18,
            color: 'C9A84C',
            characterSpacing: 200,
          }),
        ],
      }));
    }

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: book.character ? 180 : 2880, after: 0 },
      children: [
        new TextRun({
          text: book.title,
          font: 'Georgia',
          size: 52,
          bold: true,
          italics: true,
          color: '1C1917',
        }),
      ],
    }));

    if (book.description) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 0 },
        children: [
          new TextRun({
            text: book.description,
            font: 'Georgia',
            size: 22,
            italics: true,
            color: '44403C',
          }),
        ],
      }));
    }

    // Word count + date
    const exportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 0 },
      children: [
        new TextRun({
          text: `${book.wordCount.toLocaleString()} words  ·  ${book.chapterCount} chapter${book.chapterCount !== 1 ? 's' : ''}  ·  ${exportDate}`,
          font: 'Courier New',
          size: 16,
          color: '78716C',
        }),
      ],
    }));

    // Page break after title
    children.push(new Paragraph({
      children: [new PageBreak()],
    }));

    // ── Chapters ─────────────────────────────────────────────────────────
    book.chapters.forEach((chapter, chIdx) => {

      // Chapter number
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 720, after: 180 },
        children: [
          new TextRun({
            text: String(chIdx + 1).padStart(2, '0'),
            font: 'Courier New',
            size: 18,
            color: 'C9A84C',
            characterSpacing: 200,
          }),
        ],
      }));

      // Chapter title
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 720 },
        children: [
          new TextRun({
            text: chapter.title,
            font: 'Georgia',
            size: 36,
            italics: true,
            bold: true,
            color: '1C1917',
          }),
        ],
      }));

      // Chapter rule (em dashes)
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 480 },
        children: [
          new TextRun({
            text: '— — —',
            font: 'Georgia',
            size: 20,
            color: 'C9A84C',
          }),
        ],
      }));

      // Lines
      chapter.lines.forEach((line, lineIdx) => {
        const lala = isLalaLine(line);

        children.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: lala
            ? { left: 720 }  // Lala lines indented
            : undefined,
          spacing: {
            before: lala ? 240 : lineIdx === 0 ? 0 : 0,
            after:  lala ? 240 : 200,
            line:   lala ? 360 : 340,    // 1.8 / 1.7 line spacing (240 = single)
          },
          children: [
            new TextRun({
              text:    line.content,
              font:    'Georgia',
              size:    lala ? 22 : 24,   // 11pt / 12pt
              italics: lala,
              color:   lala ? 'C9A84C' : '1C1917',
            }),
          ],
        }));
      });

      // Chapter break — page break before next chapter (not after last)
      if (chIdx < book.chapters.length - 1) {
        children.push(new Paragraph({
          children: [new PageBreak()],
        }));
      }
    });

    // ── Build document ────────────────────────────────────────────────────
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Georgia',
              size: 24,
              color: '1C1917',
            },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            size:   { width: 12240, height: 15840 },  // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font:     'Courier New',
                    size:     16,
                    color:    '78716C',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${safeFilename(book.title)}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('GET /export/docx error:', err);
    // If docx package not installed, return helpful error
    if (err.code === 'MODULE_NOT_FOUND') {
      return res.status(500).json({
        error: 'docx package not installed',
        fix:   'Run: npm install docx',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── PDF export ─────────────────────────────────────────────────────────────

router.get('/book/:bookId/pdf', optionalAuth, async (req, res) => {
  try {
    const db   = req.app.get('db') || require('../models');
    const book = await fetchBook(db, req.params.bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const PDFDocument = require('pdfkit');

    const doc      = new PDFDocument({
      size:    'LETTER',
      margins: { top: 72, bottom: 72, left: 90, right: 90 },
      info: {
        Title:    book.title,
        Author:   book.character || 'Prime Studios',
        Creator:  'Prime Studios — LalaVerse',
        Subject:  book.description || '',
      },
    });

    // Collect buffer
    const chunks = [];
    doc.on('data',  chunk => chunks.push(chunk));

    await new Promise((resolve, reject) => {
      doc.on('end',   resolve);
      doc.on('error', reject);

      // ── Fonts ──────────────────────────────────────────────────────────
      const SERIF = 'Times-Roman';
      const SERIF_ITALIC = 'Times-Italic';
      const SERIF_BOLD   = 'Times-Bold';
      const SERIF_BOLD_I = 'Times-BoldItalic';
      const MONO  = 'Courier';

      const GOLD   = '#C9A84C';
      const INK    = '#1C1917';
      const MUTED  = '#78716C';
      const W      = doc.page.width  - 180; // content width (90 margins each side)
      const CX     = doc.page.width / 2;    // center x

      // ── Title page ────────────────────────────────────────────────────
      const titleY = doc.page.height * 0.28;
      doc.y = titleY;

      if (book.character) {
        doc
          .font(MONO)
          .fontSize(9)
          .fillColor(GOLD)
          .text(book.character.toUpperCase(), 90, doc.y, {
            align: 'center', width: W, characterSpacing: 3,
          });
        doc.moveDown(0.8);
      }

      doc
        .font(SERIF_BOLD_I)
        .fontSize(32)
        .fillColor(INK)
        .text(book.title, 90, doc.y, { align: 'center', width: W });

      if (book.description) {
        doc.moveDown(1);
        doc
          .font(SERIF_ITALIC)
          .fontSize(13)
          .fillColor('#44403C')
          .text(book.description, 90, doc.y, { align: 'center', width: W });
      }

      // Gold rule
      doc.moveDown(2);
      const ruleY = doc.y;
      doc
        .moveTo(CX - 36, ruleY)
        .lineTo(CX + 36, ruleY)
        .strokeColor(GOLD)
        .lineWidth(0.5)
        .stroke();

      // Metadata
      doc.moveDown(1.5);
      const exportDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      doc
        .font(MONO)
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${book.wordCount.toLocaleString()} words  ·  ${book.chapterCount} chapter${book.chapterCount !== 1 ? 's' : ''}  ·  ${exportDate}`,
          90, doc.y, { align: 'center', width: W }
        );

      // ── Chapters ──────────────────────────────────────────────────────
      book.chapters.forEach((chapter, chIdx) => {

        doc.addPage();

        // Chapter number
        doc
          .font(MONO)
          .fontSize(9)
          .fillColor(GOLD)
          .text(String(chIdx + 1).padStart(2, '0'), 90, 72, {
            align: 'center', width: W, characterSpacing: 3,
          });

        doc.moveDown(0.6);

        // Chapter title
        doc
          .font(SERIF_BOLD_I)
          .fontSize(22)
          .fillColor(INK)
          .text(chapter.title, 90, doc.y, { align: 'center', width: W });

        doc.moveDown(0.8);

        // Rule
        const chRuleY = doc.y;
        doc
          .moveTo(CX - 24, chRuleY)
          .lineTo(CX + 24, chRuleY)
          .strokeColor(GOLD)
          .lineWidth(0.4)
          .stroke();

        doc.moveDown(2);

        // Lines
        chapter.lines.forEach((line, lineIdx) => {
          const lala = isLalaLine(line);

          // Check if we need a new page (leave 72pt bottom margin)
          if (doc.y > doc.page.height - 108) {
            doc.addPage();
            doc.y = 72;
          }

          if (lala) {
            // Lala — gold italic, indented
            doc
              .font(SERIF_ITALIC)
              .fontSize(11)
              .fillColor(GOLD)
              .text(line.content, 126, doc.y, {  // 36pt extra indent
                width: W - 36,
                align: 'left',
                lineGap: 4,
              });
            doc.moveDown(0.9);
          } else {
            // Normal line
            doc
              .font(SERIF)
              .fontSize(12)
              .fillColor(INK)
              .text(line.content, 90, doc.y, {
                width: W,
                align: 'left',
                lineGap: 4,
              });
            doc.moveDown(0.6);
          }
        });
      });

      // ── Page numbers ─────────────────────────────────────────────────
      const pageCount = doc.bufferedPageRange
        ? doc.bufferedPageRange().count
        : null;

      if (pageCount && doc.switchToPage) {
        // Skip title page (page 0)
        for (let i = 1; i < pageCount; i++) {
          doc.switchToPage(i);
          doc
            .font(MONO)
            .fontSize(8)
            .fillColor(MUTED)
            .text(
              String(i),
              0,
              doc.page.height - 54,
              { align: 'center', width: doc.page.width }
            );
        }
      }

      doc.end();
    });

    const buffer   = Buffer.concat(chunks);
    const filename = `${safeFilename(book.title)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('GET /export/pdf error:', err);
    if (err.code === 'MODULE_NOT_FOUND') {
      return res.status(500).json({
        error: 'pdfkit package not installed',
        fix:   'Run: npm install pdfkit',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

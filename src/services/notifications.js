/**
 * notifications.js
 * src/services/notifications.js
 *
 * LalaVerse Notification Service
 * Handles all outbound notifications:
 *   1. Therapy threshold alerts -- character knocked, message in their voice
 *   2. Wardrobe brand alerts -- piece worn, coverage not yet written
 *   3. Press coverage ready -- generated content waiting for review
 *
 * EMAIL SETUP (Gmail SMTP):
 *   1. Create Gmail account: lalaversestudio@gmail.com (or your choice)
 *   2. Enable 2FA on that Google account
 *   3. Go to: Google Account -> Security -> App Passwords
 *   4. Create an app password for "Mail"
 *   5. Add to your .env:
 *
 *      LALAVERSE_EMAIL=lalaversestudio@gmail.com
 *      LALAVERSE_EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
 *      NOTIFY_EMAIL=your-personal@email.com
 *
 * INSTALL: npm install nodemailer
 */

'use strict';

const nodemailer = require('nodemailer');

// -- EMAIL TRANSPORT --

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.LALAVERSE_EMAIL,
      pass: process.env.LALAVERSE_EMAIL_PASSWORD,
    },
  });
}

const FROM_NAME    = 'LalaVerse Studio';
const FROM_ADDRESS = process.env.LALAVERSE_EMAIL || 'lalaversestudio@gmail.com';
const NOTIFY_TO    = process.env.NOTIFY_EMAIL    || FROM_ADDRESS;

// -- BASE SEND --

async function sendEmail({ subject, html, text }) {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from:    `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to:      NOTIFY_TO,
      subject,
      text,
      html,
    });
    console.log(`[Notifications] Email sent: ${subject} -> ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Notifications] Email failed:', err.message);
    return { ok: false, error: err.message };
  }
}

// -- EMAIL TEMPLATES --

const BASE_STYLE = `
  font-family: Georgia, 'Times New Roman', serif;
  background: #FAF7F0;
  margin: 0; padding: 0;
`;

const CARD_STYLE = `
  max-width: 560px;
  margin: 40px auto;
  background: white;
  border: 1px solid rgba(28,24,20,0.08);
  border-radius: 4px;
  overflow: hidden;
`;

function emailShell({ headerColor, headerLabel, body, footerNote }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="background: ${headerColor}; padding: 16px 24px;">
      <div style="font-family: 'Courier New', monospace; font-size: 10px;
                  letter-spacing: 0.2em; color: rgba(250,247,240,0.7); text-transform: uppercase;">
        THE LALAVERSE STUDIO
      </div>
      <div style="font-family: 'Courier New', monospace; font-size: 11px;
                  letter-spacing: 0.15em; color: rgba(250,247,240,0.9);
                  margin-top: 4px; text-transform: uppercase;">
        ${headerLabel}
      </div>
    </div>
    <div style="padding: 28px 24px 20px;">
      ${body}
    </div>
    <div style="padding: 14px 24px; border-top: 1px solid rgba(28,24,20,0.06);
                font-family: 'Courier New', monospace; font-size: 9px;
                letter-spacing: 0.08em; color: rgba(28,24,20,0.3);">
      ${footerNote}
    </div>
  </div>
</body>
</html>`;
}

// -- NOTIFICATION 1: THERAPY THRESHOLD -- CHARACTER KNOCKED --

async function sendTherapyKnock({
  characterName,
  characterType,
  knockMessage,
  wound,
  emotionalState,
  triggerEvent,
  sessionUrl,
}) {
  const TYPE_COLORS = {
    pressure: '#B85C38',
    mirror:   '#9B7FD4',
    support:  '#4A9B6F',
    shadow:   '#E08C3A',
    special:  '#B8962E',
    press_business: '#B8962E',
    press_style:    '#9B7FD4',
    press_culture:  '#4A9B6F',
    press_interior: '#E08C3A',
  };

  const color = TYPE_COLORS[characterType] || '#B8962E';

  const elevated = Object.entries(emotionalState || {})
    .filter(([, v]) => v >= 6)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}/10`)
    .join(' \u00B7 ');

  const body = `
    <div style="font-family: 'Courier New', monospace; font-size: 9px;
                letter-spacing: 0.15em; color: ${color}; text-transform: uppercase;
                margin-bottom: 16px;">
      ${characterName} \u00B7 ${characterType}
    </div>

    <div style="font-family: Georgia, serif; font-style: italic; font-size: 18px;
                color: #1C1814; line-height: 1.7; margin-bottom: 20px;
                padding-left: 16px; border-left: 3px solid ${color};">
      \u201C${knockMessage}\u201D
    </div>

    ${triggerEvent ? `
    <div style="font-family: 'Courier New', monospace; font-size: 9px;
                letter-spacing: 0.08em; color: rgba(28,24,20,0.4);
                margin-bottom: 16px;">
      WHAT ACTIVATED THIS: ${triggerEvent}
    </div>` : ''}

    ${elevated ? `
    <div style="font-family: 'Courier New', monospace; font-size: 9px;
                letter-spacing: 0.08em; color: rgba(28,24,20,0.35);
                margin-bottom: 20px;">
      ELEVATED: ${elevated}
    </div>` : ''}

    <div style="font-family: Georgia, serif; font-size: 12px;
                color: rgba(28,24,20,0.45); font-style: italic;
                margin-bottom: 24px; line-height: 1.6;">
      ${wound}
    </div>

    ${sessionUrl ? `
    <a href="${sessionUrl}"
       style="display: inline-block; background: ${color}; color: #FAF7F0;
              font-family: 'Courier New', monospace; font-size: 10px;
              letter-spacing: 0.12em; text-decoration: none;
              padding: 12px 20px; border-radius: 2px;">
      OPEN SESSION \u2192
    </a>` : ''}
  `;

  return sendEmail({
    subject: `${characterName} knocked`,
    text:    `${characterName} needs to talk.\n\n\u201C${knockMessage}\u201D\n\nActivated by: ${triggerEvent || 'threshold crossed'}\nElevated: ${elevated}`,
    html:    emailShell({
      headerColor: '#1C1814',
      headerLabel: 'Someone is waiting',
      body,
      footerNote:  `The door opened from the inside. They arrived when they were ready. \u2014 LalaVerse Studio`,
    }),
  });
}

// -- NOTIFICATION 2: WARDROBE BRAND ALERT -- PIECE WORN, UNCOVERED --

async function sendWardrobeAlert({
  pieceName,
  brandName,
  brandType,
  eventName,
  sceneSummary,
  pressReady,
  wardrobeUrl,
}) {
  const brandBadge = brandType === 'real'
    ? `<span style="background: #4A7C59; color: white; font-size: 8px;
                    letter-spacing: 0.1em; padding: 2px 7px; border-radius: 10px;
                    font-family: 'Courier New', monospace;">REAL BRAND</span>`
    : `<span style="background: #B8962E; color: white; font-size: 8px;
                    letter-spacing: 0.1em; padding: 2px 7px; border-radius: 10px;
                    font-family: 'Courier New', monospace;">LALAVERSE</span>`;

  const pressSection = pressReady?.length
    ? `<div style="margin-top: 16px; font-family: 'Courier New', monospace;
                   font-size: 9px; letter-spacing: 0.08em; color: rgba(28,24,20,0.4);">
         READY TO COVER: ${pressReady.join(' \u00B7 ')}
       </div>`
    : '';

  const body = `
    <div style="margin-bottom: 20px;">
      <div style="font-family: Georgia, serif; font-style: italic; font-size: 20px;
                  color: #1C1814; margin-bottom: 8px;">${pieceName}</div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        ${brandBadge}
        <span style="font-family: 'Courier New', monospace; font-size: 10px;
                     letter-spacing: 0.1em; color: #B8962E;">${brandName}</span>
      </div>
    </div>

    <div style="background: #F5F0E5; border-radius: 3px; padding: 14px 16px; margin-bottom: 20px;">
      <div style="font-family: 'Courier New', monospace; font-size: 8px;
                  letter-spacing: 0.15em; color: rgba(28,24,20,0.4); margin-bottom: 6px;">
        APPEARED IN
      </div>
      <div style="font-family: Georgia, serif; font-style: italic; font-size: 14px;
                  color: #1C1814;">${eventName}</div>
      ${sceneSummary ? `<div style="font-family: 'Courier New', monospace; font-size: 9px;
                                    letter-spacing: 0.05em; color: rgba(28,24,20,0.45);
                                    margin-top: 6px; line-height: 1.5;">${sceneSummary}</div>` : ''}
    </div>

    <div style="font-family: 'Courier New', monospace; font-size: 9px;
                letter-spacing: 0.1em; color: rgba(28,24,20,0.5); margin-bottom: 6px;">
      COVERAGE STATUS: NOT YET WRITTEN
    </div>
    <div style="font-family: Georgia, serif; font-style: italic; font-size: 13px;
                color: rgba(28,24,20,0.5); margin-bottom: 20px;">
      This piece has a brand attached and appeared in a scene.
      The Press hasn't covered it yet.
    </div>

    ${pressSection}

    ${wardrobeUrl ? `
    <a href="${wardrobeUrl}"
       style="display: inline-block; background: #1C1814; color: #FAF7F0;
              font-family: 'Courier New', monospace; font-size: 10px;
              letter-spacing: 0.12em; text-decoration: none;
              padding: 12px 20px; border-radius: 2px; margin-top: 16px;">
      VIEW PIECE + GENERATE COVERAGE \u2192
    </a>` : ''}
  `;

  return sendEmail({
    subject: `${pieceName} worn \u2014 coverage pending`,
    text:    `${pieceName} by ${brandName} appeared in "${eventName}".\nNo Press coverage yet.\nReady to cover: ${pressReady?.join(', ') || 'check the app'}`,
    html:    emailShell({
      headerColor: '#B8962E',
      headerLabel: 'Wardrobe alert',
      body,
      footerNote:  `${brandName} \u00B7 ${eventName} \u00B7 LalaVerse Studio`,
    }),
  });
}

// -- NOTIFICATION 3: PRESS COVERAGE READY --

async function sendCoverageReady({
  authorName,
  publication,
  topic,
  excerpt,
  pressUrl,
}) {
  const body = `
    <div style="font-family: 'Courier New', monospace; font-size: 8px;
                letter-spacing: 0.2em; color: #9B7FD4; text-transform: uppercase;
                margin-bottom: 12px;">
      ${publication}
    </div>
    <div style="font-family: 'Courier New', monospace; font-size: 9px;
                letter-spacing: 0.1em; color: rgba(28,24,20,0.5);
                margin-bottom: 6px;">BY ${authorName.toUpperCase()}</div>

    <div style="font-family: Georgia, serif; font-style: italic; font-size: 17px;
                color: #1C1814; margin-bottom: 20px; line-height: 1.4;">${topic}</div>

    ${excerpt ? `
    <div style="font-family: Georgia, serif; font-style: italic; font-size: 14px;
                color: rgba(28,24,20,0.6); line-height: 1.7; margin-bottom: 20px;
                padding-left: 14px; border-left: 2px solid rgba(28,24,20,0.1);">
      \u201C${excerpt}${excerpt.length >= 200 ? '\u2026' : ''}\u201D
    </div>` : ''}

    ${pressUrl ? `
    <a href="${pressUrl}"
       style="display: inline-block; background: #1C1814; color: #FAF7F0;
              font-family: 'Courier New', monospace; font-size: 10px;
              letter-spacing: 0.12em; text-decoration: none;
              padding: 12px 20px; border-radius: 2px;">
      REVIEW + PUBLISH \u2192
    </a>` : ''}
  `;

  return sendEmail({
    subject: `${authorName} \u2014 new piece ready`,
    text:    `${publication} by ${authorName}\n\n${topic}\n\n${excerpt}`,
    html:    emailShell({
      headerColor: '#2D2A26',
      headerLabel: 'Coverage ready for review',
      body,
      footerNote:  `${publication} \u00B7 ${authorName} \u00B7 LalaVerse Press`,
    }),
  });
}

module.exports = {
  sendTherapyKnock,
  sendWardrobeAlert,
  sendCoverageReady,
  sendEmail,
};

'use strict';

/**
 * Phone Screen Renderer
 *
 * Renders phone screen mockups as PNG assets for on-screen display.
 * Shows what Lala sees when she looks at her phone during a scene.
 *
 * Types: notification, post, story, dm, live
 */

const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

const FONT_DIR = path.join(__dirname, '../assets/fonts/invitation');
let fontsLoaded = false;

function loadFonts() {
  if (fontsLoaded) return;
  try {
    const reg = (file, family, weight, style) => {
      const p = path.join(FONT_DIR, file);
      if (fs.existsSync(p)) registerFont(p, { family, weight, style });
    };
    reg('LibreBaskerville-Regular.ttf', 'LibreBaskerville', 'normal', 'normal');
    reg('LibreBaskerville-Bold.ttf', 'LibreBaskerville', 'bold', 'normal');
    fontsLoaded = true;
  } catch { fontsLoaded = true; }
}

// ─── RENDER PHONE SCREEN ────────────────────────────────────────────────────

function renderPhoneScreen(feedMoment, options = {}) {
  loadFonts();

  const W = options.width || 340;
  const H = options.height || 420;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const type = feedMoment.phone_screen?.type || 'notification';

  // Phone background
  const r = 24;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r);
  ctx.lineTo(W, H - r); ctx.quadraticCurveTo(W, H, W - r, H);
  ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  // Phone frame border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Status bar
  ctx.fillStyle = '#888';
  ctx.font = '10px LibreBaskerville, sans-serif';
  ctx.textAlign = 'left';
  const now = new Date();
  ctx.fillText(`${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`, 20, 22);
  ctx.textAlign = 'right';
  ctx.fillText('5G 🔋', W - 20, 22);

  // Notch
  ctx.beginPath();
  ctx.roundRect(W / 2 - 40, 4, 80, 18, 10);
  ctx.fillStyle = '#000';
  ctx.fill();

  let y = 44;

  if (type === 'notification') {
    // Notification card
    ctx.beginPath();
    ctx.roundRect(12, y, W - 24, 80, 16);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();

    // App icon
    ctx.beginPath();
    ctx.arc(36, y + 28, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#B8962E';
    ctx.fill();
    ctx.font = 'bold 12px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('💌', 36, y + 32);

    // Notification text
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(feedMoment.trigger_profile || 'New', 58, y + 22);
    ctx.font = '10px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#ccc';

    // Word wrap content
    const content = feedMoment.phone_screen?.content || '';
    const words = content.split(' ');
    let line = '';
    let lineY = y + 38;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > W - 80) {
        ctx.fillText(line.trim(), 58, lineY);
        line = word + ' ';
        lineY += 14;
        if (lineY > y + 68) break;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), 58, lineY);

    // Time
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '9px LibreBaskerville, sans-serif';
    ctx.fillText('now', W - 24, y + 22);

    y += 96;
  } else if (type === 'post' || type === 'story') {
    // Post/story card
    // Profile header
    ctx.beginPath();
    ctx.arc(32, y + 16, 14, 0, Math.PI * 2);
    const gradient = ctx.createLinearGradient(18, y + 2, 46, y + 30);
    gradient.addColorStop(0, '#B8962E');
    gradient.addColorStop(1, '#ec4899');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.font = 'bold 12px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText((feedMoment.trigger_profile || '?')[0], 32, y + 20);

    ctx.textAlign = 'left';
    ctx.font = 'bold 11px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(feedMoment.trigger_profile || 'creator', 54, y + 14);
    ctx.font = '9px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(feedMoment.trigger_action || 'posted', 54, y + 26);

    y += 40;

    // Image placeholder
    ctx.beginPath();
    ctx.rect(0, y, W, 180);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();

    // Image description text
    if (feedMoment.phone_screen?.image_desc) {
      ctx.font = 'italic 10px LibreBaskerville, sans-serif';
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      const desc = feedMoment.phone_screen.image_desc.slice(0, 60);
      ctx.fillText(`[${desc}]`, W / 2, y + 95);
    }

    y += 186;

    // Caption
    const content = feedMoment.phone_screen?.content || '';
    ctx.textAlign = 'left';
    ctx.font = '10px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#ddd';
    const capWords = content.replace(/\[.*?\]/g, '').split(' ');
    let capLine = '';
    let capY = y + 4;
    for (const word of capWords) {
      const test = capLine + word + ' ';
      if (ctx.measureText(test).width > W - 32) {
        ctx.fillText(capLine.trim(), 16, capY);
        capLine = word + ' ';
        capY += 14;
        if (capY > y + 50) break;
      } else {
        capLine = test;
      }
    }
    ctx.fillText(capLine.trim(), 16, capY);

    y = capY + 20;
  } else if (type === 'dm') {
    // DM conversation
    ctx.font = 'bold 12px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(feedMoment.trigger_profile || 'Direct Message', W / 2, y + 16);

    ctx.beginPath();
    ctx.moveTo(20, y + 26);
    ctx.lineTo(W - 20, y + 26);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    y += 40;

    // DM bubble
    const content = feedMoment.phone_screen?.content || '';
    ctx.beginPath();
    ctx.roundRect(16, y, Math.min(ctx.measureText(content).width + 24, W - 60), 36, 12);
    ctx.fillStyle = '#333';
    ctx.fill();

    ctx.font = '11px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(content.slice(0, 50), 28, y + 22);

    y += 50;
  } else if (type === 'live') {
    // Live stream
    ctx.beginPath();
    ctx.rect(0, y, W, 220);
    ctx.fillStyle = '#1a0a2a';
    ctx.fill();

    // LIVE badge
    ctx.beginPath();
    ctx.roundRect(14, y + 10, 44, 18, 4);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.font = 'bold 10px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('LIVE', 36, y + 23);

    // Viewer count
    ctx.textAlign = 'right';
    ctx.font = '10px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#fff';
    const content = feedMoment.phone_screen?.content || '';
    const viewerMatch = content.match(/(\d[\d,]*)\s*watching/);
    ctx.fillText(viewerMatch ? `👁 ${viewerMatch[1]}` : '👁 Live', W - 16, y + 23);

    // Handle
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px LibreBaskerville, sans-serif';
    ctx.fillText(feedMoment.trigger_profile || 'creator', 14, y + 50);

    y += 230;
  }

  // Lala's reaction footer
  if (feedMoment.lala_internal) {
    y = Math.max(y, H - 100);
    ctx.beginPath();
    ctx.rect(0, y, W, H - y);
    ctx.fillStyle = 'rgba(184, 150, 46, 0.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.strokeStyle = '#B8962E40';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 8px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#B8962E';
    ctx.textAlign = 'left';
    ctx.fillText('LALA THINKS', 16, y + 14);

    ctx.font = 'italic 10px LibreBaskerville, sans-serif';
    ctx.fillStyle = '#B8962E';
    const thought = feedMoment.lala_internal.slice(0, 100);
    const thoughtWords = thought.split(' ');
    let tLine = '';
    let tY = y + 28;
    for (const word of thoughtWords) {
      const test = tLine + word + ' ';
      if (ctx.measureText(test).width > W - 32) {
        ctx.fillText(tLine.trim(), 16, tY);
        tLine = word + ' ';
        tY += 13;
      } else {
        tLine = test;
      }
    }
    ctx.fillText(tLine.trim(), 16, tY);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { renderPhoneScreen };

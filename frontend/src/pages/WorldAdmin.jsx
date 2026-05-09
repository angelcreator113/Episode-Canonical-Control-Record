/**
 * WorldAdmin v2 — Producer Mode Dashboard
 * 
 * Route: /shows/:id/world
 * 
 * 7 Tabs:
 *   1. Overview — Stats, tier distribution, canon timeline
 *   2. Episode Ledger — All episodes with tier/score/deltas
 *   3. Events Library — Reusable event catalog (create, edit, inject)
 *   4. Career Goals — Track progression goals
 *   5. Wardrobe — Tier cards, filters, item grid with Lala reactions
 *   6. Characters — View/edit Lala stats, character rules, stat ledger
 *   7. Decision Log — Training data from creative decisions
 * 
 * Location: frontend/src/pages/WorldAdmin.jsx
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SLOT_KEYS, SLOT_DEFS, SLOT_SUBCATEGORIES, getSlotForCategory, groupItemsBySlot } from '../lib/wardrobeSlots';
import { InvitationButton, InvitationStyleFields } from './InvitationGenerator';
import OverlayApprovalPanel from '../components/OverlayApprovalPanel';
import { EventInvitePreview } from './feed/FeedEnhancements';
import './WorldAdmin.css';

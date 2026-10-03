/**
 * /shows/:id — the show's workspace is Producer Mode now (Evoni, 2026-10-03:
 * the two overlapping show workspaces became one). This page sends the old
 * show-page tabs to their new homes, keeping old links and bookmarks working:
 *   studio (Dashboard) → Overview
 *   episodes           → Episodes / Production
 *   assets (Production)→ Assets
 *   wardrobe           → Assets / Wardrobe
 *   distribution       → Release / Distribution
 *   insights           → Release / Insights
 */
import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { rememberShow } from '../utils/activeShow';

export const SHOW_TAB_TO_WORKSPACE = {
  studio: 'overview',
  episodes: 'episodes-production',
  assets: 'scene-sets',
  wardrobe: 'wardrobe-items',
  distribution: 'distribution',
  insights: 'insights',
};

export default function ShowDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (!id) return <Navigate to="/shows" replace />;
  rememberShow(id);
  const tab = SHOW_TAB_TO_WORKSPACE[params.get('tab')] || 'overview';
  return <Navigate to={`/shows/${encodeURIComponent(id)}/world?tab=${tab}`} replace />;
}

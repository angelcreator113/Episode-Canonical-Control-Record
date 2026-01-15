/**
 * Constants
 * Application constants
 */

export const API_ENDPOINTS = {
  AUTH: '/api/v1/auth',
  EPISODES: '/api/v1/episodes',
  THUMBNAILS: '/api/v1/thumbnails',
  SEARCH: '/api/v1/search',
  METADATA: '/api/v1/metadata',
  COMPOSITIONS: '/api/v1/compositions',
};

export const EPISODE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

export const STATUS_OPTIONS = [
  { value: 'draft', label: '📝 Draft' },
  { value: 'published', label: '✅ Published' },
  { value: 'archived', label: '📦 Archived' },
];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  PAGE_SIZES: [5, 10, 20, 50],
};

export const MESSAGES = {
  LOADING: 'Loading...',
  ERROR: 'Something went wrong. Please try again.',
  SUCCESS: 'Operation completed successfully!',
  CONFIRM_DELETE: 'Are you sure you want to delete this item?',
  NOT_FOUND: 'Item not found',
};

export default {
  API_ENDPOINTS,
  EPISODE_STATUS,
  STATUS_OPTIONS,
  PAGINATION,
  MESSAGES,
};

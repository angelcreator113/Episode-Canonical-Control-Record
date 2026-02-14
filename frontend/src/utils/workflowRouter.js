// frontend/src/utils/workflowRouter.js

/**
 * Smart Workflow Router
 * 
 * Routes users to the correct page based on episode status.
 * This makes the "Continue Working" button intelligent.
 */

export const EPISODE_STATUSES = {
  DRAFT: 'draft',
  SCRIPTED: 'scripted',
  IN_BUILD: 'in_build',
  IN_REVIEW: 'in_review',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published'
};

export const STATUS_CONFIG = {
  [EPISODE_STATUSES.DRAFT]: {
    label: 'Draft',
    color: '#94a3b8',
    bgColor: '#f1f5f9',
    icon: '📝',
    route: (id) => `/episodes/${id}/edit`,
    nextSteps: [
      'Write or upload script',
      'Add episode description',
      'Set air date'
    ],
    progress: 10
  },
  [EPISODE_STATUSES.SCRIPTED]: {
    label: 'Scripted',
    color: '#3b82f6',
    bgColor: '#dbeafe',
    icon: '📜',
    route: (id) => `/episodes/${id}/scene-composer`,
    nextSteps: [
      'Design scenes in Spatial View',
      'Add backgrounds and characters',
      'Preview scene layout'
    ],
    progress: 30
  },
  [EPISODE_STATUSES.IN_BUILD]: {
    label: 'In Build',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    icon: '🎬',
    route: (id) => `/episodes/${id}/timeline`,
    nextSteps: [
      'Arrange scenes on timeline',
      'Add transitions and markers',
      'Generate beats from script'
    ],
    progress: 60
  },
  [EPISODE_STATUSES.IN_REVIEW]: {
    label: 'In Review',
    color: '#8b5cf6',
    bgColor: '#ede9fe',
    icon: '👀',
    route: (id) => `/episodes/${id}/animatic-preview`,
    nextSteps: [
      'Preview complete animatic',
      'Create thumbnail',
      'Export final video'
    ],
    progress: 85
  },
  [EPISODE_STATUSES.SCHEDULED]: {
    label: 'Scheduled',
    color: '#06b6d4',
    bgColor: '#cffafe',
    icon: '📅',
    route: (id) => `/episodes/${id}/review`,
    nextSteps: [
      'Confirm publish date',
      'Schedule social posts',
      'Prepare platform variants'
    ],
    progress: 95
  },
  [EPISODE_STATUSES.PUBLISHED]: {
    label: 'Published',
    color: '#10b981',
    bgColor: '#d1fae5',
    icon: '✅',
    route: (id) => `/episodes/${id}`,
    nextSteps: [
      'Monitor performance',
      'Engage with comments',
      'Plan follow-up episode'
    ],
    progress: 100
  }
};

/**
 * Get the work URL for an episode based on its status
 */
export function getWorkUrl(episode) {
  if (!episode) return '/episodes';
  
  const status = episode.status || EPISODE_STATUSES.DRAFT;
  const config = STATUS_CONFIG[status];
  
  return config ? config.route(episode.id) : `/episodes/${episode.id}`;
}

/**
 * Get status configuration
 */
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG[EPISODE_STATUSES.DRAFT];
}

/**
 * Get next status in workflow
 */
export function getNextStatus(currentStatus) {
  const statuses = Object.keys(STATUS_CONFIG);
  const currentIndex = statuses.indexOf(currentStatus);
  
  if (currentIndex === -1 || currentIndex === statuses.length - 1) {
    return null;
  }
  
  return statuses[currentIndex + 1];
}

/**
 * Get previous status in workflow
 */
export function getPreviousStatus(currentStatus) {
  const statuses = Object.keys(STATUS_CONFIG);
  const currentIndex = statuses.indexOf(currentStatus);
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return statuses[currentIndex - 1];
}

/**
 * Calculate episode progress based on completeness
 */
export function calculateProgress(episode) {
  if (!episode) return 0;
  
  let progress = 0;
  const checks = [];
  
  // Base progress from status
  const statusConfig = getStatusConfig(episode.status);
  progress = statusConfig.progress;
  
  // Bonus progress for completeness
  if (episode.title && episode.title.length > 3) {
    checks.push({ label: 'Has title', value: 5 });
  }
  
  if (episode.description && episode.description.length > 10) {
    checks.push({ label: 'Has description', value: 5 });
  }
  
  if (episode.air_date) {
    checks.push({ label: 'Air date set', value: 5 });
  }
  
  if (episode.thumbnail_url) {
    checks.push({ label: 'Has thumbnail', value: 10 });
  }
  
  if (episode.scene_count > 0) {
    checks.push({ label: `${episode.scene_count} scenes`, value: 10 });
  }
  
  // Add bonus points
  const bonusProgress = checks.reduce((sum, check) => sum + check.value, 0);
  
  return {
    total: Math.min(100, progress + bonusProgress),
    base: progress,
    bonus: bonusProgress,
    checks
  };
}

/**
 * AI Suggestion: Should this episode advance to next status?
 */
export function suggestStatusAdvance(episode) {
  if (!episode) return null;
  
  const currentStatus = episode.status || EPISODE_STATUSES.DRAFT;
  const nextStatus = getNextStatus(currentStatus);
  
  if (!nextStatus) return null;
  
  const suggestions = {
    [EPISODE_STATUSES.DRAFT]: () => {
      // Suggest moving to Scripted if script exists
      if (episode.script_content || episode.script_url) {
        return {
          shouldSuggest: true,
          reason: 'Script uploaded',
          confidence: 'high',
          nextStatus: EPISODE_STATUSES.SCRIPTED,
          message: 'Script detected! Ready to design scenes?'
        };
      }
      return null;
    },
    
    [EPISODE_STATUSES.SCRIPTED]: () => {
      // Suggest moving to In Build if scenes exist
      if (episode.scene_count >= 1) {
        return {
          shouldSuggest: true,
          reason: `${episode.scene_count} scene${episode.scene_count > 1 ? 's' : ''} designed`,
          confidence: episode.scene_count >= 3 ? 'high' : 'medium',
          nextStatus: EPISODE_STATUSES.IN_BUILD,
          message: `${episode.scene_count} scenes ready! Move to timeline?`
        };
      }
      return null;
    },
    
    [EPISODE_STATUSES.IN_BUILD]: () => {
      // Suggest moving to Review if timeline is populated
      if (episode.beat_count > 0 || episode.duration_seconds > 0) {
        return {
          shouldSuggest: true,
          reason: 'Timeline built',
          confidence: 'high',
          nextStatus: EPISODE_STATUSES.IN_REVIEW,
          message: 'Timeline complete! Ready for review?'
        };
      }
      return null;
    },
    
    [EPISODE_STATUSES.IN_REVIEW]: () => {
      // Suggest moving to Scheduled if thumbnail exists
      if (episode.thumbnail_url && episode.air_date) {
        return {
          shouldSuggest: true,
          reason: 'Thumbnail + air date ready',
          confidence: 'high',
          nextStatus: EPISODE_STATUSES.SCHEDULED,
          message: 'Ready to schedule! Publish date set?'
        };
      }
      return null;
    },
    
    [EPISODE_STATUSES.SCHEDULED]: () => {
      // Don't auto-suggest published
      return null;
    }
  };
  
  const suggestionFn = suggestions[currentStatus];
  return suggestionFn ? suggestionFn() : null;
}

/**
 * Get completion requirements for current status
 */
export function getStatusRequirements(status) {
  const requirements = {
    [EPISODE_STATUSES.DRAFT]: [
      { id: 'title', label: 'Episode title', required: true },
      { id: 'description', label: 'Description', required: false },
      { id: 'air_date', label: 'Air date', required: false },
      { id: 'script', label: 'Script', required: false }
    ],
    [EPISODE_STATUSES.SCRIPTED]: [
      { id: 'script', label: 'Script uploaded', required: true },
      { id: 'scenes', label: 'At least 1 scene', required: true },
      { id: 'characters', label: 'Characters assigned', required: false }
    ],
    [EPISODE_STATUSES.IN_BUILD]: [
      { id: 'scenes', label: '3+ scenes designed', required: true },
      { id: 'timeline', label: 'Timeline arranged', required: true },
      { id: 'beats', label: 'Beats generated', required: false }
    ],
    [EPISODE_STATUSES.IN_REVIEW]: [
      { id: 'animatic', label: 'Animatic preview ready', required: true },
      { id: 'thumbnail', label: 'Thumbnail created', required: true },
      { id: 'export', label: 'Video exported', required: false }
    ],
    [EPISODE_STATUSES.SCHEDULED]: [
      { id: 'air_date', label: 'Publish date confirmed', required: true },
      { id: 'platforms', label: 'Platforms selected', required: false },
      { id: 'social', label: 'Social posts scheduled', required: false }
    ],
    [EPISODE_STATUSES.PUBLISHED]: [
      { id: 'published', label: 'Episode is live', required: true }
    ]
  };
  
  return requirements[status] || [];
}

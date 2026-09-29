/**
 * A task's source — Host requirement, Brand deliverable, Goal or Optional
 * idea (T2, Task #2294) — and "required" only when a real deliverable stands
 * behind it (T1, §8(bb); Task #2292).
 */
import React from 'react';
import { SOURCE_LABEL, socialTaskSource, isSocialTaskRequired } from '../utils/socialTaskSource';
import './SocialTaskBadge.css';

export default function SocialTaskBadge({ task }) {
  const source = socialTaskSource(task);
  return (
    <span className="social-task-badges">
      <span className={`social-task-badge social-task-badge--${source}`} data-testid="task-source">
        {SOURCE_LABEL[source]}
      </span>
      {isSocialTaskRequired(task) && (
        <span className="social-task-badge social-task-badge--required">required</span>
      )}
    </span>
  );
}

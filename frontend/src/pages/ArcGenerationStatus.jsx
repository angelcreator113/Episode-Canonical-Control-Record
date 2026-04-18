import { Fragment } from 'react';

const STEPS = [
  { key: 'loading_dna',     label: 'Character DNA' },
  { key: 'loading_context', label: 'Context' },
  { key: 'building_arc',    label: 'Building Arc' },
  { key: 'parsing',         label: 'Parsing' },
  { key: 'saving',          label: 'Saving' },
];

/**
 * Multi-step status bar for arc generation via SSE.
 *
 * Props:
 *  - arcProgress: { step, message, done, storiesFound, hasSpine, tokens, taskCount, error }
 *  - charColor: character accent color
 *  - elapsed: seconds elapsed
 */
export default function ArcGenerationStatus({ arcProgress, charColor, elapsed }) {
  if (!arcProgress) return null;

  const currentStepIdx = STEPS.findIndex(s => s.key === arcProgress.step);
  const isError = arcProgress.step === 'error';
  const isDone = arcProgress.step === 'done';

  return (
    <div className="se-arc-status">
      {/* Step indicators */}
      <div className="se-arc-status-steps">
        {STEPS.map((step, i) => {
          let state = 'pending';
          if (isDone || isError) {
            state = isDone ? 'done' : (i <= currentStepIdx ? 'error' : 'pending');
          } else if (i < currentStepIdx) {
            state = 'done';
          } else if (i === currentStepIdx) {
            state = arcProgress.done ? 'done' : 'active';
          }

          return (
            <Fragment key={step.key}>
              {i > 0 && (
                <div className={`se-arc-status-connector ${state === 'done' || (i <= currentStepIdx && !isError) ? 'filled' : ''}`}
                  style={state === 'done' || (i <= currentStepIdx) ? { background: charColor || '#b0922e' } : undefined}
                />
              )}
              <div className={`se-arc-status-step se-arc-status-step--${state}`}>
                <div
                  className="se-arc-status-dot"
                  style={state === 'done' || state === 'active' ? { borderColor: charColor || '#b0922e', background: state === 'done' ? (charColor || '#b0922e') : undefined } : undefined}
                >
                  {state === 'done' && <span className="se-arc-status-check">✓</span>}
                  {state === 'active' && <span className="se-arc-status-pulse" style={{ background: charColor || '#b0922e' }} />}
                  {state === 'error' && <span className="se-arc-status-x">✕</span>}
                </div>
                <div className="se-arc-status-label">{step.label}</div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* Current step message */}
      <div className="se-arc-status-message">
        {isError ? (
          <span className="se-arc-status-error">{arcProgress.message}</span>
        ) : isDone ? (
          <span className="se-arc-status-done">
            Arc ready — {arcProgress.tasks?.length || arcProgress.taskCount || 50} stories
          </span>
        ) : (
          <span>{arcProgress.message}</span>
        )}
      </div>

      {/* Story brief progress bar (visible during building_arc step) */}
      {arcProgress.step === 'building_arc' && arcProgress.storiesFound > 0 && (
        <div className="se-arc-status-stories-bar">
          <div className="se-arc-status-stories-track">
            <div
              className="se-arc-status-stories-fill"
              style={{
                width: `${Math.min((arcProgress.storiesFound / 50) * 100, 100)}%`,
                background: charColor || '#b0922e',
              }}
            />
          </div>
          <span className="se-arc-status-stories-count">
            {arcProgress.storiesFound}/50 briefs
          </span>
        </div>
      )}

      {/* Elapsed */}
      {!isDone && !isError && (
        <div className="se-arc-status-elapsed">{elapsed}s</div>
      )}
    </div>
  );
}

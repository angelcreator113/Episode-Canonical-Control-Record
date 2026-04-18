import { Fragment } from 'react';
import { Image, Layers, Palette, Check } from 'lucide-react';

/**
 * GuidedFlow — Subtle creation stepper shown below the toolbar.
 * Auto-advances based on scene state. Non-blocking — just visual guidance.
 *
 * Steps: Background → Objects → Style → Export
 */

const STEPS = [
  { key: 'background', label: 'Background', icon: Image },
  { key: 'objects', label: 'Objects', icon: Layers },
  { key: 'style', label: 'Style', icon: Palette },
  { key: 'export', label: 'Finish', icon: Check },
];

function getActiveStep(hasBackground, objectCount, hasEffects) {
  if (!hasBackground) return 'background';
  if (objectCount < 1) return 'objects';
  if (!hasEffects) return 'style';
  return 'export';
}

function isStepDone(step, hasBackground, objectCount, hasEffects) {
  if (step === 'background') return hasBackground;
  if (step === 'objects') return objectCount >= 1;
  if (step === 'style') return hasEffects;
  return false;
}

export default function GuidedFlow({ hasBackground, objectCount, hasEffects, dismissed, onDismiss }) {
  if (dismissed) return null;

  const activeStep = getActiveStep(hasBackground, objectCount, hasEffects);

  return (
    <div className="scene-studio-guided-flow">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = isStepDone(step.key, hasBackground, objectCount, hasEffects);
        const active = step.key === activeStep;

        return (
          <Fragment key={step.key}>
            {i > 0 && <span className="scene-studio-flow-arrow">›</span>}
            <span className={`scene-studio-flow-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
              {done ? <Check size={10} /> : <Icon size={10} />}
              {step.label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

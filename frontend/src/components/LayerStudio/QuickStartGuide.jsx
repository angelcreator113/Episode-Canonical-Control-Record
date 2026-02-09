import React, { useState } from 'react';

const QuickStartGuide = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: '📋 Select or Create a Scene',
      description: 'Use the Scene Selector at the top to pick an existing scene or create a new one. Each scene is a separate composition.',
      icon: '📋'
    },
    {
      title: '🎨 Add Assets to Layers',
      description: 'Drag assets from the right panel onto the canvas. Assets automatically go to the Raw Footage layer. You can move them between layers by dragging.',
      icon: '🎨'
    },
    {
      title: '🖱️ Position & Transform',
      description: 'Click and drag assets on the canvas to move them. Use the transform handles (blue circles) to resize. Edit precise values in the controls below the canvas.',
      icon: '🖱️'
    },
    {
      title: '⏱️ Set Timing',
      description: 'In the timeline at the bottom, drag the clip edges to trim. Set In and Out points to control when assets appear in your scene.',
      icon: '⏱️'
    },
    {
      title: '👁️ Organize Layers',
      description: 'Left panel shows 5 layers: Background, Raw Footage, Assets, Text, and Audio. Use the eye icon to hide/show layers. Drag to reorder.',
      icon: '👁️'
    },
    {
      title: '💾 Auto-Save',
      description: 'All changes are saved automatically. You can see recent changes in the decision log. Press ⌨️ for keyboard shortcuts.',
      icon: '💾'
    }
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white p-3 rounded-full shadow-lg transition z-40 transform hover:scale-110"
        title="Quick Start Guide"
      >
        ❓
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border-2 border-teal-600 border-opacity-40" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-teal-600 to-blue-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>{steps[step].icon}</span>
                Quick Start Guide
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 text-3xl leading-none">×</button>
            </div>

            <div className="p-6">
              {/* Step Content */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-3">{steps[step].title}</h3>
                <p className="text-gray-300 text-base leading-relaxed">{steps[step].description}</p>
              </div>

              {/* Step Indicators */}
              <div className="flex justify-center gap-2 mb-6">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setStep(idx)}
                    className={`h-2 rounded-full transition ${
                      idx === step 
                        ? 'bg-teal-500 w-8' 
                        : 'bg-slate-700 w-2 hover:bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="flex gap-3 justify-between">
                <button
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                  className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => setStep(Math.min(steps.length - 1, step + 1))}
                  disabled={step === steps.length - 1}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold"
                >
                  Next →
                </button>
              </div>

              {/* Step Counter */}
              <div className="text-center text-xs text-gray-400 mt-4">
                Step {step + 1} of {steps.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickStartGuide;

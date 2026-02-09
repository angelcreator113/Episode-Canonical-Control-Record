/**
 * Script parsing utilities for scene detection and analysis
 */

const SCENE_PATTERNS = [
  /^SCENE\s+(\d+):\s*(.+)$/im,           // "SCENE 1: Title"
  /^INT\.\s+(.+?)\s*-\s*(.+)$/im,        // "INT. LOCATION - DAY"
  /^EXT\.\s+(.+?)\s*-\s*(.+)$/im,        // "EXT. LOCATION - DAY"
  /^SCENE\s+(\d+)\s*-\s*(.+)$/im,        // "SCENE 1 - Title"
  /^\[SCENE\s+(\d+)\]\s*(.+)$/im,        // "[SCENE 1] Title"
  /^ACT\s+(\d+):\s*(.+)$/im              // "ACT 1: Title"
];

/**
 * Parse script and extract scenes
 */
function parseScriptScenes(scriptText) {
  if (!scriptText) return [];

  const lines = scriptText.split('\n');
  const scenes = [];
  let currentSceneNumber = 0;

  lines.forEach((line, index) => {
    line = line.trim();
    if (!line) return;

    for (const pattern of SCENE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        currentSceneNumber++;
        
        let sceneName = '';
        if (match[2]) {
          sceneName = match[2].trim();
        } else if (match[1] && isNaN(match[1])) {
          sceneName = match[1].trim();
        }

        scenes.push({
          scene_number: currentSceneNumber,
          name: sceneName,
          description: '',
          line_number: index + 1,
          raw_line: line
        });
        break;
      }
    }
  });

  return scenes;
}

/**
 * Estimate scene duration from content (1 word ≈ 0.4 seconds spoken)
 */
function estimateSceneDuration(sceneText) {
  if (!sceneText) return 60;
  
  const words = sceneText.trim().split(/\s+/).length;
  const estimatedSeconds = Math.max(30, Math.round(words * 0.4));
  
  return estimatedSeconds;
}

/**
 * Extract content for a specific scene
 */
function extractSceneContent(scriptText, sceneNumber) {
  const lines = scriptText.split('\n');
  const scenes = parseScriptScenes(scriptText);
  
  if (sceneNumber > scenes.length) return '';
  
  const currentScene = scenes[sceneNumber - 1];
  const nextScene = scenes[sceneNumber];
  
  const startLine = currentScene.line_number;
  const endLine = nextScene ? nextScene.line_number : lines.length;
  
  return lines.slice(startLine, endLine).join('\n').trim();
}

/**
 * Analyze writing patterns from scripts
 */
function analyzeWritingPatterns(scripts) {
  if (!scripts || scripts.length === 0) {
    return getDefaultPatterns();
  }

  const allText = scripts.map(s => s.content || '').join(' ');
  const words = allText.split(/\s+/);
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim());

  // Word frequency analysis
  const wordFreq = {};
  words.forEach(word => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (clean.length > 3) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  });

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  // Average sentence length
  const avgSentenceLength = sentences.length > 0
    ? Math.round(words.length / sentences.length)
    : 12;

  // Detect emotional tone
  const positiveWords = ['amazing', 'love', 'beautiful', 'perfect', 'stunning', 'gorgeous'];
  const energeticWords = ['excited', 'ready', 'let\'s', 'incredible', 'wow'];
  
  const positiveCount = positiveWords.filter(w => allText.toLowerCase().includes(w)).length;
  const energeticCount = energeticWords.filter(w => allText.toLowerCase().includes(w)).length;
  
  const tone = energeticCount > positiveCount ? 'energetic' : 'positive';

  return {
    avg_sentence_length: avgSentenceLength,
    favorite_words: topWords,
    emotional_tone: tone,
    total_scripts_analyzed: scripts.length,
    avg_script_length: Math.round(words.length / scripts.length)
  };
}

function getDefaultPatterns() {
  return {
    avg_sentence_length: 12,
    favorite_words: ['amazing', 'beautiful', 'stunning', 'perfect'],
    emotional_tone: 'positive',
    total_scripts_analyzed: 0,
    avg_script_length: 1500
  };
}

/**
 * Quality check: attention span analysis
 */
function checkAttentionSpan(scriptText, targetDuration = 600) {
  const scenes = parseScriptScenes(scriptText);
  const warnings = [];

  scenes.forEach((scene, idx) => {
    const content = extractSceneContent(scriptText, idx + 1);
    const duration = estimateSceneDuration(content);

    // Check for long scenes without re-engagement
    if (duration > 120) {
      warnings.push({
        type: 'attention_span',
        severity: 'warning',
        scene: idx + 1,
        message: `Scene ${idx + 1} is ${duration}s long. Consider adding a re-engagement hook.`
      });
    }
  });

  // Check total duration
  const totalWords = scriptText.split(/\s+/).length;
  const estimatedTotal = Math.round(totalWords * 0.4);
  
  if (Math.abs(estimatedTotal - targetDuration) > 60) {
    warnings.push({
      type: 'duration',
      severity: estimatedTotal > targetDuration + 60 ? 'error' : 'warning',
      message: `Estimated runtime: ${Math.round(estimatedTotal / 60)}min (target: ${Math.round(targetDuration / 60)}min)`
    });
  }

  return warnings;
}

module.exports = {
  parseScriptScenes,
  estimateSceneDuration,
  extractSceneContent,
  analyzeWritingPatterns,
  checkAttentionSpan
};

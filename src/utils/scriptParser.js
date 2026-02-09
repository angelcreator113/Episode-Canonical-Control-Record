/**
 * Parse script text and extract scene information
 */

const SCENE_PATTERNS = [
  /^SCENE\s+(\d+):\s*(.+)$/im,           // "SCENE 1: Title"
  /^INT\.\s+(.+?)\s*-\s*(.+)$/im,        // "INT. LOCATION - DAY"
  /^EXT\.\s+(.+?)\s*-\s*(.+)$/im,        // "EXT. LOCATION - DAY"
  /^SCENE\s+(\d+)\s*-\s*(.+)$/im,        // "SCENE 1 - Title"
  /^\[SCENE\s+(\d+)\]\s*(.+)$/im         // "[SCENE 1] Title"
];

/**
 * Parse script and extract scenes
 * @param {string} scriptText - Raw script content
 * @returns {Array} Array of scene objects
 */
export function parseScriptScenes(scriptText) {
  if (!scriptText) return [];

  const lines = scriptText.split('\n');
  const scenes = [];
  let currentSceneNumber = 0;

  lines.forEach((line, index) => {
    line = line.trim();
    if (!line) return;

    // Try each pattern
    for (const pattern of SCENE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        currentSceneNumber++;
        
        // Extract scene name
        let sceneName = '';
        if (match[2]) {
          sceneName = match[2].trim();
        } else if (match[1]) {
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
 * Estimate scene duration from script content
 * Rough estimate: 1 second per line of script
 */
export function estimateSceneDuration(sceneText) {
  if (!sceneText) return 60; // Default 1 minute
  
  const lines = sceneText.split('\n').filter(l => l.trim());
  const estimatedSeconds = Math.max(30, lines.length * 1); // 1 second per line, min 30 sec
  
  return Math.round(estimatedSeconds);
}

/**
 * Extract scene content between scene headers
 */
export function extractSceneContent(scriptText, sceneNumber) {
  const lines = scriptText.split('\n');
  const scenes = parseScriptScenes(scriptText);
  
  if (sceneNumber > scenes.length) return '';
  
  const currentScene = scenes[sceneNumber - 1];
  const nextScene = scenes[sceneNumber];
  
  const startLine = currentScene.line_number;
  const endLine = nextScene ? nextScene.line_number : lines.length;
  
  return lines.slice(startLine, endLine).join('\n').trim();
}

export default {
  parseScriptScenes,
  estimateSceneDuration,
  extractSceneContent
};

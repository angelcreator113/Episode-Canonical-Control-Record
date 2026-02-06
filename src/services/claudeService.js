'use strict';

const Anthropic = require('@anthropic-ai/sdk');

/**
 * Claude AI Service
 * Handles all Claude API interactions for script analysis
 */
class ClaudeService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Analyze script and detect scenes with metadata
   * @param {string} scriptContent - Full script text
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeScript(scriptContent, options = {}) {
    const prompt = this._buildScriptAnalysisPrompt(scriptContent, options);

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.3, // Lower temperature for consistent structured output
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract JSON from response
      const responseText = message.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from Claude response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        scenes: analysis.scenes || [],
        totalDuration: analysis.total_duration || 0,
        overallPacing: analysis.overall_pacing || 'medium',
        confidenceScore: analysis.confidence_score || 0.85,
        suggestions: analysis.suggestions || [],
        warnings: analysis.warnings || [],
      };

    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Script analysis failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for script analysis
   * @private
   */
  _buildScriptAnalysisPrompt(scriptContent, options) {
    const targetDuration = options.targetDuration || 180;
    const pacing = options.pacing || 'medium';
    
    return `You are analyzing a video production script for "Styling Adventures w Lala", a fashion and lifestyle video series. Your task is to detect scenes, estimate durations, identify energy levels, and suggest visual requirements.

**TARGET VIDEO DURATION:** ${targetDuration} seconds (${Math.floor(targetDuration / 60)}:${(targetDuration % 60).toString().padStart(2, '0')})
**DESIRED PACING:** ${pacing}

**SCRIPT:**
${scriptContent}

**INSTRUCTIONS:**
1. Identify distinct scenes in the script (intro, main content sections, transitions, outro)
2. Distribute scene durations to reach approximately ${targetDuration} seconds total, with ${pacing} pacing:
   - slow pacing: More detailed scenes, longer shots, thorough coverage
   - medium pacing: Balanced pacing, standard cuts, natural flow
   - fast pacing: Quick cuts, dynamic energy, condensed content
3. For each scene, provide:
   - scene_id: A descriptive identifier (e.g., "INTRO", "MAIN-1", "OUTFIT-REVEAL")
   - scene_type: One of: intro, main, transition, outro
   - duration_target_seconds: Estimated duration (distribute to reach ${targetDuration}s total)
   - energy_level: One of: high, medium, low
   - estimated_clips_needed: How many video clips this scene likely needs
   - visual_requirements: Array of visual needs (e.g., ["close-up of outfit", "wide shot of location", "B-roll of accessories"])

3. Calculate total estimated duration
4. Assess overall pacing (fast/medium/slow/dynamic)
5. Provide a confidence score (0.0-1.0) for your analysis
6. Include any suggestions or warnings

**OUTPUT FORMAT:**
Respond ONLY with valid JSON (no markdown, no explanation):
{
  "scenes": [
    {
      "scene_id": "INTRO",
      "scene_type": "intro",
      "duration_target_seconds": 15,
      "energy_level": "high",
      "estimated_clips_needed": 3,
      "visual_requirements": ["opening shot", "title card", "host introduction"]
    }
  ],
  "total_duration": 180,
  "overall_pacing": "dynamic",
  "confidence_score": 0.90,
  "suggestions": ["Consider adding B-roll for outfit details", "Intro could be shortened by 5 seconds"],
  "warnings": ["Scene 3 duration may be too long (60s), consider splitting"]
}

Analyze the script now and return JSON only.`;
  }

  /**
   * Check if API key is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}

module.exports = new ClaudeService();

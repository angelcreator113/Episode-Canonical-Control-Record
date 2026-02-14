/**
 * Production Package Service
 * Generates complete production packages with all files bundled
 * 
 * Package Structure (Organized Folders):
 * EPISODE_X_PRODUCTION_PACKAGE/
 * ├── scripts/
 * │   ├── final_script.md
 * │   └── final_script.json
 * ├── cues/
 * │   ├── icon_cues.md
 * │   ├── icon_cues.json
 * │   ├── cursor_paths.json
 * │   └── music_cues.md
 * ├── metadata/
 * │   ├── publishing_info.md
 * │   └── state_tracker.json
 * └── README.md
 */

const { pool } = require('../db');
const AWS = require('aws-sdk');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
});

class ProductionPackageService {
  
  /**
   * Generate complete production package
   * @param {string} episodeId - Episode UUID
   * @param {object} options - Generation options
   * @returns {object} { package, fileCount }
   */
  async generatePackage(episodeId, options = {}) {
    const { userId } = options;
    
    try {
      console.log(`[ProductionPackageService] Generating package for episode ${episodeId}`);
      
      // Step 1: Get all data
      const data = await this.gatherAllData(episodeId);
      
      // Step 2: Generate file contents
      const files = await this.generateAllFiles(data);
      
      // Step 3: Determine package version
      const packageVersion = await this.getNextVersionNumber(episodeId);
      
      // Step 4: Create organized folder structure
      const packageData = this.buildPackageStructure(files);
      
      // Step 5: Create ZIP file
      const zipResult = await this.createZipFile(episodeId, packageVersion, files);
      
      // Step 6: Upload ZIP to S3
      const s3Url = await this.uploadToS3(zipResult.zipPath, episodeId, packageVersion);
      
      // Step 7: Save package record to database
      const packageRecord = await this.savePackageRecord(
        episodeId,
        packageVersion,
        packageData,
        files,
        s3Url,
        zipResult.fileSize,
        userId
      );
      
      // Step 8: Cleanup temp files
      await this.cleanupTempFiles(zipResult.zipPath);
      
      console.log(`[ProductionPackageService] Package created: ${packageVersion}`);
      
      return {
        package: packageRecord,
        fileCount: Object.keys(files).length,
      };
      
    } catch (error) {
      console.error('[ProductionPackageService] Error generating package:', error);
      throw error;
    }
  }
  
  /**
   * Gather all data needed for package
   */
  async gatherAllData(episodeId) {
    console.log('[ProductionPackageService] Gathering episode data...');
    
    // Episode
    const episodeResult = await pool.query(
      'SELECT * FROM episodes WHERE id = $1',
      [episodeId]
    );
    const episode = episodeResult.rows[0];
    
    if (!episode) {
      throw new Error('Episode not found');
    }
    
    // Show
    const showResult = await pool.query(
      'SELECT * FROM shows WHERE id = $1',
      [episode.show_id]
    );
    const show = showResult.rows[0];
    
    // Script
    const scriptResult = await pool.query(
      'SELECT * FROM episode_scripts WHERE episode_id = $1 ORDER BY created_at DESC LIMIT 1',
      [episodeId]
    );
    const script = scriptResult.rows[0] || null;
    
    // Icon Cues (approved only)
    const iconCuesResult = await pool.query(
      'SELECT * FROM icon_cues WHERE episode_id = $1 AND status = $2 ORDER BY timestamp ASC',
      [episodeId, 'approved']
    );
    const iconCues = iconCuesResult.rows;
    
    // Cursor Paths (approved only)
    const cursorPathsResult = await pool.query(
      'SELECT * FROM cursor_actions WHERE episode_id = $1 AND status = $2 ORDER BY timestamp ASC',
      [episodeId, 'approved']
    );
    const cursorPaths = cursorPathsResult.rows;
    
    // Music Cues (approved only)
    const musicCuesResult = await pool.query(
      'SELECT * FROM music_cues WHERE episode_id = $1 AND status = $2 ORDER BY start_time ASC',
      [episodeId, 'approved']
    );
    const musicCues = musicCuesResult.rows;
    
    // Lala Formula (if exists)
    const formulaResult = await pool.query(
      'SELECT * FROM lala_formula_episodes WHERE episode_id = $1',
      [episodeId]
    );
    const formula = formulaResult.rows[0] || null;
    
    // Scenes
    const scenesResult = await pool.query(
      'SELECT * FROM scenes WHERE episode_id = $1 ORDER BY scene_number ASC',
      [episodeId]
    );
    const scenes = scenesResult.rows;
    
    return {
      episode,
      show,
      script,
      iconCues,
      cursorPaths,
      musicCues,
      formula,
      scenes,
    };
  }
  
  /**
   * Generate all file contents
   */
  async generateAllFiles(data) {
    console.log('[ProductionPackageService] Generating file contents...');
    
    const files = {};
    
    // === SCRIPTS FOLDER ===
    
    // Final Script (Markdown)
    if (data.script) {
      files['scripts/final_script.md'] = this.generateScriptMarkdown(data);
    }
    
    // Final Script (JSON)
    if (data.script || data.scenes.length > 0) {
      files['scripts/final_script.json'] = JSON.stringify(
        this.generateScriptJSON(data),
        null,
        2
      );
    }
    
    // === CUES FOLDER ===
    
    // Icon Cues (Markdown)
    files['cues/icon_cues.md'] = this.generateIconCuesMarkdown(data.iconCues);
    
    // Icon Cues (JSON)
    files['cues/icon_cues.json'] = JSON.stringify(data.iconCues, null, 2);
    
    // Cursor Paths (JSON)
    files['cues/cursor_paths.json'] = JSON.stringify(data.cursorPaths, null, 2);
    
    // Music Cues (Markdown)
    files['cues/music_cues.md'] = this.generateMusicCuesMarkdown(data.musicCues);
    
    // === METADATA FOLDER ===
    
    // Publishing Info
    files['metadata/publishing_info.md'] = this.generatePublishingInfo(data);
    
    // State Tracker (if formula exists)
    if (data.formula) {
      files['metadata/state_tracker.json'] = JSON.stringify(
        this.generateStateTracker(data),
        null,
        2
      );
    }
    
    // === ROOT ===
    
    // README
    files['README.md'] = this.generateReadme(data);
    
    return files;
  }
  
  /**
   * Generate Final Script Markdown
   */
  generateScriptMarkdown(data) {
    const { episode, show, script } = data;
    
    let markdown = `# ${episode.title}\n\n`;
    markdown += `**Show:** ${show?.name || 'Unknown'}\n`;
    markdown += `**Episode:** Season ${episode.season_number}, Episode ${episode.episode_number}\n\n`;
    markdown += `---\n\n`;
    
    if (script && script.content) {
      markdown += script.content;
    } else {
      markdown += `*No script available*\n`;
    }
    
    return markdown;
  }
  
  /**
   * Generate Final Script JSON
   */
  generateScriptJSON(data) {
    const { episode, show, script, scenes, formula } = data;
    
    return {
      episode: {
        id: episode.id,
        title: episode.title,
        season: episode.season_number,
        episode_number: episode.episode_number,
        duration_seconds: episode.duration_seconds,
      },
      show: {
        id: show?.id,
        name: show?.name,
      },
      script: {
        content: script?.content || null,
        format: script?.format || 'markdown',
      },
      scenes: scenes.map(s => ({
        scene_number: s.scene_number,
        name: s.name,
        type: s.type,
        start_time: s.start_time_seconds,
        end_time: s.end_time_seconds,
        duration: s.duration_seconds,
      })),
      formula: formula ? {
        emotional_vibe: formula.emotional_vibe,
        interruption_type: formula.interruption_type,
        event_theme: formula.event_theme,
        stakes: formula.stakes,
      } : null,
    };
  }
  
  /**
   * Generate Icon Cues Markdown
   */
  generateIconCuesMarkdown(iconCues) {
    let markdown = `# Icon Cue Sheet\n\n`;
    markdown += `Total Cues: ${iconCues.length}\n\n`;
    markdown += `| Time | Slot | Action | Icon | Transition | Notes |\n`;
    markdown += `|------|------|--------|------|------------|-------|\n`;
    
    iconCues.forEach(cue => {
      const time = this.formatTimestamp(cue.timestamp);
      markdown += `| ${time} | ${cue.slot_id} | ${cue.action} | ${cue.asset_id || 'N/A'} | ${cue.transition || 'N/A'} | ${cue.notes || ''} |\n`;
    });
    
    return markdown;
  }
  
  /**
   * Generate Music Cues Markdown
   */
  generateMusicCuesMarkdown(musicCues) {
    let markdown = `# Music Cue Sheet\n\n`;
    markdown += `Total Cues: ${musicCues.length}\n\n`;
    
    musicCues.forEach((cue, index) => {
      markdown += `## ${index + 1}. ${cue.scene_name}\n\n`;
      markdown += `- **Time:** ${this.formatTimestamp(cue.start_time)}`;
      if (cue.end_time) {
        markdown += ` - ${this.formatTimestamp(cue.end_time)}`;
      }
      markdown += `\n`;
      markdown += `- **Track Type:** ${cue.track_type}\n`;
      markdown += `- **Intensity:** ${cue.intensity}\n`;
      if (cue.track_name) {
        markdown += `- **Track:** ${cue.track_name}\n`;
      }
      if (cue.mood) {
        markdown += `- **Mood:** ${cue.mood}\n`;
      }
      if (cue.notes) {
        markdown += `- **Notes:** ${cue.notes}\n`;
      }
      markdown += `\n`;
    });
    
    return markdown;
  }
  
  /**
   * Generate Publishing Info
   */
  generatePublishingInfo(data) {
    const { episode, show } = data;
    
    let markdown = `# Publishing Information\n\n`;
    markdown += `## Episode Details\n\n`;
    markdown += `- **Title:** ${episode.title}\n`;
    markdown += `- **Show:** ${show?.name || 'Unknown'}\n`;
    markdown += `- **Season:** ${episode.season_number}\n`;
    markdown += `- **Episode:** ${episode.episode_number}\n`;
    markdown += `- **Duration:** ${episode.duration_seconds}s (${Math.floor(episode.duration_seconds / 60)}:${String(episode.duration_seconds % 60).padStart(2, '0')})\n\n`;
    
    markdown += `## YouTube Information\n\n`;
    markdown += `*Title and description to be generated*\n\n`;
    
    markdown += `## Distribution Checklist\n\n`;
    markdown += `- [ ] YouTube upload\n`;
    markdown += `- [ ] Instagram shorts\n`;
    markdown += `- [ ] TikTok shorts\n`;
    markdown += `- [ ] Thumbnail generated\n`;
    markdown += `- [ ] Metadata confirmed\n`;
    
    return markdown;
  }
  
  /**
   * Generate State Tracker
   */
  generateStateTracker(data) {
    const { formula, episode } = data;
    
    return {
      episode_id: episode.id,
      starting_state: {
        coins: formula.starting_coins || 0,
        confidence: formula.starting_confidence || 50,
        reputation: formula.starting_reputation || 50,
      },
      ending_state: {
        coins: formula.ending_coins || 0,
        confidence: formula.ending_confidence || 50,
        reputation: formula.ending_reputation || 50,
      },
      deltas: {
        coins: (formula.ending_coins || 0) - (formula.starting_coins || 0),
        confidence: (formula.ending_confidence || 50) - (formula.starting_confidence || 50),
        reputation: (formula.ending_reputation || 50) - (formula.starting_reputation || 50),
      },
      gallery_updates: formula.gallery_updates || [],
      achievements_unlocked: formula.achievements_unlocked || [],
    };
  }
  
  /**
   * Generate README
   */
  generateReadme(data) {
    const { episode, show } = data;
    
    let markdown = `# Production Package: ${episode.title}\n\n`;
    markdown += `**Show:** ${show?.name || 'Unknown'}\n`;
    markdown += `**Episode:** S${episode.season_number}E${episode.episode_number}\n`;
    markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    markdown += `## Package Contents\n\n`;
    markdown += `### 📄 Scripts\n`;
    markdown += `- \`scripts/final_script.md\` - Human-readable script\n`;
    markdown += `- \`scripts/final_script.json\` - Structured script data\n\n`;
    
    markdown += `### 🎨 Cues\n`;
    markdown += `- \`cues/icon_cues.md\` - Icon appearance timeline (Markdown)\n`;
    markdown += `- \`cues/icon_cues.json\` - Icon appearance timeline (JSON)\n`;
    markdown += `- \`cues/cursor_paths.json\` - Cursor movement paths\n`;
    markdown += `- \`cues/music_cues.md\` - Music intensity cue sheet\n\n`;
    
    markdown += `### 📊 Metadata\n`;
    markdown += `- \`metadata/publishing_info.md\` - Title, description, platform info\n`;
    markdown += `- \`metadata/state_tracker.json\` - Episode state changes\n\n`;
    
    markdown += `## How to Use\n\n`;
    markdown += `1. **Review Final Script** - Check \`scripts/final_script.md\`\n`;
    markdown += `2. **Import Icon Cues** - Use \`cues/icon_cues.json\` in editor\n`;
    markdown += `3. **Import Cursor Paths** - Use \`cues/cursor_paths.json\` for cursor animation\n`;
    markdown += `4. **Apply Music Cues** - Follow \`cues/music_cues.md\` for music layering\n`;
    markdown += `5. **Publish** - Use \`metadata/publishing_info.md\` for platform upload\n\n`;
    
    markdown += `## Support\n\n`;
    markdown += `For questions or issues, contact the Prime Studios production team.\n`;
    
    return markdown;
  }
  
  /**
   * Build package structure
   */
  buildPackageStructure(files) {
    return {
      structure: 'organized_folders',
      folders: ['scripts', 'cues', 'metadata'],
      files: Object.keys(files),
      total_files: Object.keys(files).length,
    };
  }
  
  /**
   * Get next version number
   */
  async getNextVersionNumber(episodeId) {
    const result = await pool.query(
      'SELECT package_version FROM production_packages WHERE episode_id = $1 ORDER BY created_at DESC LIMIT 1',
      [episodeId]
    );
    
    if (result.rows.length === 0) {
      return 'v1';
    }
    
    const lastVersion = result.rows[0].package_version;
    const versionNumber = parseInt(lastVersion.replace('v', '')) || 0;
    return `v${versionNumber + 1}`;
  }
  
  /**
   * Create ZIP file
   */
  async createZipFile(episodeId, packageVersion, files) {
    const tmpDir = '/tmp';
    const zipFilename = `EPISODE_${episodeId}_${packageVersion}.zip`;
    const zipPath = path.join(tmpDir, zipFilename);
    
    console.log(`[ProductionPackageService] Creating ZIP: ${zipPath}`);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        const fileSize = archive.pointer();
        console.log(`[ProductionPackageService] ZIP created: ${fileSize} bytes`);
        resolve({ zipPath, fileSize });
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.pipe(output);
      
      // Add files to archive
      Object.keys(files).forEach(filename => {
        archive.append(files[filename], { name: filename });
      });
      
      archive.finalize();
    });
  }
  
  /**
   * Upload ZIP to S3
   */
  async uploadToS3(zipPath, episodeId, packageVersion) {
    const bucketName = process.env.S3_PRODUCTION_PACKAGES_BUCKET || 'episode-metadata-production-packages';
    const s3Key = `episodes/${episodeId}/${packageVersion}.zip`;
    
    console.log(`[ProductionPackageService] Uploading to S3: ${bucketName}/${s3Key}`);
    
    const fileContent = fs.readFileSync(zipPath);
    
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/zip',
    };
    
    await s3.upload(params).promise();
    
    // Generate pre-signed URL (valid for 7 days)
    const presignedUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: s3Key,
      Expires: 7 * 24 * 60 * 60, // 7 days
    });
    
    return presignedUrl;
  }
  
  /**
   * Save package record to database
   */
  async savePackageRecord(episodeId, packageVersion, packageData, files, s3Url, fileSize, userId) {
    // Mark all previous packages as not latest
    await pool.query(
      'UPDATE production_packages SET is_latest = false WHERE episode_id = $1',
      [episodeId]
    );
    
    // Insert new package
    const result = await pool.query(
      `INSERT INTO production_packages (
        episode_id, package_version, is_latest,
        package_data,
        final_script_md, final_script_json,
        icon_cues_md, icon_cues_json,
        cursor_paths_json, music_cues_md,
        publishing_info_md, state_tracker_json,
        zip_file_s3_url, zip_file_size_bytes,
        generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        episodeId,
        packageVersion,
        true, // is_latest
        JSON.stringify(packageData),
        files['scripts/final_script.md'] || null,
        files['scripts/final_script.json'] || null,
        files['cues/icon_cues.md'] || null,
        files['cues/icon_cues.json'] || null,
        files['cues/cursor_paths.json'] || null,
        files['cues/music_cues.md'] || null,
        files['metadata/publishing_info.md'] || null,
        files['metadata/state_tracker.json'] || null,
        s3Url,
        fileSize,
        userId || 'system',
      ]
    );
    
    return result.rows[0];
  }
  
  /**
   * Cleanup temporary files
   */
  async cleanupTempFiles(zipPath) {
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        console.log(`[ProductionPackageService] Cleaned up temp file: ${zipPath}`);
      }
    } catch (error) {
      console.error('[ProductionPackageService] Error cleaning up temp files:', error);
    }
  }
  
  /**
   * Format timestamp for display
   */
  formatTimestamp(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}

module.exports = new ProductionPackageService();

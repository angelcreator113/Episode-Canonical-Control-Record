const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { AITrainingData } = require('../models');

const execAsync = promisify(exec);

const s3Client = new S3Client({ 
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

class YouTubeService {
  
  /**
   * Validate YouTube URL
   */
  isValidURL(url) {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return regex.test(url);
  }

  /**
   * Extract video ID from URL
   */
  getVideoID(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Get video metadata using yt-dlp
   */
  async getMetadata(url) {
    try {
      console.log('📊 Fetching metadata with yt-dlp...');
      
      const { stdout } = await execAsync(
        `python -m yt_dlp --dump-json --socket-timeout 15 "${url}"`,
        { 
          timeout: 30000, // 30 seconds
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }
      );
      const info = JSON.parse(stdout);
      
      console.log(`✅ Metadata fetched: ${info.title}`);
      
      return {
        videoId: info.id,
        title: info.title,
        description: info.description || '',
        lengthSeconds: info.duration || 0,
        viewCount: info.view_count || 0,
        author: info.uploader || 'Unknown',
        channelUrl: info.uploader_url || '',
        uploadDate: info.upload_date || new Date().toISOString(),
        thumbnails: info.thumbnails || [],
        keywords: info.tags || [],
        category: info.categories?.[0] || 'Unknown',
        isLiveContent: info.is_live || false,
        width: info.width,
        height: info.height,
        fps: info.fps
      };
    } catch (error) {
      console.error('yt-dlp metadata error:', error.message);
      
      if (error.killed) {
        throw new Error('Metadata fetch timed out after 30 seconds. YouTube may be blocking requests or network is slow.');
      }
      
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }

  /**
   * Download video using yt-dlp
   */
  async downloadVideo(url, outputPath) {
    try {
      console.log('⬇️ Downloading video with yt-dlp...');
      
      // Remove .mp4 extension if present for yt-dlp template
      const outputTemplate = outputPath.replace(/\.mp4$/, '');
      
      // Download with progress - yt-dlp will add the extension
      const command = `python -m yt_dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 --socket-timeout 20 -o "${outputTemplate}.%(ext)s" "${url}"`;
      
      console.log(`📁 Output template: ${outputTemplate}`);
      await execAsync(command, { 
        timeout: 300000, // 5 minutes for download
        maxBuffer: 1024 * 1024 * 100 // 100MB buffer
      });
      
      // Check for the downloaded file with .mp4 extension
      const possiblePaths = [
        `${outputTemplate}.mp4`,
        `${outputTemplate}.mkv`,
        `${outputTemplate}.webm`,
        outputPath // Original path as fallback
      ];
      
      let finalPath = null;
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          finalPath = testPath;
          console.log(`✅ Found downloaded file: ${finalPath}`);
          break;
        }
      }
      
      if (!finalPath) {
        // List files in directory to debug
        const dir = path.dirname(outputTemplate);
        const files = fs.readdirSync(dir);
        console.error(`Files in ${dir}:`, files);
        throw new Error('Download completed but file not found in expected locations');
      }
      
      const stats = fs.statSync(finalPath);
      console.log(`✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      return {
        path: finalPath,
        size: stats.size
      };
      
      if (error.killed) {
        throw new Error('Video download timed out after 5 minutes. The video may be too large or network is slow.');
      }
      
      
    } catch (error) {
      console.error('yt-dlp download error:', error.message);
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Upload to S3
   */
  async uploadToS3(localPath, videoId, deleteAfter = false) {
    try {
      const fileContent = fs.readFileSync(localPath);
      const s3Key = `training-videos/${videoId}.mp4`;
      const bucketName = process.env.S3_TRAINING_DATA_BUCKET || 'episode-metadata-training-data-dev';

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'video/mp4'
      });

      await s3Client.send(command);

      if (deleteAfter) {
        fs.unlinkSync(localPath);
        console.log('🧹 Deleted local temp file');
      }

      const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

      return {
        bucket: bucketName,
        key: s3Key,
        url: s3Url
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Analyze with Claude
   */
  async analyzeWithClaude(metadata) {
    try {
      const claudeService = require('./claudeService');
      
      const prompt = `Analyze this YouTube video for content style and production patterns.

VIDEO INFORMATION:
Title: ${metadata.title}
Channel: ${metadata.author}
Duration: ${Math.floor(metadata.lengthSeconds / 60)} minutes ${metadata.lengthSeconds % 60} seconds
Views: ${metadata.viewCount?.toLocaleString() || 'N/A'}
Category: ${metadata.category || 'N/A'}
Keywords: ${metadata.keywords?.join(', ') || 'None'}

Description (first 500 chars):
${metadata.description?.substring(0, 500) || 'No description'}...

REQUIRED ANALYSIS - Return ONLY valid JSON, no markdown formatting:

{
  "content_style": "one of: Educational tutorial | Entertainment vlog | Product review | How-to guide | Storytelling | Interview | Behind-the-scenes | Other",
  "pacing": "one of: Fast-paced | Medium-paced | Slow-paced",
  "tone_primary": "one of: Professional | Casual | Energetic | Calm | Humorous | Inspirational",
  "tone_secondary": "optional secondary tone",
  "target_audience": {
    "age_range": "e.g. 18-35",
    "gender_focus": "Male | Female | All | N/A",
    "expertise_level": "Beginner | Intermediate | Expert"
  },
  "key_topics": ["topic1", "topic2", "topic3"],
  "editing_patterns": {
    "jump_cuts": "high | medium | low",
    "b_roll_usage": "frequent | occasional | rare",
    "text_overlays": "frequent | occasional | none",
    "music_style": "describe music style",
    "transitions": "quick cuts | smooth | mixed"
  },
  "emotional_hooks": ["hook1", "hook2"],
  "production_quality": {
    "lighting": "professional | good | basic",
    "audio": "professional | good | basic",
    "set_design": "studio | home | outdoor | other"
  },
  "engagement_techniques": ["technique1", "technique2"],
  "style_summary": "2-3 sentences describing the unique style of this video"
}

Return ONLY the JSON object above with actual analysis values. No markdown code blocks, no extra text.`;

      const analysisText = await claudeService.analyzeText(prompt, 4000);
      
      console.log('Raw Claude response:', analysisText.substring(0, 200));
      
      let jsonData;
      
      try {
        jsonData = JSON.parse(analysisText);
      } catch (e1) {
        console.log('Direct parse failed, trying to extract JSON...');
        
        const codeBlockMatch = analysisText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          try {
            jsonData = JSON.parse(codeBlockMatch[1]);
          } catch (e2) {
            console.log('Code block parse failed');
          }
        }
        
        if (!jsonData) {
          const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              jsonData = JSON.parse(jsonMatch[0]);
            } catch (e3) {
              console.log('JSON extraction failed');
            }
          }
        }
      }
      
      if (jsonData) {
        console.log('✅ Successfully parsed JSON analysis');
        return jsonData;
      } else {
        console.log('❌ Could not parse JSON, returning raw text');
        return {
          error: 'Failed to parse JSON from Claude response',
          raw_analysis: analysisText,
          raw_metadata: metadata
        };
      }
      
    } catch (error) {
      console.error('Claude analysis error:', error);
      return {
        error: error.message,
        raw_metadata: metadata
      };
    }
  }

  /**
   * Process video (download, upload, analyze)
   */
  async processVideo(url, episodeId = null, detectScenes = false) {
    let videoPath = null;
    
    try {
      console.log('🎬 Starting YouTube video processing...');
      
      if (!this.isValidURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const videoId = this.getVideoID(url);
      console.log(`📺 Video ID: ${videoId}`);

      console.log('📊 Fetching metadata...');
      const metadata = await this.getMetadata(url);
      console.log(`✅ Metadata fetched: ${metadata.title}`);

      let s3Info = null;
      
      // Only download if scene detection is enabled
      if (detectScenes) {
        console.log('⬇️ Downloading video for scene detection...');
        videoPath = path.join(os.tmpdir(), `${videoId}.mp4`);
        const downloadResult = await this.downloadVideo(url, videoPath);
        console.log(`✅ Downloaded: ${(downloadResult.size / 1024 / 1024).toFixed(2)} MB`);

        console.log('☁️ Uploading to S3...');
        s3Info = await this.uploadToS3(videoPath, videoId, false); // Keep file for scene detection
        console.log(`✅ Uploaded to S3: ${s3Info.url}`);
      } else {
        console.log('⏭️ Skipping download (scene detection disabled)');
      }

      console.log('🤖 Analyzing with Claude AI...');
      const analysis = await this.analyzeWithClaude(metadata);
      console.log('✅ Analysis complete');

      console.log('💾 Saving to database...');
      const trainingData = await AITrainingData.create({
        episode_id: episodeId,
        source_type: 'youtube',
        video_id: videoId,
        video_title: metadata.title,
        video_url: url,
        duration_seconds: metadata.lengthSeconds,
        s3_key: s3Info?.key || null,
        pacing_rhythm: analysis?.pacing || 'medium',
        transition_patterns: analysis?.editing_patterns || {},
        overlay_usage: analysis?.overlay_usage || {},
        text_style: analysis?.text_style || {},
        music_presence: true,
        is_user_style: true,
        analyzed_at: new Date()
      });
      console.log(`✅ Saved to database: ${trainingData.id}`);

      return { trainingData, videoPath };

    } catch (error) {
      console.error('❌ Processing error:', error);
      
      if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      
      throw error;
    }
  }

  /**
   * Process scenes
   */
  async processScenes(trainingVideoId, videoPath, metadata) {
    try {
      const ffmpegService = require('./ffmpegService');
      const { sequelize } = require('../models');
      
      console.log('🎬 Starting scene detection...');

      const videoMetadata = await ffmpegService.getVideoMetadata(videoPath);
      const duration = videoMetadata.duration;
      
      console.log(`📹 Video duration: ${duration.toFixed(2)}s`);

      const sceneChanges = await ffmpegService.detectScenes(videoPath, 0.4);
      
      if (sceneChanges.length === 0) {
        console.log('⚠️ No scene changes detected');
        return [];
      }

      const scenes = ffmpegService.buildSceneData(sceneChanges, duration);
      console.log(`📊 Built ${scenes.length} scenes`);

      const tempDir = path.join(os.tmpdir(), `scenes_${trainingVideoId}`);
      const timestamps = scenes.map(s => s.start_time + (s.duration / 2));
      const framePaths = await ffmpegService.extractFrames(videoPath, timestamps, tempDir);

      const savedScenes = [];
      
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const framePath = framePaths[i];

        const s3Info = await ffmpegService.uploadFrameToS3(
          framePath,
          metadata.videoId,
          scene.scene_number
        );

        const characteristics = await ffmpegService.analyzeSceneCharacteristics(
          videoPath,
          scene.start_time,
          scene.duration
        );

        const sceneAnalysis = await this.analyzeSceneType(scene, i, scenes.length);

        const [sceneRecord] = await sequelize.query(`
          INSERT INTO video_scenes (
            training_video_id,
            scene_number,
            start_time,
            end_time,
            duration,
            thumbnail_url,
            thumbnail_s3_key,
            scene_type,
            brightness_level,
            motion_level,
            has_music,
            has_text_overlay,
            analysis_result
          ) VALUES (
            :training_video_id,
            :scene_number,
            :start_time,
            :end_time,
            :duration,
            :thumbnail_url,
            :thumbnail_s3_key,
            :scene_type,
            :brightness_level,
            :motion_level,
            :has_music,
            :has_text_overlay,
            :analysis_result
          ) RETURNING *
        `, {
          replacements: {
            training_video_id: trainingVideoId,
            scene_number: scene.scene_number,
            start_time: scene.start_time,
            end_time: scene.end_time,
            duration: scene.duration,
            thumbnail_url: s3Info.url,
            thumbnail_s3_key: s3Info.s3_key,
            scene_type: sceneAnalysis.scene_type,
            brightness_level: characteristics.brightness_level,
            motion_level: characteristics.motion_level,
            has_music: characteristics.has_music,
            has_text_overlay: characteristics.has_text_overlay,
            analysis_result: JSON.stringify(sceneAnalysis)
          },
          type: sequelize.QueryTypes.INSERT
        });

        savedScenes.push(sceneRecord);
        console.log(`  ✅ Scene ${scene.scene_number}: ${sceneAnalysis.scene_type} (${scene.duration.toFixed(1)}s)`);
      }

      await ffmpegService.cleanup(tempDir);

      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log('🧹 Deleted temp video file');
      }

      console.log(`🎉 Processed ${savedScenes.length} scenes successfully`);
      return savedScenes;

    } catch (error) {
      console.error('❌ Scene processing error:', error);
      
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      
      throw error;
    }
  }

  async analyzeSceneType(scene, index, totalScenes) {
    const claudeService = require('./claudeService');

    const prompt = `Analyze this video scene and determine its type.

SCENE INFO:
Scene Number: ${scene.scene_number} of ${totalScenes}
Position: ${index === 0 ? 'First' : index === totalScenes - 1 ? 'Last' : 'Middle'}
Duration: ${scene.duration.toFixed(1)} seconds
Start Time: ${scene.start_time.toFixed(1)}s
End Time: ${scene.end_time.toFixed(1)}s

Based on position and duration, what is this scene likely to be?

Return ONLY valid JSON:
{
  "scene_type": "one of: intro | main-content | b-roll | transition | tutorial | talking-head | product-showcase | outro | montage",
  "shot_type": "one of: wide | medium | close-up | extreme-close-up | over-shoulder | point-of-view",
  "likely_content": "brief description of what's likely happening",
  "confidence": 0.0-1.0
}`;

    try {
      const response = await claudeService.analyzeText(prompt, 500);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Scene type analysis error:', error.message);
    }

    if (index === 0) {
      return { scene_type: 'intro', shot_type: 'wide', likely_content: 'Opening scene', confidence: 0.7 };
    } else if (index === totalScenes - 1) {
      return { scene_type: 'outro', shot_type: 'wide', likely_content: 'Closing scene', confidence: 0.7 };
    } else {
      return { scene_type: 'main-content', shot_type: 'medium', likely_content: 'Main content', confidence: 0.5 };
    }
  }

  async getTrainingVideos(filters = {}) {
    const where = {};
    
    if (filters.episode_id) {
      where.episode_id = filters.episode_id;
    }
    
    if (filters.status) {
      where.processing_status = filters.status;
    }
    
    where.source_type = 'youtube';

    return await AITrainingData.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
  }

  async getTrainingVideo(id) {
    return await AITrainingData.findByPk(id);
  }

  async deleteTrainingVideo(id) {
    const video = await AITrainingData.findByPk(id);
    
    if (video && video.s3_key) {
      // TODO: Delete from S3
    }
    
    await video.destroy();
  }
}

module.exports = new YouTubeService();

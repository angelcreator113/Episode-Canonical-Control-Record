const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { AITrainingData } = require('../models');
const claudeService = require('./claudeService');

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
    return ytdl.validateURL(url);
  }

  /**
   * Extract video ID from URL
   */
  getVideoID(url) {
    return ytdl.getVideoID(url);
  }

  /**
   * Get video metadata without downloading
   */
  async getMetadata(url) {
    try {
      const info = await ytdl.getInfo(url);
      
      return {
        videoId: info.videoDetails.videoId,
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        lengthSeconds: parseInt(info.videoDetails.lengthSeconds),
        viewCount: parseInt(info.videoDetails.viewCount),
        author: info.videoDetails.author.name,
        channelUrl: info.videoDetails.author.channel_url,
        uploadDate: info.videoDetails.uploadDate,
        thumbnails: info.videoDetails.thumbnails,
        keywords: info.videoDetails.keywords || [],
        category: info.videoDetails.category,
        isLiveContent: info.videoDetails.isLiveContent
      };
    } catch (error) {
      // Return minimal metadata if full extraction fails
      console.warn('⚠️ Full metadata extraction failed, using fallback:', error.message);
      const videoId = this.getVideoID(url);
      return {
        videoId: videoId,
        title: `YouTube Video ${videoId}`,
        description: '',
        lengthSeconds: 0,
        viewCount: 0,
        author: 'Unknown',
        channelUrl: '',
        uploadDate: new Date().toISOString(),
        thumbnails: [],
        keywords: [],
        category: 'Unknown',
        isLiveContent: false
      };
    }
  }

  /**
   * Download video to local temp storage
   */
  async downloadVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const video = ytdl(url, {
          quality: 'highest',
          filter: 'videoandaudio'
        });

        const writeStream = fs.createWriteStream(outputPath);
        
        video.pipe(writeStream);

        let downloadedBytes = 0;
        video.on('progress', (chunkLength, downloaded, total) => {
          downloadedBytes = downloaded;
          const percent = (downloaded / total * 100).toFixed(2);
          console.log(`📥 Download progress: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)}MB / ${(total / 1024 / 1024).toFixed(2)}MB)`);
        });

        writeStream.on('finish', () => {
          console.log('✅ Video downloaded successfully');
          resolve({
            path: outputPath,
            size: downloadedBytes
          });
        });

        writeStream.on('error', reject);
        video.on('error', reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Upload video to S3 training bucket
   */
  async uploadToS3(localPath, videoId) {
    try {
      const fileContent = fs.readFileSync(localPath);
      const s3Key = `training-videos/${videoId}.mp4`;
      const bucketName = process.env.S3_TRAINING_BUCKET || 'episode-metadata-training';

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'video/mp4'
      });

      await s3Client.send(command);

      // Delete local file after upload
      fs.unlinkSync(localPath);

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
   * Analyze video metadata with Claude
   */
  async analyzeWithClaude(metadata) {
    try {
      const prompt = `
Analyze this YouTube video for content style and production patterns.

VIDEO INFORMATION:
Title: ${metadata.title}
Channel: ${metadata.author}
Duration: ${Math.floor(metadata.lengthSeconds / 60)} minutes ${metadata.lengthSeconds % 60} seconds
Views: ${metadata.viewCount.toLocaleString()}
Category: ${metadata.category}
Keywords: ${metadata.keywords.join(', ')}

Description:
${metadata.description.substring(0, 500)}...

ANALYSIS REQUIRED:

1. **Content Style** (choose one):
   - Educational tutorial
   - Entertainment vlog
   - Product review
   - How-to guide
   - Storytelling
   - Interview/conversation
   - Behind-the-scenes
   - Other (specify)

2. **Pacing** (choose one):
   - Fast-paced (quick cuts, high energy)
   - Medium-paced (balanced editing)
   - Slow-paced (contemplative, long takes)

3. **Tone** (choose primary + secondary):
   - Professional/Authoritative
   - Casual/Conversational
   - Energetic/Enthusiastic
   - Calm/Soothing
   - Humorous/Playful
   - Inspirational/Motivational

4. **Target Audience**:
   - Age range
   - Gender focus (if any)
   - Interest level (beginner, intermediate, expert)

5. **Key Topics** (list 3-5 main topics covered)

6. **Editing Patterns**:
   - Jump cuts frequency (high/medium/low)
   - B-roll usage
   - Text overlays
   - Music style
   - Transitions style

7. **Emotional Hooks** (what keeps viewers engaged)

8. **Production Quality**:
   - Lighting quality (professional/good/basic)
   - Audio quality (professional/good/basic)
   - Set design (studio/home/outdoor)

9. **Engagement Techniques**

10. **Overall Style Summary** (2-3 sentences describing the unique style)

Return response in JSON format with these exact keys:
{
  "content_style": "string",
  "pacing": "string",
  "tone_primary": "string",
  "tone_secondary": "string",
  "target_audience": {
    "age_range": "string",
    "gender_focus": "string",
    "expertise_level": "string"
  },
  "key_topics": ["string"],
  "editing_patterns": {
    "jump_cuts": "string",
    "b_roll_usage": "string",
    "text_overlays": "string",
    "music_style": "string",
    "transitions": "string"
  },
  "emotional_hooks": ["string"],
  "production_quality": {
    "lighting": "string",
    "audio": "string",
    "set_design": "string"
  },
  "engagement_techniques": ["string"],
  "style_summary": "string"
}
`;

      const analysis = await claudeService.analyzeText(prompt);
      
      // Parse JSON response
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { raw_analysis: analysis };
    } catch (error) {
      console.error('Claude analysis error:', error);
      return {
        error: error.message,
        raw_metadata: metadata
      };
    }
  }

  /**
   * Full workflow: download, upload, analyze, save
   */
  async processVideo(url) {
    try {
      console.log('🎬 Starting YouTube video processing...');
      
      // Step 1: Validate URL
      if (!this.isValidURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const videoId = this.getVideoID(url);
      console.log(`📺 Video ID: ${videoId}`);

      // Check if already exists
      const existing = await AITrainingData.findOne({ where: { video_id: videoId } });
      if (existing) {
        console.log('ℹ️ Video already in database');
        return existing.toJSON();
      }

      // Step 2: Get metadata
      console.log('📊 Fetching metadata...');
      const metadata = await this.getMetadata(url);
      console.log(`✅ Metadata fetched: ${metadata.title}`);

      // DEV MODE: Skip download/upload/analysis for now
      console.log('ℹ️ DEV MODE: Creating placeholder entry without full download');
      const trainingData = await AITrainingData.create({
        video_id: videoId,
        source_type: 'youtube',
        video_title: metadata.title,
        video_url: url,
        s3_key: null,
        duration_seconds: metadata.lengthSeconds || 180,
        pacing_rhythm: 'medium',
        transition_patterns: { cuts: 'frequent', dissolves: 'occasional' },
        overlay_usage: { text: 'moderate', graphics: 'minimal' },
        text_style: { font: 'modern', animation: 'subtle' },
        music_presence: true,
        is_user_style: true,
        analyzed_at: new Date()
      });
      console.log(`✅ Saved to database: ${trainingData.id}`);

      return {
        ...trainingData.toJSON(),
        metadata
      };

    } catch (error) {
      console.error('❌ Processing error:', error);
      throw error;
    }
  }

  /**
   * Get all training videos from database
   */
  async getTrainingVideos(filters = {}) {
    const where = { source_type: 'youtube' };
    
    return await AITrainingData.findAll({
      where,
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Get single training video
   */
  async getTrainingVideo(id) {
    return await AITrainingData.findByPk(id);
  }

  /**
   * Delete training video
   */
  async deleteTrainingVideo(id) {
    const video = await AITrainingData.findByPk(id);
    
    if (video) {
      await video.destroy();
    }
  }
}

module.exports = new YouTubeService();

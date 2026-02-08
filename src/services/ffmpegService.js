const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Configure FFmpeg paths
const ffmpegPath = process.env.FFMPEG_PATH || 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const ffprobePath = process.env.FFPROBE_PATH || 'C:\\ffmpeg\\bin\\ffprobe.exe';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const s3Client = new S3Client({ 
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

class FFmpegService {
  
  /**
   * Detect scene changes in a video
   * Returns array of scene timestamps
   */
  async detectScenes(videoPath, threshold = 0.4) {
    return new Promise((resolve, reject) => {
      const scenes = [];
      let sceneNumber = 0;
      
      console.log(`🎬 Detecting scenes in video (threshold: ${threshold})...`);
      
      ffmpeg(videoPath)
        .outputOptions([
          '-vf', `select='gt(scene\\,${threshold})',showinfo`,
          '-f', 'null'
        ])
        .output('-')
        .on('start', (cmd) => {
          console.log('FFmpeg command:', cmd);
        })
        .on('stderr', (stderrLine) => {
          // Parse scene detection output
          // Example: pts_time:15.234 pos:123456 scene:0.876
          const match = stderrLine.match(/pts_time:([\d.]+).*scene:([\d.]+)/);
          if (match) {
            const timestamp = parseFloat(match[1]);
            const sceneScore = parseFloat(match[2]);
            
            if (sceneScore > threshold) {
              sceneNumber++;
              scenes.push({
                scene_number: sceneNumber,
                timestamp,
                score: sceneScore
              });
              console.log(`  Scene ${sceneNumber}: ${timestamp.toFixed(2)}s (score: ${sceneScore.toFixed(3)})`);
            }
          }
        })
        .on('end', () => {
          console.log(`✅ Detected ${scenes.length} scene changes`);
          resolve(scenes);
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err.message);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Extract frames at specific timestamps
   */
  async extractFrames(videoPath, timestamps, outputDir) {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      const frames = [];

      console.log(`📸 Extracting ${timestamps.length} frames...`);

      for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const outputPath = path.join(outputDir, `scene_${i + 1}.jpg`);

        await new Promise((resolve, reject) => {
          ffmpeg(videoPath)
            .seekInput(timestamp)
            .frames(1)
            .output(outputPath)
            .on('end', () => {
              console.log(`  ✅ Frame ${i + 1}/${timestamps.length} extracted`);
              frames.push(outputPath);
              resolve();
            })
            .on('error', reject)
            .run();
        });
      }

      return frames;
    } catch (error) {
      throw new Error(`Frame extraction failed: ${error.message}`);
    }
  }

  /**
   * Get video metadata (duration, resolution, etc.)
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          resolve({
            duration: metadata.format.duration,
            size: metadata.format.size,
            bitrate: metadata.format.bit_rate,
            video: videoStream ? {
              codec: videoStream.codec_name,
              width: videoStream.width,
              height: videoStream.height,
              fps: eval(videoStream.r_frame_rate),
              aspect_ratio: videoStream.display_aspect_ratio
            } : null,
            audio: audioStream ? {
              codec: audioStream.codec_name,
              sample_rate: audioStream.sample_rate,
              channels: audioStream.channels
            } : null
          });
        }
      });
    });
  }

  /**
   * Upload frame to S3
   */
  async uploadFrameToS3(framePath, videoId, sceneNumber) {
    try {
      const fileContent = await fs.readFile(framePath);
      const s3Key = `scene-thumbnails/${videoId}/scene_${sceneNumber}.jpg`;
      const bucketName = process.env.S3_TRAINING_DATA_BUCKET || 'episode-metadata-training-data-dev';

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'image/jpeg'
      });

      await s3Client.send(command);

      const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

      return {
        s3_key: s3Key,
        url: s3Url
      };
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Build scene data from detected changes
   */
  buildSceneData(sceneChanges, videoDuration) {
    const scenes = [];
    
    // Add first scene (from start to first change)
    if (sceneChanges.length > 0) {
      scenes.push({
        scene_number: 1,
        start_time: 0,
        end_time: sceneChanges[0].timestamp,
        duration: sceneChanges[0].timestamp
      });
    }

    // Add middle scenes (between changes)
    for (let i = 0; i < sceneChanges.length - 1; i++) {
      scenes.push({
        scene_number: i + 2,
        start_time: sceneChanges[i].timestamp,
        end_time: sceneChanges[i + 1].timestamp,
        duration: sceneChanges[i + 1].timestamp - sceneChanges[i].timestamp
      });
    }

    // Add last scene (from last change to end)
    if (sceneChanges.length > 0) {
      const lastChange = sceneChanges[sceneChanges.length - 1];
      scenes.push({
        scene_number: sceneChanges.length + 1,
        start_time: lastChange.timestamp,
        end_time: videoDuration,
        duration: videoDuration - lastChange.timestamp
      });
    }

    return scenes;
  }

  /**
   * Analyze scene characteristics (brightness, motion, etc.)
   */
  async analyzeSceneCharacteristics(videoPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      let output = '';
      
      ffmpeg(videoPath)
        .seekInput(startTime)
        .duration(Math.min(duration, 5)) // Analyze max 5 seconds
        .outputOptions([
          '-vf', 'signalstats,metadata=print:file=-',
          '-f', 'null'
        ])
        .output('-')
        .on('stderr', (line) => {
          output += line + '\n';
        })
        .on('end', () => {
          // Parse brightness and other stats
          const brightness = this.parseBrightness(output);
          resolve({
            brightness_level: brightness,
            motion_level: 'medium', // TODO: Implement motion detection
            has_music: false, // TODO: Implement audio analysis
            has_text_overlay: false // TODO: Implement OCR
          });
        })
        .on('error', (err) => {
          // Don't fail if analysis fails, return defaults
          resolve({
            brightness_level: 'normal',
            motion_level: 'medium',
            has_music: false,
            has_text_overlay: false
          });
        })
        .run();
    });
  }

  parseBrightness(output) {
    // Simple brightness detection from stats
    if (output.includes('lavfi.signalstats.YAVG')) {
      const match = output.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
      if (match) {
        const yavg = parseFloat(match[1]);
        if (yavg < 60) return 'dark';
        if (yavg > 180) return 'bright';
        return 'normal';
      }
    }
    return 'normal';
  }

  /**
   * Clean up temporary files
   */
  async cleanup(directory) {
    try {
      const files = await fs.readdir(directory);
      for (const file of files) {
        await fs.unlink(path.join(directory, file));
      }
      await fs.rmdir(directory);
      console.log(`🧹 Cleaned up ${directory}`);
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }
}

module.exports = new FFmpegService();

const AWS = require('aws-sdk');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const s3 = new AWS.S3();
const transcribe = new AWS.TranscribeService();

/**
 * Lambda handler - Triggered by SQS queue
 */
exports.handler = async (event) => {
  console.log('Video analysis triggered:', JSON.stringify(event));

  for (const record of event.Records) {
    const jobData = JSON.parse(record.body);
    
    try {
      await processAnalysisJob(jobData);
    } catch (error) {
      console.error('Job failed:', error);
      await updateEditMapStatus(jobData.edit_map_id, 'failed', error.message);
    }
  }

  return { statusCode: 200, body: 'Processing complete' };
};

/**
 * Main analysis pipeline
 */
async function processAnalysisJob(jobData) {
  const { edit_map_id, raw_footage_id, s3_key, episode_id } = jobData;
  
  console.log(`Processing: ${raw_footage_id}`);
  
  // Update status to processing
  await updateEditMapStatus(edit_map_id, 'processing');

  // Step 1: Download video from S3 to /tmp
  const videoPath = await downloadFromS3(s3_key);
  
  // Step 2: Extract audio for ASR
  const audioPath = await extractAudio(videoPath);
  
  // Step 3: Speech-to-text (AWS Transcribe OR OpenAI Whisper)
  const transcript = await performASR(audioPath, raw_footage_id);
  
  // Step 4: Speaker diarization (identify who spoke when)
  const speakerSegments = await performDiarization(audioPath, transcript);
  
  // Step 5: Audio event detection (laughter, music, silence)
  const audioEvents = await detectAudioEvents(audioPath);
  
  // Step 6: Face tracking (OpenCV / face_recognition)
  const characterPresence = await trackFaces(videoPath);
  
  // Step 7: Active speaker detection (link voice to face)
  const activeSpeakerTimeline = await detectActiveSpeaker(
    speakerSegments,
    characterPresence
  );
  
  // Step 8: Scene boundary detection
  const sceneBoundaries = await detectSceneBoundaries(videoPath);
  
  // Step 9: Suggest natural cut points
  const suggestedCuts = await findNaturalCuts(transcript, audioEvents);
  
  // Step 10: B-roll opportunities
  const bRollOpportunities = await findBRollOpportunities(
    transcript,
    activeSpeakerTimeline
  );
  
  // Step 11: Get video duration
  const duration = await getVideoDuration(videoPath);
  
  // Step 12: Save edit map to database
  await saveEditMap(edit_map_id, {
    transcript,
    speaker_segments: speakerSegments,
    audio_events: audioEvents,
    character_presence: characterPresence,
    active_speaker_timeline: activeSpeakerTimeline,
    scene_boundaries: sceneBoundaries,
    suggested_cuts: suggestedCuts,
    b_roll_opportunities: bRollOpportunities,
    duration_seconds: duration
  });
  
  // Cleanup
  fs.unlinkSync(videoPath);
  fs.unlinkSync(audioPath);
  
  console.log(`✅ Analysis complete: ${edit_map_id}`);
}

/**
 * Download video from S3
 */
async function downloadFromS3(s3Key) {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: s3Key
  };
  
  const outputPath = `/tmp/${path.basename(s3Key)}`;
  const file = fs.createWriteStream(outputPath);
  
  return new Promise((resolve, reject) => {
    s3.getObject(params)
      .createReadStream()
      .pipe(file)
      .on('finish', () => resolve(outputPath))
      .on('error', reject);
  });
}

/**
 * Extract audio from video (for ASR)
 */
async function extractAudio(videoPath) {
  const audioPath = `/tmp/audio-${Date.now()}.wav`;
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => resolve(audioPath))
      .on('error', reject)
      .run();
  });
}

/**
 * Speech-to-text with AWS Transcribe
 */
async function performASR(audioPath, jobName) {
  // Upload audio to S3 for Transcribe
  const s3Key = `transcribe-temp/${jobName}-audio.wav`;
  
  await s3.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: fs.createReadStream(audioPath)
  }).promise();
  
  // Start transcription job
  const params = {
    TranscriptionJobName: `job-${jobName}-${Date.now()}`,
    LanguageCode: 'en-US',
    Media: {
      MediaFileUri: `s3://${process.env.S3_BUCKET}/${s3Key}`
    },
    OutputBucketName: process.env.S3_BUCKET,
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 5
    }
  };
  
  await transcribe.startTranscriptionJob(params).promise();
  
  // Poll for completion
  let jobStatus = 'IN_PROGRESS';
  let transcript = null;
  
  while (jobStatus === 'IN_PROGRESS') {
    await sleep(5000); // Wait 5 seconds
    
    const job = await transcribe.getTranscriptionJob({
      TranscriptionJobName: params.TranscriptionJobName
    }).promise();
    
    jobStatus = job.TranscriptionJob.TranscriptionJobStatus;
    
    if (jobStatus === 'COMPLETED') {
      const transcriptUri = job.TranscriptionJob.Transcript.TranscriptFileUri;
      const response = await axios.get(transcriptUri);
      transcript = parseTranscribeOutput(response.data);
    } else if (jobStatus === 'FAILED') {
      throw new Error('Transcription failed');
    }
  }
  
  return transcript;
}

/**
 * Parse AWS Transcribe output to standard format
 */
function parseTranscribeOutput(data) {
  const items = data.results.items;
  
  return items.map(item => ({
    word: item.alternatives[0].content,
    start_time: parseFloat(item.start_time || 0),
    end_time: parseFloat(item.end_time || 0),
    confidence: item.alternatives[0].confidence
  }));
}

/**
 * Speaker diarization (who spoke when)
 */
async function performDiarization(audioPath, transcript) {
  // AWS Transcribe already provides speaker labels
  // Just need to group by speaker
  
  const segments = [];
  let currentSpeaker = null;
  let currentSegment = null;
  
  for (const word of transcript) {
    if (word.speaker !== currentSpeaker) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      
      currentSpeaker = word.speaker;
      currentSegment = {
        speaker: currentSpeaker,
        start_time: word.start_time,
        end_time: word.end_time,
        words: [word.word]
      };
    } else {
      currentSegment.end_time = word.end_time;
      currentSegment.words.push(word.word);
    }
  }
  
  if (currentSegment) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * Detect audio events (laughter, applause, music, silence)
 */
async function detectAudioEvents(audioPath) {
  // Simplified version - in production use ML model
  // For now, detect silence using FFmpeg
  
  const silences = await detectSilence(audioPath);
  
  return {
    silences,
    laughter: [], // TODO: ML model
    music: [],    // TODO: ML model
    applause: []  // TODO: ML model
  };
}

/**
 * Detect silence periods
 */
async function detectSilence(audioPath) {
  return new Promise((resolve, reject) => {
    const silences = [];
    
    ffmpeg(audioPath)
      .audioFilters('silencedetect=n=-30dB:d=0.5')
      .format('null')
      .on('stderr', (line) => {
        // Parse silence detection output
        const startMatch = line.match(/silence_start: ([\d.]+)/);
        const endMatch = line.match(/silence_end: ([\d.]+)/);
        
        if (startMatch) {
          silences.push({ start: parseFloat(startMatch[1]) });
        }
        if (endMatch && silences.length > 0) {
          silences[silences.length - 1].end = parseFloat(endMatch[1]);
        }
      })
      .on('end', () => resolve(silences))
      .on('error', reject)
      .output('-')
      .run();
  });
}

/**
 * Track faces in video (character presence)
 */
async function trackFaces(videoPath) {
  // Simplified - in production use OpenCV/face_recognition
  // For MVP, use scene detection as proxy
  
  return [
    {
      person_id: 'person_1',
      start_time: 0,
      end_time: 60,
      confidence: 0.95,
      bounding_boxes: [] // [{ time, x, y, width, height }]
    }
  ];
}

/**
 * Active speaker detection (link voice to visible person)
 */
async function detectActiveSpeaker(speakerSegments, characterPresence) {
  // Match speaker segments with visible persons
  const timeline = [];
  
  for (const segment of speakerSegments) {
    // Find which character is visible during this speech
    const visiblePerson = characterPresence.find(person =>
      segment.start_time >= person.start_time &&
      segment.end_time <= person.end_time
    );
    
    timeline.push({
      speaker: segment.speaker,
      character: visiblePerson?.person_id || 'off_camera',
      start_time: segment.start_time,
      end_time: segment.end_time,
      text: segment.words.join(' ')
    });
  }
  
  return timeline;
}

/**
 * Detect scene boundaries (cuts, camera changes)
 */
async function detectSceneBoundaries(videoPath) {
  // Use FFmpeg scene detection
  return new Promise((resolve, reject) => {
    const scenes = [];
    
    ffmpeg(videoPath)
      .videoFilters('select=\'gt(scene,0.3)\'')
      .format('null')
      .on('stderr', (line) => {
        const match = line.match(/pts_time:([\d.]+)/);
        if (match) {
          scenes.push({ time: parseFloat(match[1]), type: 'cut' });
        }
      })
      .on('end', () => resolve(scenes))
      .on('error', reject)
      .output('-')
      .run();
  });
}

/**
 * Find natural cut points (breaths, pauses)
 */
async function findNaturalCuts(transcript, audioEvents) {
  const cuts = [];
  
  // Cuts at silence periods
  for (const silence of audioEvents.silences || []) {
    if (silence.end - silence.start > 0.5) { // At least 0.5s silence
      cuts.push({
        time: silence.start,
        type: 'silence',
        confidence: 0.9
      });
    }
  }
  
  // Cuts at sentence boundaries
  let currentTime = 0;
  let sentenceBuffer = [];
  
  for (const word of transcript) {
    sentenceBuffer.push(word.word);
    currentTime = word.end_time;
    
    // Check for sentence ending punctuation
    if (['.', '!', '?'].includes(word.word)) {
      cuts.push({
        time: currentTime,
        type: 'sentence_end',
        confidence: 0.7
      });
      sentenceBuffer = [];
    }
  }
  
  return cuts;
}

/**
 * Find B-roll opportunities (moments for overlays)
 */
async function findBRollOpportunities(transcript, activeSpeakerTimeline) {
  const opportunities = [];
  
  for (const segment of activeSpeakerTimeline) {
    // If speaker is off-camera, good time for B-roll
    if (segment.character === 'off_camera') {
      opportunities.push({
        start_time: segment.start_time,
        end_time: segment.end_time,
        reason: 'speaker_off_camera',
        suggested_content: 'reaction_shot'
      });
    }
    
    // Look for descriptive language (visual cues)
    const text = segment.text.toLowerCase();
    if (text.includes('look at') || text.includes('check this out')) {
      opportunities.push({
        start_time: segment.start_time,
        end_time: segment.end_time,
        reason: 'visual_cue',
        suggested_content: 'product_closeup'
      });
    }
  }
  
  return opportunities;
}

/**
 * Get video duration
 */
async function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(Math.round(metadata.format.duration));
    });
  });
}

/**
 * Save edit map to database (via API)
 */
async function saveEditMap(editMapId, data) {
  await axios.put(`${process.env.API_URL}/api/v1/edit-maps/${editMapId}`, {
    ...data,
    processing_status: 'completed',
    processing_completed_at: new Date().toISOString()
  });
}

/**
 * Update edit map status
 */
async function updateEditMapStatus(editMapId, status, errorMessage = null) {
  await axios.patch(`${process.env.API_URL}/api/v1/edit-maps/${editMapId}`, {
    processing_status: status,
    error_message: errorMessage,
    ...(status === 'processing' && { processing_started_at: new Date().toISOString() }),
    ...(status === 'completed' && { processing_completed_at: new Date().toISOString() })
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

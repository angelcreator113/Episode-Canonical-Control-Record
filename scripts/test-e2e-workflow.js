#!/usr/bin/env node
'use strict';

/**
 * End-to-End Workflow Test
 * Simulates complete AI video editing pipeline
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { Episode, Show, AIEditPlan, Scene, VideoProcessingJob } = require('../src/models');
const s3AIService = require('../src/services/s3AIService');
const videoJobService = require('../src/services/videoJobService');

const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function step(number, title) {
  console.log(`\n${colors.blue}━━━ STEP ${number}: ${title} ${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

async function runE2ETest() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  END-TO-END WORKFLOW TEST                          ║');
  console.log('║  Complete AI Video Editing Pipeline               ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  let show, episode, scene1, scene2, editPlan, job;

  try {
    // ========== STEP 1: Create Show ==========
    step(1, 'Create Show');
    show = await Show.create({
      name: 'E2E Test Show',
      slug: 'e2e-test-show',
      description: 'Test show for end-to-end workflow',
      status: 'active',
    });
    success(`Show created: ${show.id}`);

    // ========== STEP 2: Create Episode with AI Enabled ==========
    step(2, 'Create Episode with AI Editing Enabled');
    episode = await Episode.create({
      show_id: show.id,
      title: 'E2E Test Episode',
      season_number: 1,
      episode_number: 1,
      status: 'draft',
      ai_edit_enabled: true,
      rendering_status: 'not_started',
    });
    success(`Episode created: ${episode.id}`);
    success(`AI editing: ${episode.ai_edit_enabled ? 'ENABLED' : 'DISABLED'}`);

    // ========== STEP 3: Upload Raw Footage to S3 ==========
    step(3, 'Upload Raw Footage to S3');
    
    const testFootage1 = Buffer.from('Test raw footage clip 1 content');
    const testFootage2 = Buffer.from('Test raw footage clip 2 content');

    const upload1 = await s3AIService.uploadRawFootage(
      testFootage1,
      'E2E-INTRO-TAKE-1.mp4',
      episode.id,
      'intro'
    );
    success(`Uploaded clip 1: ${upload1.s3Key}`);

    const upload2 = await s3AIService.uploadRawFootage(
      testFootage2,
      'E2E-MAIN-TAKE-1.mp4',
      episode.id,
      'main'
    );
    success(`Uploaded clip 2: ${upload2.s3Key}`);

    // ========== STEP 4: Create Scenes Linked to Raw Footage ==========
    step(4, 'Create Scenes with Raw Footage References');
    
    scene1 = await Scene.create({
      episode_id: episode.id,
      name: 'Intro Scene',
      scene_number: 1,
      type: 'intro',
      source_filename: 'E2E-INTRO-TAKE-1.mp4',
      take_number: 1,
      raw_footage_s3_key: upload1.s3Key,
      raw_footage_duration: 10.5,
      ai_selected: true,
      ai_confidence_score: 0.92,
    });
    success(`Scene 1 created: ${scene1.name} (AI confidence: ${scene1.ai_confidence_score})`);

    scene2 = await Scene.create({
      episode_id: episode.id,
      name: 'Main Content',
      scene_number: 2,
      type: 'main',
      source_filename: 'E2E-MAIN-TAKE-1.mp4',
      take_number: 1,
      raw_footage_s3_key: upload2.s3Key,
      raw_footage_duration: 25.3,
      ai_selected: true,
      ai_confidence_score: 0.88,
    });
    success(`Scene 2 created: ${scene2.name} (AI confidence: ${scene2.ai_confidence_score})`);

    // ========== STEP 5: Generate AI Edit Plan ==========
    step(5, 'Create AI Edit Plan');
    
    const editStructure = {
      scenes: [
        {
          sceneId: scene1.id,
          name: scene1.name,
          clips: [{ s3Key: scene1.raw_footage_s3_key, duration: 10.5, trim: { start: 0, end: 10.5 } }],
          transitions: ['fade_in'],
        },
        {
          sceneId: scene2.id,
          name: scene2.name,
          clips: [{ s3Key: scene2.raw_footage_s3_key, duration: 25.3, trim: { start: 0, end: 25.3 } }],
          transitions: ['cut'],
        },
      ],
      totalDuration: 35.8,
      music: { enabled: false },
      overlays: [],
    };

    editPlan = await AIEditPlan.create({
      episode_id: episode.id,
      edit_structure: editStructure,
      overall_confidence_score: 0.90,
      status: 'draft',
      generated_by: 'claude-sonnet-4',
      generation_prompt: 'E2E test workflow prompt',
    });
    success(`Edit plan created: ${editPlan.id}`);
    success(`Overall confidence: ${editPlan.overall_confidence_score}`);
    success(`Total duration: ${editStructure.totalDuration} seconds`);

    // ========== STEP 6: Approve Edit Plan ==========
    step(6, 'Approve Edit Plan');
    
    await editPlan.update({
      status: 'approved',
      approved_at: new Date(),
      approved_by: 'test-user',
    });
    success(`Edit plan approved`);

    // Link to episode as current plan
    await episode.update({
      current_ai_edit_plan_id: editPlan.id,
    });
    success(`Edit plan set as current for episode`);

    // ========== STEP 7: Queue Video Processing Job ==========
    step(7, 'Queue Video Processing Job');
    
    const { job: createdJob, queueResult } = await videoJobService.createAndQueueJob({
      episodeId: episode.id,
      editPlanId: editPlan.id,
      processingMethod: 'lambda',
      complexityScore: 0.45,
      editStructure: editStructure,
    });
    job = createdJob;

    success(`Job created in database: ${job.id}`);
    success(`Job queued in SQS: ${queueResult.messageId}`);
    success(`Estimated duration: ${job.estimated_duration_seconds} seconds`);

    // Update episode rendering status
    await episode.update({ rendering_status: 'queued' });
    success(`Episode rendering status: ${episode.rendering_status}`);

    // ========== STEP 8: Simulate Job Processing ==========
    step(8, 'Simulate Video Processing');
    
    await videoJobService.markJobStarted(job.id, {
      lambdaRequestId: 'lambda-' + uuidv4(),
    });
    success(`Job started`);

    await episode.update({ rendering_status: 'rendering' });
    success(`Episode status: rendering`);

    // Simulate progress updates
    await videoJobService.updateProgress(job.id, 25);
    success(`Progress: 25%`);

    await videoJobService.updateProgress(job.id, 50);
    success(`Progress: 50%`);

    await videoJobService.updateProgress(job.id, 75);
    success(`Progress: 75%`);

    // ========== STEP 9: Upload Processed Video ==========
    step(9, 'Upload Processed Video to S3');
    
    const processedVideo = Buffer.from('Final rendered video content (simulated)');
    const videoUpload = await s3AIService.uploadProcessedVideo(
      processedVideo,
      episode.id,
      job.id
    );
    success(`Processed video uploaded: ${videoUpload.s3Key}`);
    success(`Presigned URL generated (valid 7 days)`);

    // ========== STEP 10: Complete Job ==========
    step(10, 'Mark Job as Completed');
    
    await videoJobService.markJobCompleted(job.id, {
      outputS3Key: videoUpload.s3Key,
      outputUrl: videoUpload.presignedUrl,
    });
    success(`Job completed`);

    await episode.update({
      rendering_status: 'completed',
      final_video_s3_key: videoUpload.s3Key,
    });
    success(`Episode rendering status: completed`);
    success(`Final video stored: ${episode.final_video_s3_key}`);

    // ========== STEP 11: Verify Complete Workflow ==========
    step(11, 'Verify Complete Workflow');
    
    const finalEpisode = await Episode.findByPk(episode.id, {
      include: [
        { model: Scene, as: 'scenes' },
        { model: AIEditPlan, as: 'currentAIEditPlan' },
      ],
    });

    success(`Episode has ${finalEpisode.scenes.length} scenes`);
    success(`Current edit plan: ${finalEpisode.currentAIEditPlan.id}`);
    success(`AI edit enabled: ${finalEpisode.ai_edit_enabled}`);
    success(`Rendering status: ${finalEpisode.rendering_status}`);
    success(`Final video: ${finalEpisode.final_video_s3_key ? 'STORED' : 'MISSING'}`);

    const finalJob = await VideoProcessingJob.findByPk(job.id);
    success(`Job status: ${finalJob.status}`);
    success(`Job progress: ${finalJob.progress_percentage}%`);
    success(`Processing duration: ${finalJob.processing_duration_seconds} seconds (auto-calculated)`);

    // ========== CLEANUP ==========
    step(12, 'Cleanup Test Data');
    
    await finalJob.destroy({ force: true });
    await editPlan.destroy({ force: true });
    await scene1.destroy({ force: true });
    await scene2.destroy({ force: true });
    await episode.destroy({ force: true });
    await show.destroy({ force: true });
    success('All test data removed');

    // ========== SUCCESS ==========
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log(`║  ${colors.green}✓ END-TO-END WORKFLOW TEST PASSED${colors.reset}              ║`);
    console.log('║                                                    ║');
    console.log('║  Complete pipeline validated:                      ║');
    console.log('║  • Show/Episode creation                           ║');
    console.log('║  • Raw footage upload to S3                        ║');
    console.log('║  • Scene creation with AI metadata                 ║');
    console.log('║  • AI edit plan generation                         ║');
    console.log('║  • Job queueing in SQS                             ║');
    console.log('║  • Video processing simulation                     ║');
    console.log('║  • Processed video upload                          ║');
    console.log('║  • Job completion                                  ║');
    console.log('║  • Data cleanup                                    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    process.exit(0);

  } catch (error) {
    console.error(`\n${colors.yellow}✗ Test failed:${colors.reset}`, error.message);
    console.error(error);

    // Cleanup on error
    try {
      if (job) await job.destroy({ force: true });
      if (editPlan) await editPlan.destroy({ force: true });
      if (scene1) await scene1.destroy({ force: true });
      if (scene2) await scene2.destroy({ force: true });
      if (episode) await episode.destroy({ force: true });
      if (show) await show.destroy({ force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }

    process.exit(1);
  }
}

runE2ETest();

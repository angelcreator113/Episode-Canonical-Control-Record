#!/usr/bin/env node
'use strict';

/**
 * Week 1 Infrastructure Validation Script
 * Validates all database, S3, and SQS infrastructure
 */

require('dotenv').config();
const { S3Client, HeadBucketCommand, GetBucketVersioningCommand } = require('@aws-sdk/client-s3');
const { SQSClient, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
const { sequelize } = require('../src/models');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

let passedTests = 0;
let failedTests = 0;

function pass(message) {
  console.log(`  ${colors.green}✓${colors.reset} ${message}`);
  passedTests++;
}

function fail(message, error) {
  console.log(`  ${colors.red}✗${colors.reset} ${message}`);
  if (error) console.log(`    ${colors.red}Error: ${error.message}${colors.reset}`);
  failedTests++;
}

function section(title) {
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
}

async function validateDatabase() {
  section('DATABASE VALIDATION');

  try {
    // Test connection
    await sequelize.authenticate();
    pass('Database connection successful');

    // Check AI editing tables exist
    const tables = [
      'ai_edit_plans',
      'editing_decisions',
      'ai_revisions',
      'video_processing_jobs',
      'ai_training_data',
      'script_metadata',
      'scene_layer_configuration',
      'layer_presets',
    ];

    for (const table of tables) {
      try {
        const [results] = await sequelize.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
        );
        if (results[0].exists) {
          pass(`Table exists: ${table}`);
        } else {
          fail(`Table missing: ${table}`);
        }
      } catch (error) {
        fail(`Error checking table ${table}`, error);
      }
    }

    // Check modified columns exist
    const columnChecks = [
      { table: 'episodes', column: 'ai_edit_enabled' },
      { table: 'episodes', column: 'current_ai_edit_plan_id' },
      { table: 'episodes', column: 'final_video_s3_key' },
      { table: 'episodes', column: 'rendering_status' },
      { table: 'scenes', column: 'source_filename' },
      { table: 'scenes', column: 'raw_footage_s3_key' },
      { table: 'scenes', column: 'ai_selected' },
      { table: 'episode_scripts', column: 'ai_analysis_enabled' },
    ];

    for (const check of columnChecks) {
      try {
        const [results] = await sequelize.query(
          `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${check.table}' AND column_name = '${check.column}')`
        );
        if (results[0].exists) {
          pass(`Column exists: ${check.table}.${check.column}`);
        } else {
          fail(`Column missing: ${check.table}.${check.column}`);
        }
      } catch (error) {
        fail(`Error checking column ${check.table}.${check.column}`, error);
      }
    }

    // Check trigger exists
    try {
      const [results] = await sequelize.query(
        `SELECT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'update_processing_duration')`
      );
      if (results[0].exists) {
        pass('Trigger exists: update_processing_duration');
      } else {
        fail('Trigger missing: update_processing_duration');
      }
    } catch (error) {
      fail('Error checking trigger', error);
    }

  } catch (error) {
    fail('Database connection failed', error);
  }
}

async function validateSequelizeModels() {
  section('SEQUELIZE MODELS VALIDATION');

  const models = [
    'AIEditPlan',
    'EditingDecision',
    'AIRevision',
    'VideoProcessingJob',
    'AITrainingData',
    'ScriptMetadata',
    'SceneLayerConfiguration',
    'LayerPreset',
  ];

  const { models: loadedModels } = require('../src/models');

  for (const modelName of models) {
    if (loadedModels[modelName]) {
      pass(`Model loaded: ${modelName}`);
    } else {
      fail(`Model missing: ${modelName}`);
    }
  }

  // Check associations
  const associations = [
    { model: 'Episode', association: 'aiEditPlans' },
    { model: 'Episode', association: 'currentAIEditPlan' },
    { model: 'AIEditPlan', association: 'revisions' },
    { model: 'Scene', association: 'layerConfiguration' },
    { model: 'VideoProcessingJob', association: 'episode' },
    { model: 'VideoProcessingJob', association: 'editPlan' },
  ];

  for (const assoc of associations) {
    if (loadedModels[assoc.model]?.associations[assoc.association]) {
      pass(`Association exists: ${assoc.model}.${assoc.association}`);
    } else {
      fail(`Association missing: ${assoc.model}.${assoc.association}`);
    }
  }
}

async function validateS3Buckets() {
  section('S3 BUCKETS VALIDATION');

  const buckets = [
    { name: process.env.S3_RAW_FOOTAGE_BUCKET, purpose: 'Raw Footage' },
    { name: process.env.S3_PROCESSED_VIDEOS_BUCKET, purpose: 'Processed Videos' },
    { name: process.env.S3_TRAINING_DATA_BUCKET, purpose: 'Training Data' },
  ];

  for (const bucket of buckets) {
    if (!bucket.name) {
      fail(`Environment variable missing for ${bucket.purpose}`);
      continue;
    }

    try {
      // Check bucket exists
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket.name }));
      pass(`Bucket exists: ${bucket.name}`);

      // Check versioning
      const versioning = await s3Client.send(
        new GetBucketVersioningCommand({ Bucket: bucket.name })
      );
      if (versioning.Status === 'Enabled') {
        pass(`Versioning enabled: ${bucket.name}`);
      } else {
        fail(`Versioning not enabled: ${bucket.name}`);
      }
    } catch (error) {
      fail(`Bucket error: ${bucket.name}`, error);
    }
  }
}

async function validateSQSQueues() {
  section('SQS QUEUES VALIDATION');

  const queues = [
    { url: process.env.SQS_VIDEO_PROCESSING_QUEUE_URL, name: 'Main Processing Queue' },
    { url: process.env.SQS_VIDEO_PROCESSING_DLQ_URL, name: 'Dead Letter Queue' },
  ];

  for (const queue of queues) {
    if (!queue.url) {
      fail(`Environment variable missing for ${queue.name}`);
      continue;
    }

    try {
      const response = await sqsClient.send(
        new GetQueueAttributesCommand({
          QueueUrl: queue.url,
          AttributeNames: ['QueueArn', 'FifoQueue', 'ApproximateNumberOfMessages'],
        })
      );

      pass(`Queue exists: ${queue.name}`);

      if (response.Attributes.FifoQueue === 'true') {
        pass(`FIFO enabled: ${queue.name}`);
      } else {
        fail(`FIFO not enabled: ${queue.name}`);
      }

      const msgCount = parseInt(response.Attributes.ApproximateNumberOfMessages || '0');
      console.log(`    Messages in queue: ${msgCount}`);

    } catch (error) {
      fail(`Queue error: ${queue.name}`, error);
    }
  }
}

async function validateServices() {
  section('SERVICE LAYER VALIDATION');

  try {
    const s3AIService = require('../src/services/s3AIService');
    if (s3AIService && typeof s3AIService.uploadRawFootage === 'function') {
      pass('s3AIService loaded and has uploadRawFootage method');
    } else {
      fail('s3AIService not properly configured');
    }
  } catch (error) {
    fail('s3AIService failed to load', error);
  }

  try {
    const sqsService = require('../src/services/sqsService');
    if (sqsService && typeof sqsService.sendProcessingJob === 'function') {
      pass('sqsService loaded and has sendProcessingJob method');
    } else {
      fail('sqsService not properly configured');
    }
  } catch (error) {
    fail('sqsService failed to load', error);
  }

  try {
    const videoJobService = require('../src/services/videoJobService');
    if (videoJobService && typeof videoJobService.createAndQueueJob === 'function') {
      pass('videoJobService loaded and has createAndQueueJob method');
    } else {
      fail('videoJobService not properly configured');
    }
  } catch (error) {
    fail('videoJobService failed to load', error);
  }
}

async function validateEnvironmentVariables() {
  section('ENVIRONMENT VARIABLES VALIDATION');

  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'AWS_REGION',
    'S3_RAW_FOOTAGE_BUCKET',
    'S3_PROCESSED_VIDEOS_BUCKET',
    'S3_TRAINING_DATA_BUCKET',
    'SQS_VIDEO_PROCESSING_QUEUE_URL',
    'SQS_VIDEO_PROCESSING_DLQ_URL',
  ];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      pass(`Environment variable set: ${varName}`);
    } else {
      fail(`Environment variable missing: ${varName}`);
    }
  }
}

async function runValidation() {
  console.log('\n');
  console.log(`${colors.blue}╔════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  WEEK 1 INFRASTRUCTURE VALIDATION SCRIPT          ║${colors.reset}`);
  console.log(`${colors.blue}║  AI Video Editing System                           ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════╝${colors.reset}`);

  await validateEnvironmentVariables();
  await validateDatabase();
  await validateSequelizeModels();
  await validateS3Buckets();
  await validateSQSQueues();
  await validateServices();

  // Summary
  section('VALIDATION SUMMARY');
  console.log('');
  console.log(`  Total Tests: ${passedTests + failedTests}`);
  console.log(`  ${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`  ${failedTests > 0 ? colors.red : colors.green}Failed: ${failedTests}${colors.reset}`);
  console.log('');

  if (failedTests === 0) {
    console.log(`${colors.green}╔════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║  ✓ ALL VALIDATIONS PASSED!                        ║${colors.reset}`);
    console.log(`${colors.green}║  Week 1 infrastructure is production-ready.        ║${colors.reset}`);
    console.log(`${colors.green}╚════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    process.exit(0);
  } else {
    console.log(`${colors.red}╔════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.red}║  ✗ VALIDATION FAILURES DETECTED                    ║${colors.reset}`);
    console.log(`${colors.red}║  Please fix the issues above before proceeding.    ║${colors.reset}`);
    console.log(`${colors.red}╚════════════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    process.exit(1);
  }
}

runValidation().catch(error => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

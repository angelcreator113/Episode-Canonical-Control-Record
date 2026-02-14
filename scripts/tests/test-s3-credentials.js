#!/usr/bin/env node

/**
 * Test AWS SDK v3 credentials and S3 access
 * Tests credential loading and S3 operations
 */

const { S3Client, ListBucketsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');
const path = require('path');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_PROFILE = process.env.AWS_PROFILE;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'episode-metadata-storage-dev';

console.log('\n🔍 AWS SDK v3 Credential Test');
console.log('===============================================');
console.log('Environment Variables:');
console.log(`  AWS_REGION: ${AWS_REGION}`);
console.log(`  AWS_PROFILE: ${AWS_PROFILE || '(not set)'}`);
console.log(`  AWS_S3_BUCKET: ${AWS_S3_BUCKET}`);

// Test credential loading
(async () => {
  try {
    console.log('\n📋 Loading Credentials...');
    
    let credentials;
    if (AWS_PROFILE) {
      console.log(`  Trying fromIni with profile: ${AWS_PROFILE}`);
      credentials = await fromIni({ profile: AWS_PROFILE })();
    } else {
      console.log('  Trying fromEnv from environment variables');
      credentials = await fromEnv()();
    }
    
    console.log('  ✅ Credentials loaded successfully');
    console.log(`  Access Key ID: ${credentials.accessKeyId.substring(0, 8)}...`);
    console.log(`  Secret Key: ${credentials.secretAccessKey.substring(0, 8)}...`);

    // Create S3 client with loaded credentials
    const s3Client = new S3Client({
      region: AWS_REGION,
      credentials,
    });

    console.log('\n🪣 Testing S3 Access...');
    
    // Test 1: List buckets
    console.log('  1️⃣ Listing all buckets...');
    const listBucketsCommand = new ListBucketsCommand({});
    const buckets = await s3Client.send(listBucketsCommand);
    
    const bucketNames = buckets.Buckets.map(b => b.Name);
    console.log(`  ✅ Found ${bucketNames.length} bucket(s):`);
    bucketNames.forEach(name => console.log(`     - ${name}`));
    
    // Test 2: Check if configured bucket exists
    console.log(`\n  2️⃣ Checking if ${AWS_S3_BUCKET} exists...`);
    const bucketExists = bucketNames.includes(AWS_S3_BUCKET);
    
    if (bucketExists) {
      console.log(`  ✅ Bucket exists: ${AWS_S3_BUCKET}`);
      
      // Test HeadBucket to verify access
      try {
        const headBucketCommand = new HeadBucketCommand({ Bucket: AWS_S3_BUCKET });
        await s3Client.send(headBucketCommand);
        console.log(`  ✅ Have access to bucket: ${AWS_S3_BUCKET}`);
      } catch (error) {
        console.log(`  ❌ Cannot access bucket: ${error.message}`);
      }
    } else {
      console.log(`  ❌ Bucket not found: ${AWS_S3_BUCKET}`);
      console.log('  Available buckets:', bucketNames.join(', '));
    }

    console.log('\n✨ Credential test complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Credential test failed:');
    console.error(`  Error: ${error.message}`);
    
    if (error.code === 'NoCredentialProvider') {
      console.error('\n  This error means no credentials were found.');
      console.error('  Check:');
      console.error('    1. AWS_PROFILE is set to a valid profile name');
      console.error('    2. ~/.aws/credentials file exists and contains the profile');
      console.error('    3. OR AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set');
    }
    
    console.error('\n');
    process.exit(1);
  }
})();

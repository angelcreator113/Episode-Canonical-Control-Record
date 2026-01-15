#!/usr/bin/env node

/**
 * List files in S3 bucket
 * Shows what files actually exist in S3
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');

(async () => {
  try {
    const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
    const AWS_PROFILE = process.env.AWS_PROFILE || 'default';
    const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'episode-metadata-storage-dev';

    console.log('\n📦 Listing S3 Bucket Contents\n');
    console.log(`Bucket: ${AWS_S3_BUCKET}`);
    console.log(`Region: ${AWS_REGION}`);
    console.log(`Profile: ${AWS_PROFILE}\n`);

    // Load credentials
    const credentials = AWS_PROFILE 
      ? await fromIni({ profile: AWS_PROFILE })()
      : await fromEnv()();
    
    const s3Client = new S3Client({
      region: AWS_REGION,
      credentials,
    });

    // List objects
    const command = new ListObjectsV2Command({
      Bucket: AWS_S3_BUCKET,
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      console.log('❌ No objects found in bucket\n');
      process.exit(0);
    }

    console.log(`Found ${response.Contents.length} objects:\n`);

    // Display all objects
    response.Contents.forEach((obj, idx) => {
      console.log(`${idx + 1}. ${obj.Key} (${obj.Size} bytes, modified: ${obj.LastModified})`);
    });

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();

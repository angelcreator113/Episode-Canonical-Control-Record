#!/bin/bash
cd /home/ubuntu/episode-metadata
node -e "
require('dotenv').config({path:'.env'});
const { S3Client, HeadBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function check() {
  const bucket = process.env.S3_PRIMARY_BUCKET;
  console.log('Checking bucket:', bucket);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log('BUCKET EXISTS ✓');
  } catch (err) {
    console.log('BUCKET ERROR:', err.name, err.message);
  }
  
  try {
    const resp = await s3.send(new ListBucketsCommand({}));
    console.log('Available buckets:', resp.Buckets.map(b => b.Name));
  } catch (err) {
    console.log('ListBuckets error:', err.message);
  }
}
check();
"

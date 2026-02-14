const { S3Client, HeadBucketCommand, ListBucketsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function checkBucket() {
  console.log('🔍 Checking S3 Configuration...\n');
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  console.log('Access Key:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set');
  console.log('Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set');
  
  const bucketName = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || 'episode-metadata-storage-dev';
  console.log('\nTarget Bucket:', bucketName);
  
  try {
    console.log('\n📋 Listing all accessible buckets...');
    const listCommand = new ListBucketsCommand({});
    const listResult = await s3Client.send(listCommand);
    
    console.log('\n✅ Found', listResult.Buckets.length, 'buckets:');
    listResult.Buckets.forEach(bucket => {
      const match = bucket.Name === bucketName ? '👉' : '  ';
      console.log(`${match} ${bucket.Name}`);
    });
    
    if (!listResult.Buckets.find(b => b.Name === bucketName)) {
      console.log('\n❌ Target bucket NOT found in your account!');
      console.log('\n💡 Solutions:');
      console.log('   1. Create the bucket:', bucketName);
      console.log('   2. Or update .env to use an existing bucket name');
    } else {
      console.log('\n✅ Target bucket exists!');
      
      // Try to check bucket access
      console.log('\n🔐 Checking bucket access...');
      const headCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(headCommand);
      console.log('✅ Bucket is accessible!');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.name === 'NoSuchBucket') {
      console.log('\n💡 The bucket does not exist. You need to create it.');
    } else if (error.name === 'AccessDenied') {
      console.log('\n💡 Access denied. Check your AWS credentials and permissions.');
    }
  }
}

checkBucket();

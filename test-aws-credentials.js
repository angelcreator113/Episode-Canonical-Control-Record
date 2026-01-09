/**
 * Test AWS credentials loading
 */

require('dotenv').config();
const aws = require('aws-sdk');

console.log('Testing AWS Credentials Loading...\n');

console.log('Environment variables:');
console.log('  AWS_PROFILE:', process.env.AWS_PROFILE);
console.log('  AWS_REGION:', process.env.AWS_REGION);
console.log('  AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '(set)' : '(not set)');
console.log('  AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '(set)' : '(not set)');
console.log('  AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET);
console.log('  S3_THUMBNAIL_BUCKET:', process.env.S3_THUMBNAIL_BUCKET);

console.log('\nConfiguring AWS...');

// Configure AWS
if (process.env.AWS_PROFILE) {
  const credentials = new aws.SharedIniFileCredentials({ profile: process.env.AWS_PROFILE });
  aws.config.credentials = credentials;
  console.log('✅ Using AWS profile:', process.env.AWS_PROFILE);
}

aws.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

console.log('\nAWS Configuration:');
console.log('  Region:', aws.config.region);
console.log('  Credentials loaded:', !!aws.config.credentials);

if (aws.config.credentials) {
  console.log('\nAttempting to fetch credentials...');
  aws.config.credentials.get((err) => {
    if (err) {
      console.error('❌ Error loading credentials:', err.message);
      process.exit(1);
    } else {
      const creds = aws.config.credentials;
      console.log('✅ Credentials loaded successfully');
      console.log('  Access Key ID:', creds.accessKeyId ? creds.accessKeyId.substring(0, 10) + '...' : 'undefined');
      console.log('  Secret Key:', creds.secretAccessKey ? '(set)' : '(not set)');
      console.log('  Session Token:', creds.sessionToken ? '(set)' : '(not set)');

      console.log('\nTesting S3 access...');
      const s3 = new aws.S3();
      
      s3.listBuckets((err, data) => {
        if (err) {
          console.error('❌ S3 test failed:', err.message);
          process.exit(1);
        } else {
          console.log('✅ S3 access successful');
          console.log('  Available buckets:', data.Buckets.length);
          const ourBucket = data.Buckets.find(b => b.Name === process.env.AWS_S3_BUCKET);
          if (ourBucket) {
            console.log('  ✅ Found configured bucket:', process.env.AWS_S3_BUCKET);
          } else {
            console.log('  ⚠️ Configured bucket not found:', process.env.AWS_S3_BUCKET);
          }
          process.exit(0);
        }
      });
    }
  });
} else {
  console.error('❌ AWS credentials not configured');
  process.exit(1);
}

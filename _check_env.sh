#!/bin/bash
cd /home/ubuntu/episode-metadata
node -e "
require('dotenv').config({path:'.env'});
console.log('S3_PRIMARY_BUCKET:', process.env.S3_PRIMARY_BUCKET);
console.log('AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET);
console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
"

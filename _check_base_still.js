require('dotenv').config();
const { Sequelize } = require('sequelize');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const env = process.env.NODE_ENV || 'production';
const config = require('./src/config/sequelize')[env];
const s = new Sequelize(config.database, config.username, config.password, config);
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_PRIMARY_BUCKET || 'episode-metadata-storage-dev';
const SET_ID = '1fda0e44-9620-4674-8d49-62de53e3d5e7';

async function main() {
  try {
    // List S3 objects for this set
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: `scene-sets/${SET_ID}/`,
    }));
    
    const keys = (result.Contents || []).map(o => o.Key);
    console.log('S3 objects:', JSON.stringify(keys, null, 2));
    
    // Find the base still
    const baseStill = keys.find(k => k.includes('/base/') && k.includes('still'));
    if (baseStill) {
      const url = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${baseStill}`;
      console.log('Base still URL:', url);
      
      // Update the set
      await s.query(
        `UPDATE scene_sets SET base_still_url = :url WHERE id = :id`,
        { replacements: { url, id: SET_ID } }
      );
      console.log('Backfill complete!');
    } else {
      console.log('No base still found in S3. Base scene needs to be generated first.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await s.close();
  }
}
main();

/**
 * Diagnose Corrupted Assets
 * 
 * This script identifies and reports:
 * - Assets with missing or invalid S3 URLs
 * - Assets with NULL critical fields
 * - Orphaned database records
 * - Invalid file references
 * - Broken asset relationships
 */

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function diagnoseCorruptedAssets() {
  try {
    console.log('🔍 DIAGNOSING ASSET DATABASE FOR CORRUPTION\n');
    console.log('=' .repeat(70));
    
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // ═══════════════════════════════════════════════════════════
    // 1. CHECK FOR NULL OR INVALID S3 URLs
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 1. CHECKING FOR NULL OR INVALID S3 URLs');
    console.log('-'.repeat(70));
    
    const [nullUrls] = await sequelize.query(`
      SELECT 
        id, 
        name, 
        asset_type, 
        asset_role,
        s3_url_raw,
        s3_url_processed,
        created_at
      FROM assets 
      WHERE deleted_at IS NULL
        AND (
          s3_url_raw IS NULL 
          OR s3_url_processed IS NULL
          OR s3_url_raw = ''
          OR s3_url_processed = ''
          OR s3_url_raw NOT LIKE '%amazonaws.com%'
          OR s3_url_processed NOT LIKE '%amazonaws.com%'
        )
      ORDER BY created_at DESC;
    `);

    if (nullUrls.length > 0) {
      console.log(`❌ FOUND ${nullUrls.length} ASSETS WITH INVALID URLs:\n`);
      nullUrls.forEach((asset, idx) => {
        console.log(`${idx + 1}. ${asset.name} [${asset.asset_type}]`);
        console.log(`   ID: ${asset.id}`);
        console.log(`   Role: ${asset.asset_role || 'NULL'}`);
        console.log(`   Raw URL: ${asset.s3_url_raw || '❌ NULL'}`);
        console.log(`   Processed URL: ${asset.s3_url_processed || '❌ NULL'}`);
        console.log(`   Created: ${asset.created_at}`);
        console.log('');
      });
    } else {
      console.log('✅ All assets have valid S3 URLs');
    }

    // ═══════════════════════════════════════════════════════════
    // 2. CHECK FOR NULL CRITICAL FIELDS
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 2. CHECKING FOR NULL CRITICAL FIELDS');
    console.log('-'.repeat(70));
    
    const [nullFields] = await sequelize.query(`
      SELECT 
        id, 
        name,
        asset_type,
        asset_role,
        s3_key_raw,
        file_name,
        content_type,
        file_size_bytes,
        approval_status
      FROM assets 
      WHERE deleted_at IS NULL
        AND (
          name IS NULL
          OR asset_type IS NULL
          OR s3_key_raw IS NULL
          OR file_name IS NULL
          OR content_type IS NULL
        )
      ORDER BY created_at DESC;
    `);

    if (nullFields.length > 0) {
      console.log(`❌ FOUND ${nullFields.length} ASSETS WITH NULL CRITICAL FIELDS:\n`);
      nullFields.forEach((asset, idx) => {
        console.log(`${idx + 1}. ${asset.name || '❌ NULL NAME'}`);
        console.log(`   ID: ${asset.id}`);
        console.log(`   Type: ${asset.asset_type || '❌ NULL'}`);
        console.log(`   Role: ${asset.asset_role || '⚠️  NULL'}`);
        console.log(`   S3 Key: ${asset.s3_key_raw || '❌ NULL'}`);
        console.log(`   File Name: ${asset.file_name || '❌ NULL'}`);
        console.log(`   Content Type: ${asset.content_type || '❌ NULL'}`);
        console.log(`   File Size: ${asset.file_size_bytes || '⚠️  NULL'}`);
        console.log(`   Status: ${asset.approval_status || '⚠️  NULL'}`);
        console.log('');
      });
    } else {
      console.log('✅ All assets have critical fields populated');
    }

    // ═══════════════════════════════════════════════════════════
    // 3. CHECK FOR DUPLICATE ASSETS
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 3. CHECKING FOR DUPLICATE ASSETS (SAME NAME + TYPE)');
    console.log('-'.repeat(70));
    
    const [duplicates] = await sequelize.query(`
      SELECT 
        name,
        asset_type,
        COUNT(*) as count,
        STRING_AGG(id::text, ', ') as ids
      FROM assets 
      WHERE deleted_at IS NULL
      GROUP BY name, asset_type
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);

    if (duplicates.length > 0) {
      console.log(`⚠️  FOUND ${duplicates.length} DUPLICATE ASSET SETS:\n`);
      duplicates.forEach((dup, idx) => {
        console.log(`${idx + 1}. "${dup.name}" [${dup.asset_type}]`);
        console.log(`   Count: ${dup.count} duplicates`);
        console.log(`   IDs: ${dup.ids}`);
        console.log('');
      });
    } else {
      console.log('✅ No duplicate assets found');
    }

    // ═══════════════════════════════════════════════════════════
    // 4. CHECK FOR ORPHANED EPISODE_ASSETS REFERENCES
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 4. CHECKING FOR ORPHANED EPISODE_ASSETS REFERENCES');
    console.log('-'.repeat(70));
    
    const [orphanedEpisodeAssets] = await sequelize.query(`
      SELECT 
        ea.id,
        ea.episode_id,
        ea.asset_id,
        e.title as episode_title
      FROM episode_assets ea
      LEFT JOIN assets a ON ea.asset_id = a.id
      LEFT JOIN episodes e ON ea.episode_id = e.id
      WHERE a.id IS NULL OR a.deleted_at IS NOT NULL
      ORDER BY ea.created_at DESC;
    `);

    if (orphanedEpisodeAssets.length > 0) {
      console.log(`❌ FOUND ${orphanedEpisodeAssets.length} ORPHANED EPISODE_ASSETS REFERENCES:\n`);
      orphanedEpisodeAssets.forEach((ea, idx) => {
        console.log(`${idx + 1}. Episode: ${ea.episode_title || 'Unknown'}`);
        console.log(`   Episode ID: ${ea.episode_id}`);
        console.log(`   Asset ID: ${ea.asset_id} (MISSING OR DELETED)`);
        console.log(`   Junction ID: ${ea.id}`);
        console.log('');
      });
    } else {
      console.log('✅ No orphaned episode_assets references');
    }

    // ═══════════════════════════════════════════════════════════
    // 5. CHECK FOR DATA URI IMAGES (SHOULD BE S3 URLS)
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 5. CHECKING FOR DATA URI IMAGES (INVALID)');
    console.log('-'.repeat(70));
    
    const [dataUris] = await sequelize.query(`
      SELECT 
        id, 
        name, 
        asset_type,
        asset_role,
        LENGTH(s3_url_raw) as raw_length,
        LENGTH(s3_url_processed) as processed_length
      FROM assets 
      WHERE deleted_at IS NULL
        AND (
          s3_url_raw LIKE 'data:%'
          OR s3_url_processed LIKE 'data:%'
          OR LENGTH(s3_url_raw) > 5000
          OR LENGTH(s3_url_processed) > 5000
        )
      ORDER BY created_at DESC;
    `);

    if (dataUris.length > 0) {
      console.log(`❌ FOUND ${dataUris.length} ASSETS WITH DATA URIs (SHOULD BE S3 URLS):\n`);
      dataUris.forEach((asset, idx) => {
        console.log(`${idx + 1}. ${asset.name}`);
        console.log(`   ID: ${asset.id}`);
        console.log(`   Type: ${asset.asset_type}`);
        console.log(`   Role: ${asset.asset_role || 'NULL'}`);
        console.log(`   Raw URL Length: ${asset.raw_length} chars ${asset.raw_length > 500 ? '❌ TOO LONG' : ''}`);
        console.log(`   Processed URL Length: ${asset.processed_length} chars ${asset.processed_length > 500 ? '❌ TOO LONG' : ''}`);
        console.log('');
      });
    } else {
      console.log('✅ No data URI images found');
    }

    // ═══════════════════════════════════════════════════════════
    // 6. CHECK FILE SIZE ANOMALIES
    // ═══════════════════════════════════════════════════════════
    console.log('\n📍 6. CHECKING FOR FILE SIZE ANOMALIES');
    console.log('-'.repeat(70));
    
    const [sizeAnomalies] = await sequelize.query(`
      SELECT 
        id, 
        name, 
        asset_type,
        content_type,
        file_size_bytes,
        CASE 
          WHEN file_size_bytes = 0 THEN 'ZERO SIZE'
          WHEN file_size_bytes > 500000000 THEN 'TOO LARGE (>500MB)'
          WHEN file_size_bytes IS NULL THEN 'NULL SIZE'
          ELSE 'OK'
        END as issue
      FROM assets 
      WHERE deleted_at IS NULL
        AND (
          file_size_bytes IS NULL
          OR file_size_bytes = 0
          OR file_size_bytes > 500000000
        )
      ORDER BY file_size_bytes DESC NULLS LAST;
    `);

    if (sizeAnomalies.length > 0) {
      console.log(`⚠️  FOUND ${sizeAnomalies.length} ASSETS WITH SIZE ANOMALIES:\n`);
      sizeAnomalies.forEach((asset, idx) => {
        console.log(`${idx + 1}. ${asset.name}`);
        console.log(`   ID: ${asset.id}`);
        console.log(`   Type: ${asset.asset_type}`);
        console.log(`   Content Type: ${asset.content_type || 'NULL'}`);
        console.log(`   Size: ${asset.file_size_bytes || 'NULL'} bytes`);
        console.log(`   Issue: ${asset.issue}`);
        console.log('');
      });
    } else {
      console.log('✅ All file sizes are reasonable');
    }

    // ═══════════════════════════════════════════════════════════
    // 7. SUMMARY STATISTICS
    // ═══════════════════════════════════════════════════════════
    console.log('\n📊 SUMMARY STATISTICS');
    console.log('='.repeat(70));
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_assets,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_assets,
        COUNT(CASE WHEN s3_url_raw IS NULL THEN 1 END) as missing_raw_url,
        COUNT(CASE WHEN s3_url_processed IS NULL THEN 1 END) as missing_processed_url,
        COUNT(CASE WHEN asset_role IS NULL THEN 1 END) as missing_role,
        COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN approval_status = 'REJECTED' THEN 1 END) as rejected
      FROM assets;
    `);

    const s = stats[0];
    console.log(`Total Assets:           ${s.total_assets}`);
    console.log(`Active Assets:          ${s.active_assets}`);
    console.log(`Deleted Assets:         ${s.deleted_assets}`);
    console.log(`Missing Raw URL:        ${s.missing_raw_url} ${s.missing_raw_url > 0 ? '❌' : '✅'}`);
    console.log(`Missing Processed URL:  ${s.missing_processed_url} ${s.missing_processed_url > 0 ? '❌' : '✅'}`);
    console.log(`Missing Role:           ${s.missing_role} ${s.missing_role > 0 ? '⚠️' : '✅'}`);
    console.log(`Pending:                ${s.pending}`);
    console.log(`Approved:               ${s.approved}`);
    console.log(`Rejected:               ${s.rejected}`);

    // ═══════════════════════════════════════════════════════════
    // 8. GENERATE FIX RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════
    console.log('\n\n💡 RECOMMENDED FIXES');
    console.log('='.repeat(70));
    
    const issues = [];
    
    if (nullUrls.length > 0) {
      issues.push({
        priority: 'CRITICAL',
        issue: `${nullUrls.length} assets with invalid S3 URLs`,
        fix: 'Delete these assets or re-upload files to S3',
        command: 'DELETE FROM assets WHERE s3_url_raw IS NULL OR s3_url_raw = \'\';'
      });
    }
    
    if (nullFields.length > 0) {
      issues.push({
        priority: 'HIGH',
        issue: `${nullFields.length} assets with NULL critical fields`,
        fix: 'Update missing fields or delete corrupt records',
        command: 'Review individually - may need re-upload'
      });
    }
    
    if (duplicates.length > 0) {
      issues.push({
        priority: 'MEDIUM',
        issue: `${duplicates.length} duplicate asset sets`,
        fix: 'Keep newest version, soft-delete older duplicates',
        command: 'UPDATE assets SET deleted_at = NOW() WHERE id IN (...older IDs...);'
      });
    }
    
    if (orphanedEpisodeAssets.length > 0) {
      issues.push({
        priority: 'MEDIUM',
        issue: `${orphanedEpisodeAssets.length} orphaned episode_assets references`,
        fix: 'Delete orphaned junction table records',
        command: `DELETE FROM episode_assets WHERE asset_id NOT IN (SELECT id FROM assets WHERE deleted_at IS NULL);`
      });
    }
    
    if (dataUris.length > 0) {
      issues.push({
        priority: 'HIGH',
        issue: `${dataUris.length} assets with data URIs instead of S3 URLs`,
        fix: 'Delete and re-upload these assets properly',
        command: 'DELETE FROM assets WHERE s3_url_raw LIKE \'data:%\';'
      });
    }
    
    if (sizeAnomalies.length > 0) {
      issues.push({
        priority: 'LOW',
        issue: `${sizeAnomalies.length} assets with file size anomalies`,
        fix: 'Update file_size_bytes from S3 metadata or re-upload',
        command: 'Review individually'
      });
    }

    if (issues.length === 0) {
      console.log('✅ NO CORRUPTION DETECTED! Your assets database is healthy.');
    } else {
      issues.forEach((issue, idx) => {
        console.log(`\n${idx + 1}. [${issue.priority}] ${issue.issue}`);
        console.log(`   Fix: ${issue.fix}`);
        console.log(`   SQL: ${issue.command}`);
      });
      
      console.log('\n\n⚠️  BEFORE RUNNING ANY DELETE COMMANDS:');
      console.log('   1. Backup your database');
      console.log('   2. Test on a development environment first');
      console.log('   3. Verify with SELECT queries before DELETE');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ DIAGNOSIS COMPLETE\n');

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR DURING DIAGNOSIS:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the diagnosis
diagnoseCorruptedAssets();

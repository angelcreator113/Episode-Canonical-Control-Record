/**
 * Schema Versioning & Migration Utilities for Scene Composer
 * 
 * This module provides version checking and migration paths for compositions.
 * Prevents future migrations from corrupting old compositions.
 * 
 * Schema Version History:
 * - v1: Initial schema with scenes[], assets[], settings { layers, format, etc. }
 */

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Get the schema version from a composition
 * @param {object} composition - Composition object
 * @returns {number} Schema version (defaults to 1 if missing)
 */
export function getSchemaVersion(composition) {
  if (!composition) return 1;
  
  // Check settings.schemaVersion first (new format)
  if (composition.settings?.schemaVersion) {
    return composition.settings.schemaVersion;
  }
  
  // Legacy compositions without version are treated as v1
  return 1;
}

/**
 * Check if a composition needs migration
 * @param {object} composition - Composition object
 * @returns {boolean} True if migration is needed
 */
export function needsMigration(composition) {
  const version = getSchemaVersion(composition);
  return version < CURRENT_SCHEMA_VERSION;
}

/**
 * Migrate a composition to the current schema version
 * @param {object} composition - Composition object
 * @returns {object} Migrated composition
 */
export function migrateComposition(composition) {
  if (!composition) return null;
  
  let migrated = { ...composition };
  const fromVersion = getSchemaVersion(composition);
  
  // Apply migrations sequentially
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    migrated = applyMigration(migrated, v, v + 1);
  }
  
  return migrated;
}

/**
 * Apply a specific migration
 * @param {object} composition - Composition object
 * @param {number} fromVersion - Source version
 * @param {number} toVersion - Target version
 * @returns {object} Migrated composition
 */
function applyMigration(composition, fromVersion, toVersion) {
  console.log(`[Schema Migration] ${fromVersion} → ${toVersion}`, composition.id);
  
  // Migration paths will be added here as schema evolves
  // Example:
  // if (fromVersion === 1 && toVersion === 2) {
  //   return migrateV1ToV2(composition);
  // }
  
  // For now, just ensure schema version is set
  return {
    ...composition,
    settings: {
      ...(composition.settings || {}),
      schemaVersion: toVersion
    }
  };
}

/**
 * Validate composition structure
 * @param {object} composition - Composition object
 * @returns {object} Validation result { valid: boolean, errors: string[] }
 */
export function validateComposition(composition) {
  const errors = [];
  
  if (!composition) {
    errors.push('Composition is null or undefined');
    return { valid: false, errors };
  }
  
  // Required fields
  if (!composition.id) errors.push('Missing id');
  if (!composition.episode_id) errors.push('Missing episode_id');
  if (!composition.name) errors.push('Missing name');
  
  // Type checks
  if (composition.scenes && !Array.isArray(composition.scenes)) {
    errors.push('scenes must be an array');
  }
  if (composition.assets && !Array.isArray(composition.assets)) {
    errors.push('assets must be an array');
  }
  if (composition.settings && typeof composition.settings !== 'object') {
    errors.push('settings must be an object');
  }
  
  // Schema version
  const version = getSchemaVersion(composition);
  if (version > CURRENT_SCHEMA_VERSION) {
    errors.push(`Unsupported schema version ${version} (current: ${CURRENT_SCHEMA_VERSION})`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Prepare composition for saving (ensure schema version is set)
 * @param {object} composition - Composition object
 * @returns {object} Composition with schema version
 */
export function prepareForSave(composition) {
  return {
    ...composition,
    settings: {
      ...(composition.settings || {}),
      schemaVersion: CURRENT_SCHEMA_VERSION
    }
  };
}

/**
 * Load and migrate composition if needed
 * @param {object} composition - Raw composition from backend
 * @returns {object} Loaded and migrated composition
 */
export function loadComposition(composition) {
  if (!composition) return null;
  
  // Validate
  const validation = validateComposition(composition);
  if (!validation.valid) {
    console.error('[Schema] Invalid composition:', validation.errors);
    throw new Error(`Invalid composition: ${validation.errors.join(', ')}`);
  }
  
  // Migrate if needed
  if (needsMigration(composition)) {
    console.warn('[Schema] Migrating composition', composition.id, 
                 `v${getSchemaVersion(composition)} → v${CURRENT_SCHEMA_VERSION}`);
    return migrateComposition(composition);
  }
  
  return composition;
}

/**
 * Create a new composition with current schema version
 * @param {object} data - Initial composition data
 * @returns {object} Composition with schema version
 */
export function createComposition(data) {
  return {
    name: data.name || 'Untitled Composition',
    episode_id: data.episode_id,
    scenes: data.scenes || [],
    assets: data.assets || [],
    settings: {
      ...(data.settings || {}),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      format: data.settings?.format || '16:9',
      layers: data.settings?.layers || []
    },
    status: 'draft'
  };
}

export default {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  needsMigration,
  migrateComposition,
  validateComposition,
  prepareForSave,
  loadComposition,
  createComposition
};

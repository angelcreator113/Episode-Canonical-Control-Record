/**
 * Icon Cue Timeline System Migration
 * 
 * Creates tables for:
 * - Icon slot mappings (role → slot)
 * - Icon cues (timeline of icon appearances with anchors)
 * - Cursor actions (cursor movements with flexible targets)
 * - Music cues (simplified scene-based music)
 * - Production packages (export bundles)
 * 
 * Author: Prime Studios Development Team
 * Date: February 9, 2026
 */

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  
  // ============================================================================
  // TABLE 1: icon_slot_mappings
  // Maps asset roles to UI slots and positions
  // ============================================================================
  
  pgm.createTable('icon_slot_mappings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    
    // Asset Role → Slot Mapping
    asset_role: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
      comment: 'Hierarchical asset role (e.g., UI.ICON.CLOSET)',
    },
    slot_id: {
      type: 'varchar(20)',
      notNull: true,
      comment: 'Canonical slot identifier (slot_1, slot_2, etc.)',
    },
    
    // Categorization
    slot_category: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Category: action, notification, persistent, guest_action',
    },
    icon_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Icon type: closet, mail, voice, to_do, etc.',
    },
    
    // Display Properties
    display_position: {
      type: 'varchar(50)',
      comment: 'Screen position: top_left, right_side, bottom_left, floating',
    },
    is_persistent: {
      type: 'boolean',
      default: false,
      comment: 'True if icon should always be visible',
    },
    
    // Multiple States Support
    supports_states: {
      type: 'boolean',
      default: false,
      comment: 'True if icon has multiple states (idle/active)',
    },
    state_metadata: {
      type: 'jsonb',
      comment: 'State definitions: {idle: {file: "..."}, active: {file: "..."}}',
    },
    
    // Positioning Data
    default_position: {
      type: 'jsonb',
      comment: 'Default position: {x: 850, y: 400, width: 80, height: 80}',
    },
    
    // Metadata
    metadata: {
      type: 'jsonb',
      comment: 'Additional properties',
    },
    notes: {
      type: 'text',
      comment: 'Implementation notes',
    },
    
    // Timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  
  // Indexes for icon_slot_mappings
  pgm.createIndex('icon_slot_mappings', 'slot_id');
  pgm.createIndex('icon_slot_mappings', 'slot_category');
  pgm.createIndex('icon_slot_mappings', 'icon_type');
  
  
  // ============================================================================
  // TABLE 2: icon_cues
  // Timeline of icon appearances/actions with anchor support
  // ============================================================================
  
  pgm.createTable('icon_cues', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    
    // Episode Reference
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    
    // Asset Reference (can be NULL for anchors)
    asset_id: {
      type: 'uuid',
      references: 'assets',
      onDelete: 'SET NULL',
      comment: 'Links to actual icon asset in assets table',
    },
    
    // Timing
    timestamp: {
      type: 'decimal(10,3)',
      notNull: true,
      comment: 'Seconds from episode start (e.g., 12.500 = 00:12.5)',
    },
    duration_ms: {
      type: 'integer',
      comment: 'Animation/action duration in milliseconds',
    },
    
    // Slot & Position
    slot_id: {
      type: 'varchar(20)',
      notNull: true,
      comment: 'Target slot: slot_1, slot_2, slot_3, slot_4, slot_5',
    },
    position_data: {
      type: 'jsonb',
      comment: 'Custom positioning: {x, y, width, height}',
    },
    
    // Action & Animation
    action: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Action type: appear, disappear, glow, pulse, click, open, close, highlight, shake',
    },
    transition: {
      type: 'varchar(50)',
      comment: 'Transition type: fade_in, slide_in, pop_in, bounce',
    },
    easing: {
      type: 'varchar(50)',
      default: 'ease-out',
      comment: 'Easing function: ease-in, ease-out, ease-in-out, linear',
    },
    
    // State Support (for multi-state icons like voice idle/active)
    icon_state: {
      type: 'varchar(50)',
      comment: 'Icon state: idle, active, hover, disabled',
    },
    
    // Approval Workflow
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'suggested',
      comment: 'Status: suggested, approved, rejected, modified',
    },
    
    // Anchor Support (NEW)
    is_anchor: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Mark as referenceable anchor point',
    },
    anchor_name: {
      type: 'varchar(100)',
      comment: 'Anchor identifier (e.g., "closet_open_moment", "mail_received")',
    },
    
    // Metadata
    metadata: {
      type: 'jsonb',
      comment: 'Additional properties, effects, parameters',
    },
    notes: {
      type: 'text',
      comment: 'User notes/comments',
    },
    
    // AI Generation Tracking
    generated_by: {
      type: 'varchar(50)',
      comment: 'Generation method: ai, manual, imported',
    },
    generation_confidence: {
      type: 'decimal(3,2)',
      comment: 'AI confidence score (0.00 to 1.00)',
    },
    
    // Timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  
  // Indexes for icon_cues
  pgm.createIndex('icon_cues', 'episode_id');
  pgm.createIndex('icon_cues', ['episode_id', 'timestamp']);
  pgm.createIndex('icon_cues', 'asset_id');
  pgm.createIndex('icon_cues', 'status');
  pgm.createIndex('icon_cues', ['episode_id', 'is_anchor', 'anchor_name']);
  pgm.createIndex('icon_cues', 'slot_id');
  
  // Constraints for icon_cues
  pgm.addConstraint('icon_cues', 'valid_slot', {
    check: "slot_id IN ('slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5')",
  });
  
  pgm.addConstraint('icon_cues', 'valid_action', {
    check: "action IN ('appear', 'disappear', 'glow', 'pulse', 'click', 'open', 'close', 'highlight', 'shake', 'bounce', 'rotate')",
  });
  
  pgm.addConstraint('icon_cues', 'valid_status', {
    check: "status IN ('suggested', 'approved', 'rejected', 'modified')",
  });
  
  pgm.addConstraint('icon_cues', 'anchor_requires_name', {
    check: "(is_anchor = false) OR (is_anchor = true AND anchor_name IS NOT NULL)",
  });
  
  
  // ============================================================================
  // TABLE 3: cursor_actions
  // Cursor movements with flexible targeting
  // ============================================================================
  
  pgm.createTable('cursor_actions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    
    // Episode Reference
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    
    // Flexible Target Support
    target_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Target type: icon_cue, screen_position, anchor, asset',
    },
    target_id: {
      type: 'uuid',
      comment: 'Reference to icon_cue, asset, or NULL for screen position',
    },
    target_anchor: {
      type: 'varchar(100)',
      comment: 'Reference anchor by name (from icon_cues.anchor_name)',
    },
    
    // Timing
    timestamp: {
      type: 'decimal(10,3)',
      notNull: true,
      comment: 'Seconds from episode start',
    },
    duration_ms: {
      type: 'integer',
      notNull: true,
      comment: 'Movement duration in milliseconds',
    },
    
    // Movement
    action_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Action: move, hover, click, drag, double_click, right_click',
    },
    from_position: {
      type: 'jsonb',
      comment: 'Starting position: {x, y} or NULL if starting off-screen',
    },
    to_position: {
      type: 'jsonb',
      notNull: true,
      comment: 'Target position: {x, y}',
    },
    
    // Animation
    easing: {
      type: 'varchar(50)',
      notNull: true,
      default: 'ease-out',
      comment: 'Easing function',
    },
    path_type: {
      type: 'varchar(50)',
      notNull: true,
      default: 'direct',
      comment: 'Path type: direct, curved, arc, bezier',
    },
    path_control_points: {
      type: 'jsonb',
      comment: 'Control points for curved paths',
    },
    
    // Effects
    show_trail: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Show cursor trail effect',
    },
    click_effect: {
      type: 'varchar(50)',
      comment: 'Click effect: ripple, glow, press, none',
    },
    hover_duration_ms: {
      type: 'integer',
      comment: 'Hover duration before click (for hover actions)',
    },
    
    // Approval
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'suggested',
      comment: 'Status: suggested, approved, rejected, modified',
    },
    
    // Metadata
    metadata: {
      type: 'jsonb',
      comment: 'Additional properties',
    },
    notes: {
      type: 'text',
      comment: 'User notes/comments',
    },
    
    // AI Generation Tracking
    generated_by: {
      type: 'varchar(50)',
      comment: 'Generation method: ai, manual, imported',
    },
    generation_confidence: {
      type: 'decimal(3,2)',
      comment: 'AI confidence score',
    },
    
    // Timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  
  // Indexes for cursor_actions
  pgm.createIndex('cursor_actions', 'episode_id');
  pgm.createIndex('cursor_actions', ['episode_id', 'timestamp']);
  pgm.createIndex('cursor_actions', ['target_type', 'target_id']);
  pgm.createIndex('cursor_actions', 'status');
  
  // Constraints for cursor_actions
  pgm.addConstraint('cursor_actions', 'valid_target_type', {
    check: "target_type IN ('icon_cue', 'screen_position', 'anchor', 'asset')",
  });
  
  pgm.addConstraint('cursor_actions', 'valid_action_type', {
    check: "action_type IN ('move', 'hover', 'click', 'drag', 'double_click', 'right_click', 'scroll')",
  });
  
  pgm.addConstraint('cursor_actions', 'valid_status', {
    check: "status IN ('suggested', 'approved', 'rejected', 'modified')",
  });
  
  
  // ============================================================================
  // TABLE 4: music_cues
  // Simplified scene-based music cues (v1)
  // ============================================================================
  
  pgm.createTable('music_cues', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    
    // Episode Reference
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    
    // Scene Reference
    scene_name: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Scene identifier: Stream Open, Styling Phase, Screenplay Beat, etc.',
    },
    scene_beat: {
      type: 'varchar(50)',
      comment: 'Lala Formula beat: stream_open, inciting_moment, styling_phase, etc.',
    },
    
    // Timing
    start_time: {
      type: 'decimal(10,3)',
      notNull: true,
      comment: 'Start time in seconds',
    },
    end_time: {
      type: 'decimal(10,3)',
      comment: 'End time in seconds (NULL = continues to next cue)',
    },
    
    // Track Info (simplified for v1)
    track_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Track type: instrumental, vocal',
    },
    intensity: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'Intensity: very_low, light, medium, fuller, cinematic',
    },
    
    // Optional Details
    track_name: {
      type: 'varchar(255)',
      comment: 'Optional track name (e.g., "Lala Theme v1")',
    },
    mood: {
      type: 'varchar(100)',
      comment: 'Mood description for editor',
    },
    notes: {
      type: 'text',
      comment: 'Editor notes about section, crossfades, etc.',
    },
    
    // Approval
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'suggested',
      comment: 'Status: suggested, approved, rejected, modified',
    },
    
    // Metadata
    metadata: {
      type: 'jsonb',
      comment: 'Future expansion: volume, crossfade, BPM, etc.',
    },
    
    // Timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  
  // Indexes for music_cues
  pgm.createIndex('music_cues', 'episode_id');
  pgm.createIndex('music_cues', ['episode_id', 'scene_name']);
  pgm.createIndex('music_cues', ['episode_id', 'start_time']);
  pgm.createIndex('music_cues', 'status');
  
  // Constraints for music_cues
  pgm.addConstraint('music_cues', 'valid_track_type', {
    check: "track_type IN ('instrumental', 'vocal')",
  });
  
  pgm.addConstraint('music_cues', 'valid_intensity', {
    check: "intensity IN ('very_low', 'light', 'medium', 'fuller', 'cinematic')",
  });
  
  pgm.addConstraint('music_cues', 'valid_status', {
    check: "status IN ('suggested', 'approved', 'rejected', 'modified')",
  });
  
  
  // ============================================================================
  // TABLE 5: production_packages
  // Export bundles with all production files
  // ============================================================================
  
  pgm.createTable('production_packages', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    
    // Episode Reference
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    
    // Version Control
    package_version: {
      type: 'varchar(10)',
      notNull: true,
      comment: 'Version: v1, v2, v3, etc.',
    },
    is_latest: {
      type: 'boolean',
      notNull: true,
      default: true,
      comment: 'Mark latest version',
    },
    
    // Package Contents (structured data)
    package_data: {
      type: 'jsonb',
      notNull: true,
      comment: 'Complete structured package data',
    },
    
    // Individual File Contents
    final_script_md: {
      type: 'text',
      comment: 'Final script markdown',
    },
    final_script_json: {
      type: 'jsonb',
      comment: 'Final script structured JSON',
    },
    icon_cues_md: {
      type: 'text',
      comment: 'Icon cues markdown',
    },
    icon_cues_json: {
      type: 'jsonb',
      comment: 'Icon cues structured JSON',
    },
    cursor_paths_json: {
      type: 'jsonb',
      comment: 'Cursor paths structured JSON',
    },
    music_cues_md: {
      type: 'text',
      comment: 'Music cues markdown',
    },
    publishing_info_md: {
      type: 'text',
      comment: 'Title, description, hashtags',
    },
    state_tracker_json: {
      type: 'jsonb',
      comment: 'Episode state (coins, confidence, reputation)',
    },
    
    // Export Files
    zip_file_s3_url: {
      type: 'text',
      comment: 'S3 URL to ZIP file',
    },
    zip_file_s3_key: {
      type: 'text',
      comment: 'S3 key for ZIP file',
    },
    zip_file_size_bytes: {
      type: 'bigint',
      comment: 'ZIP file size',
    },
    
    // Generation Metadata
    generated_by: {
      type: 'varchar(255)',
      comment: 'User who generated package',
    },
    generation_duration_ms: {
      type: 'integer',
      comment: 'Time taken to generate package',
    },
    
    // Timestamps
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });
  
  // Indexes for production_packages
  pgm.createIndex('production_packages', 'episode_id');
  pgm.createIndex('production_packages', ['episode_id', 'is_latest']);
  pgm.createIndex('production_packages', 'created_at');
  
  
  // ============================================================================
  // SEED DATA: Icon Slot Mappings
  // Populate with canonical slot mappings
  // ============================================================================
  
  const iconSlotMappings = [
    
    // ========== SLOT 1: VOICE/CONTROL (Persistent) ==========
    {
      asset_role: 'UI.ICON.VOICE.IDLE',
      slot_id: 'slot_1',
      slot_category: 'persistent',
      icon_type: 'voice',
      display_position: 'top_left',
      is_persistent: true,
      supports_states: true,
      state_metadata: { idle: { description: 'Creator not speaking' }, active: { description: 'Creator is speaking' } },
      default_position: { x: 40, y: 40, width: 60, height: 60 },
      notes: 'Persistent voice control icon - always visible',
    },
    {
      asset_role: 'UI.ICON.VOICE.ACTIVE',
      slot_id: 'slot_1',
      slot_category: 'persistent',
      icon_type: 'voice',
      display_position: 'top_left',
      is_persistent: true,
      supports_states: true,
      state_metadata: { active: { description: 'Creator speaking state' } },
      default_position: { x: 40, y: 40, width: 60, height: 60 },
      notes: 'Active state of voice icon',
    },
    
    // ========== SLOT 2: ACTION ICONS (Right Side) ==========
    {
      asset_role: 'UI.ICON.CLOSET',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'closet',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Wardrobe/closet access icon',
    },
    {
      asset_role: 'UI.ICON.TODO_LIST',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'to_do',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'To-do list icon',
    },
    {
      asset_role: 'UI.ICON.JEWELRY_BOX',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'jewelry',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Jewelry collection icon',
    },
    {
      asset_role: 'UI.ICON.PURSE',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'purse',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Purse/bag access icon',
    },
    {
      asset_role: 'UI.ICON.PERFUME',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'perfume',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Perfume collection icon',
    },
    {
      asset_role: 'UI.ICON.LOCATION',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'location',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Location/navigation icon',
    },
    
    // ========== SLOT 3: NOTIFICATIONS (Floating) ==========
    {
      asset_role: 'UI.ICON.MAIL',
      slot_id: 'slot_3',
      slot_category: 'notification',
      icon_type: 'mail',
      display_position: 'floating',
      is_persistent: false,
      default_position: { x: 450, y: 100, width: 70, height: 70 },
      notes: 'Mail/message notification icon',
    },
    {
      asset_role: 'UI.ICON.BESTIE_NEWS',
      slot_id: 'slot_3',
      slot_category: 'notification',
      icon_type: 'bestie_news',
      display_position: 'floating',
      is_persistent: false,
      default_position: { x: 450, y: 100, width: 70, height: 70 },
      notes: 'Bestie news notification icon',
    },
    {
      asset_role: 'UI.ICON.COINS',
      slot_id: 'slot_3',
      slot_category: 'notification',
      icon_type: 'coins',
      display_position: 'floating',
      is_persistent: false,
      default_position: { x: 450, y: 100, width: 70, height: 70 },
      notes: 'Coins/currency notification icon',
    },
    
    // ========== SLOT 4: GUEST ACTIONS (Conditional) ==========
    // Guest actions can reuse Slot 2 icons or have unique ones
    // For now, we'll create a generic guest action holder
    
    // ========== SLOT 5: GALLERY/CAREER HISTORY (Bottom Left, Persistent) ==========
    {
      asset_role: 'UI.ICON.GALLERY',
      slot_id: 'slot_5',
      slot_category: 'persistent',
      icon_type: 'gallery',
      display_position: 'bottom_left',
      is_persistent: true,
      default_position: { x: 40, y: 600, width: 60, height: 60 },
      notes: 'Gallery/career history icon - persistent',
    },
    {
      asset_role: 'UI.ICON.CAREER_HISTORY',
      slot_id: 'slot_5',
      slot_category: 'persistent',
      icon_type: 'career_history',
      display_position: 'bottom_left',
      is_persistent: true,
      default_position: { x: 40, y: 600, width: 60, height: 60 },
      notes: 'Career history/achievements icon',
    },
    
    // ========== EXISTING ICONS (Keep compatibility) ==========
    {
      asset_role: 'UI.ICON.SPEECH',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'speech',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Speech bubble icon',
    },
    {
      asset_role: 'UI.ICON.POSE',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'pose',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Pose/photo icon',
    },
    {
      asset_role: 'UI.ICON.RESERVED',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'reserved',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Reserved slot for future use',
    },
    {
      asset_role: 'UI.ICON.HOLDER.MAIN',
      slot_id: 'slot_2',
      slot_category: 'action',
      icon_type: 'holder',
      display_position: 'right_side',
      is_persistent: false,
      default_position: { x: 850, y: 400, width: 80, height: 80 },
      notes: 'Generic icon container graphic',
    },
  ];
  
  // Insert all mappings
  iconSlotMappings.forEach((mapping) => {
    pgm.sql(`
      INSERT INTO icon_slot_mappings (
        asset_role,
        slot_id,
        slot_category,
        icon_type,
        display_position,
        is_persistent,
        supports_states,
        state_metadata,
        default_position,
        notes
      ) VALUES (
        '${mapping.asset_role}',
        '${mapping.slot_id}',
        '${mapping.slot_category}',
        '${mapping.icon_type}',
        '${mapping.display_position}',
        ${mapping.is_persistent},
        ${mapping.supports_states || false},
        ${mapping.state_metadata ? `'${JSON.stringify(mapping.state_metadata)}'::jsonb` : 'NULL'},
        '${JSON.stringify(mapping.default_position)}'::jsonb,
        '${mapping.notes}'
      );
    `);
  });
  
  console.log('✅ Inserted ' + iconSlotMappings.length + ' icon slot mappings');
};


/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('production_packages', { ifExists: true, cascade: true });
  pgm.dropTable('music_cues', { ifExists: true, cascade: true });
  pgm.dropTable('cursor_actions', { ifExists: true, cascade: true });
  pgm.dropTable('icon_cues', { ifExists: true, cascade: true });
  pgm.dropTable('icon_slot_mappings', { ifExists: true, cascade: true });
};

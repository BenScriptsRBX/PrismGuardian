// db.js - PostgreSQL Database Service with PrismGuard Features
// Complete implementation with all tables, migrations, and user join tracking

const { Pool } = require('pg');

class EnhancedDatabaseService {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database pool error:', err.message);
    });

    this.initialized = false;
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    try {
      const client = await this.pool.connect();
      console.log('✅ Connected to PostgreSQL database');
      client.release();

      await this.createTables();
      await this.runMigrations();
      this.initialized = true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error;
    }
  }

  async createTables() {
    const queries = [
      // ==================== INFRACTIONS TABLE ====================
      `CREATE TABLE IF NOT EXISTS infractions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        moderator_id VARCHAR(255) NOT NULL,
        automated BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
      );`,

      // ==================== SERVER SETTINGS TABLE ====================
      `CREATE TABLE IF NOT EXISTS server_settings (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) UNIQUE NOT NULL,
        auto_mod_enabled BOOLEAN DEFAULT true,
        raid_protection_enabled BOOLEAN DEFAULT true,
        log_channel VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );`,

      // ==================== MODERATION FILTERS TABLE ====================
      `CREATE TABLE IF NOT EXISTS moderation_filters (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) UNIQUE NOT NULL,
        nsfw BOOLEAN DEFAULT true,
        sexual BOOLEAN DEFAULT true,
        racist BOOLEAN DEFAULT true,
        hate BOOLEAN DEFAULT true,
        profanity BOOLEAN DEFAULT true,
        spam BOOLEAN DEFAULT true,
        images BOOLEAN DEFAULT true,
        keywords TEXT[] DEFAULT '{}',
        regex_patterns TEXT[] DEFAULT '{}',
        whitelisted_domains TEXT[] DEFAULT '{}',
        spam_threshold INT DEFAULT 5,
        spam_window INT DEFAULT 10,
        mention_threshold INT DEFAULT 5,
        action_threshold INT DEFAULT 8,
        delete_threshold INT DEFAULT 10,
        timeout_threshold INT DEFAULT 15,
        ban_threshold INT DEFAULT 20,
        ai_enabled BOOLEAN DEFAULT false,
        ai_new_users_only BOOLEAN DEFAULT true,
        ai_confidence FLOAT DEFAULT 0.85,
        ai_service VARCHAR(50) DEFAULT 'none',
        ai_new_user_threshold INT DEFAULT 7,
        ai_approval_mode BOOLEAN DEFAULT false,
        context_enabled BOOLEAN DEFAULT false,
        raid_protection_enabled BOOLEAN DEFAULT true,
        raid_join_threshold INT DEFAULT 10,
        raid_join_window INT DEFAULT 60,
        log_channel VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );`,

      // ==================== USER STATS TABLE ====================
      `CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        guild_id VARCHAR(255) NOT NULL,
        message_count INT DEFAULT 0,
        unique_messages INT DEFAULT 0,
        warning_count INT DEFAULT 0,
        mute_count INT DEFAULT 0,
        kick_count INT DEFAULT 0,
        ban_count INT DEFAULT 0,
        last_message TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, guild_id)
      );`,

      // ==================== WELCOME MESSAGES TABLE ====================
      `CREATE TABLE IF NOT EXISTS welcome_messages (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) UNIQUE NOT NULL,
        message_id VARCHAR(255),
        sent_at TIMESTAMP DEFAULT NOW()
      );`,

      // ==================== USER JOIN TRACKING ====================
      `CREATE TABLE IF NOT EXISTS user_joins (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, user_id)
      );`,

      // ==================== MESSAGE FLAGS ====================
      `CREATE TABLE IF NOT EXISTS message_flags (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        content TEXT,
        score INT,
        reason TEXT,
        ai_analysis JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        admin_action_by VARCHAR(255),
        admin_action_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, message_id)
      );`,

      // ==================== MODERATION EVENTS ====================
      `CREATE TABLE IF NOT EXISTS moderation_events (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255),
        user_id VARCHAR(255) NOT NULL,
        action_type VARCHAR(50),
        reason TEXT,
        score_breakdown JSONB,
        ai_analysis JSONB,
        moderator_id VARCHAR(255) DEFAULT 'AUTO',
        automated BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );`,

      // ==================== CHANNEL OVERRIDES ====================
      `CREATE TABLE IF NOT EXISTS channel_overrides (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        nsfw BOOLEAN,
        sexual BOOLEAN,
        racist BOOLEAN,
        hate BOOLEAN,
        profanity BOOLEAN,
        spam BOOLEAN,
        ai_enabled BOOLEAN,
        ai_confidence FLOAT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, channel_id)
      );`,

      // ==================== ROLE EXCEPTIONS ====================
      `CREATE TABLE IF NOT EXISTS role_exceptions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        exclude_filters BOOLEAN DEFAULT false,
        score_reduction INT DEFAULT 0,
        can_post_links BOOLEAN DEFAULT false,
        can_post_invites BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, role_id)
      );`,

      // ==================== MODERATION APPEALS ====================
      `CREATE TABLE IF NOT EXISTS moderation_appeals (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        message_id VARCHAR(255),
        appeal_reason TEXT NOT NULL,
        action_taken VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        reviewed_by VARCHAR(255),
        review_notes TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );`,

      // ==================== MESSAGE CONTEXT ====================
      `CREATE TABLE IF NOT EXISTS message_context (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        flag_id INT NOT NULL,
        before_messages JSONB,
        flagged_message JSONB,
        after_messages JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, flag_id)
      );`,

      // ==================== CONFIG BACKUPS ====================
      `CREATE TABLE IF NOT EXISTS config_backups (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        backup_name VARCHAR(255) NOT NULL,
        config JSONB NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );`,

      // ==================== INDEXES ====================
      `CREATE INDEX IF NOT EXISTS idx_infractions_user_guild ON infractions(user_id, guild_id);`,
      `CREATE INDEX IF NOT EXISTS idx_infractions_guild ON infractions(guild_id);`,
      `CREATE INDEX IF NOT EXISTS idx_user_stats_user_guild ON user_stats(user_id, guild_id);`,
      `CREATE INDEX IF NOT EXISTS idx_message_flags_guild ON message_flags(guild_id);`,
      `CREATE INDEX IF NOT EXISTS idx_message_flags_status ON message_flags(status);`,
      `CREATE INDEX IF NOT EXISTS idx_moderation_events_guild ON moderation_events(guild_id);`,
      `CREATE INDEX IF NOT EXISTS idx_moderation_events_user ON moderation_events(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_moderation_appeals_guild ON moderation_appeals(guild_id);`,
      `CREATE INDEX IF NOT EXISTS idx_moderation_appeals_status ON moderation_appeals(status);`,
      `CREATE INDEX IF NOT EXISTS idx_user_joins_guild_user ON user_joins(guild_id, user_id);`,
    ];

    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        console.error('Error creating table:', error.message);
      }
    }

    console.log('✅ Database tables ready');
  }

  async runMigrations() {
    try {
      console.log('🔄 Checking for missing columns in moderation_filters...');
      
      const columnsToAdd = [
        { name: 'keywords', type: 'TEXT[]', default: "DEFAULT '{}'" },
        { name: 'regex_patterns', type: 'TEXT[]', default: "DEFAULT '{}'" },
        { name: 'whitelisted_domains', type: 'TEXT[]', default: "DEFAULT '{}'" },
        { name: 'spam_threshold', type: 'INT', default: 'DEFAULT 5' },
        { name: 'spam_window', type: 'INT', default: 'DEFAULT 10' },
        { name: 'mention_threshold', type: 'INT', default: 'DEFAULT 5' },
        { name: 'action_threshold', type: 'INT', default: 'DEFAULT 8' },
        { name: 'delete_threshold', type: 'INT', default: 'DEFAULT 10' },
        { name: 'timeout_threshold', type: 'INT', default: 'DEFAULT 15' },
        { name: 'ban_threshold', type: 'INT', default: 'DEFAULT 20' },
        { name: 'ai_enabled', type: 'BOOLEAN', default: 'DEFAULT false' },
        { name: 'ai_new_users_only', type: 'BOOLEAN', default: 'DEFAULT true' },
        { name: 'ai_confidence', type: 'FLOAT', default: 'DEFAULT 0.85' },
        { name: 'ai_service', type: "VARCHAR(50)", default: "DEFAULT 'none'" },
        { name: 'ai_new_user_threshold', type: 'INT', default: 'DEFAULT 7' },
        { name: 'ai_approval_mode', type: 'BOOLEAN', default: 'DEFAULT false' },
        { name: 'raid_protection_enabled', type: 'BOOLEAN', default: 'DEFAULT true' },
        { name: 'raid_join_threshold', type: 'INT', default: 'DEFAULT 10' },
        { name: 'raid_join_window', type: 'INT', default: 'DEFAULT 60' },
        { name: 'updated_at', type: 'TIMESTAMP', default: 'DEFAULT NOW()' },
      ];

      for (const column of columnsToAdd) {
        const checkColumn = await this.pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = 'moderation_filters' AND column_name = $1;`,
          [column.name]
        );

        if (checkColumn.rows.length === 0) {
          console.log(`🔄 Adding missing column: ${column.name}`);
          try {
            await this.pool.query(
              `ALTER TABLE moderation_filters ADD COLUMN ${column.name} ${column.type} ${column.default};`
            );
            console.log(`✅ Added column: ${column.name}`);
          } catch (error) {
            if (error.code !== '42701') {
              console.warn(`Could not add ${column.name} column:`, error.message);
            }
          }
        }
      }

      console.log('✅ All migrations complete');
    } catch (error) {
      console.error('Migration error:', error.message);
    }
  }

  // ==================== INFRACTIONS ====================
  async addInfraction(userId, guildId, type, reason, moderatorId, automated = false) {
    try {
      const result = await this.pool.query(
        `INSERT INTO infractions (user_id, guild_id, type, reason, moderator_id, automated)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *;`,
        [userId, guildId, type, reason, moderatorId, automated]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error adding infraction:', error.message);
      throw error;
    }
  }

  async getUserInfractions(userId, guildId, limit = 50) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM infractions 
         WHERE user_id = $1 AND guild_id = $2 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC
         LIMIT $3;`,
        [userId, guildId, limit]
      );

      return result.rows.reverse();
    } catch (error) {
      console.error('Error getting infractions:', error.message);
      return [];
    }
  }

  async clearUserInfractions(userId, guildId) {
    try {
      const result = await this.pool.query(
        `DELETE FROM infractions 
         WHERE user_id = $1 AND guild_id = $2;`,
        [userId, guildId]
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error clearing infractions:', error.message);
      return 0;
    }
  }

  async getInfractionCount(userId, guildId) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*) FROM infractions 
         WHERE user_id = $1 AND guild_id = $2;`,
        [userId, guildId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting infraction count:', error.message);
      return 0;
    }
  }

  // ==================== MODERATION FILTERS ====================
  async getModerationsSettings(guildId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM moderation_filters WHERE guild_id = $1;`,
        [guildId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return {
        guild_id: guildId,
        nsfw: true,
        sexual: true,
        racist: true,
        hate: true,
        profanity: true,
        spam: true,
        images: true,
        keywords: [],
        regex_patterns: [],
        whitelisted_domains: [],
        spam_threshold: 5,
        spam_window: 10,
        mention_threshold: 5,
        action_threshold: 8,
        delete_threshold: 10,
        timeout_threshold: 15,
        ban_threshold: 20,
        ai_enabled: false,
        ai_new_users_only: true,
        ai_confidence: 0.85,
        ai_service: 'none',
        ai_new_user_threshold: 7,
        ai_approval_mode: false,
        raid_protection_enabled: true,
        raid_join_threshold: 10,
        raid_join_window: 60,
        log_channel: null,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting moderation settings:', error.message);
      return {};
    }
  }

  async setModerationsSettings(guildId, settings) {
    try {
      const result = await this.pool.query(
        `INSERT INTO moderation_filters (
          guild_id, nsfw, sexual, racist, hate, profanity, spam, images,
          keywords, regex_patterns, whitelisted_domains,
          spam_threshold, spam_window, mention_threshold,
          action_threshold, delete_threshold, timeout_threshold, ban_threshold,
          ai_enabled, ai_new_users_only, ai_confidence, ai_service, ai_new_user_threshold, ai_approval_mode,
          raid_protection_enabled, raid_join_threshold, raid_join_window,
          log_channel
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24,
          $25, $26, $27,
          $28
        )
        ON CONFLICT (guild_id) DO UPDATE SET
          nsfw = EXCLUDED.nsfw,
          sexual = EXCLUDED.sexual,
          racist = EXCLUDED.racist,
          hate = EXCLUDED.hate,
          profanity = EXCLUDED.profanity,
          spam = EXCLUDED.spam,
          images = EXCLUDED.images,
          keywords = EXCLUDED.keywords,
          regex_patterns = EXCLUDED.regex_patterns,
          whitelisted_domains = EXCLUDED.whitelisted_domains,
          spam_threshold = EXCLUDED.spam_threshold,
          spam_window = EXCLUDED.spam_window,
          mention_threshold = EXCLUDED.mention_threshold,
          action_threshold = EXCLUDED.action_threshold,
          delete_threshold = EXCLUDED.delete_threshold,
          timeout_threshold = EXCLUDED.timeout_threshold,
          ban_threshold = EXCLUDED.ban_threshold,
          ai_enabled = EXCLUDED.ai_enabled,
          ai_new_users_only = EXCLUDED.ai_new_users_only,
          ai_confidence = EXCLUDED.ai_confidence,
          ai_service = EXCLUDED.ai_service,
          ai_new_user_threshold = EXCLUDED.ai_new_user_threshold,
          ai_approval_mode = EXCLUDED.ai_approval_mode,
          raid_protection_enabled = EXCLUDED.raid_protection_enabled,
          raid_join_threshold = EXCLUDED.raid_join_threshold,
          raid_join_window = EXCLUDED.raid_join_window,
          log_channel = EXCLUDED.log_channel,
          updated_at = NOW()
        RETURNING *;`,
        [
          guildId,
          settings.nsfw ?? true,
          settings.sexual ?? true,
          settings.racist ?? true,
          settings.hate ?? true,
          settings.profanity ?? true,
          settings.spam ?? true,
          settings.images ?? true,
          settings.keywords || [],
          settings.regex_patterns || [],
          settings.whitelisted_domains || [],
          settings.spam_threshold ?? 5,
          settings.spam_window ?? 10,
          settings.mention_threshold ?? 5,
          settings.action_threshold ?? 8,
          settings.delete_threshold ?? 10,
          settings.timeout_threshold ?? 15,
          settings.ban_threshold ?? 20,
          settings.ai_enabled ?? false,
          settings.ai_new_users_only ?? true,
          settings.ai_confidence ?? 0.85,
          settings.ai_service ?? 'none',
          settings.ai_new_user_threshold ?? 7,
          settings.ai_approval_mode ?? false,
          settings.raid_protection_enabled ?? true,
          settings.raid_join_threshold ?? 10,
          settings.raid_join_window ?? 60,
          settings.log_channel ?? null,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error setting moderation settings:', error.message);
      throw error;
    }
  }

  // ==================== KEYWORD MANAGEMENT ====================
  async addKeyword(guildId, keyword) {
    try {
      const settings = await this.getModerationsSettings(guildId);
      const keywords = settings.keywords || [];
      
      if (!keywords.includes(keyword)) {
        keywords.push(keyword);
        await this.setModerationsSettings(guildId, { ...settings, keywords });
      }
      
      return keywords;
    } catch (error) {
      console.error('Error adding keyword:', error.message);
      throw error;
    }
  }

  async removeKeyword(guildId, keyword) {
    try {
      const settings = await this.getModerationsSettings(guildId);
      const keywords = (settings.keywords || []).filter(k => k !== keyword);
      await this.setModerationsSettings(guildId, { ...settings, keywords });
      return keywords;
    } catch (error) {
      console.error('Error removing keyword:', error.message);
      throw error;
    }
  }

  async getKeywords(guildId) {
    try {
      const settings = await this.getModerationsSettings(guildId);
      return settings.keywords || [];
    } catch (error) {
      console.error('Error getting keywords:', error.message);
      return [];
    }
  }

  // ==================== WHITELIST MANAGEMENT ====================
  async addWhitelistedDomain(guildId, domain) {
    try {
      const settings = await this.getModerationsSettings(guildId);
      const domains = settings.whitelisted_domains || [];
      
      if (!domains.includes(domain)) {
        domains.push(domain);
        await this.setModerationsSettings(guildId, { ...settings, whitelisted_domains: domains });
      }
      
      return domains;
    } catch (error) {
      console.error('Error adding whitelisted domain:', error.message);
      throw error;
    }
  }

  async removeWhitelistedDomain(guildId, domain) {
    try {
      const settings = await this.getModerationsSettings(guildId);
      const domains = (settings.whitelisted_domains || []).filter(d => d !== domain);
      await this.setModerationsSettings(guildId, { ...settings, whitelisted_domains: domains });
      return domains;
    } catch (error) {
      console.error('Error removing whitelisted domain:', error.message);
      throw error;
    }
  }

  // ==================== USER JOIN TRACKING ====================
  async recordUserJoin(userId, guildId) {
    try {
      const result = await this.pool.query(
        `INSERT INTO user_joins (guild_id, user_id, joined_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (guild_id, user_id) DO NOTHING;`,
        [guildId, userId]
      );
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error recording user join:', error.message);
      return false;
    }
  }

  async getUserJoinDate(userId, guildId) {
    try {
      const result = await this.pool.query(
        `SELECT joined_at FROM user_joins 
         WHERE guild_id = $1 AND user_id = $2;`,
        [guildId, userId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].joined_at;
      }
      return null;
    } catch (error) {
      console.error('Error getting user join date:', error.message);
      return null;
    }
  }

  async getUserGuildAge(userId, guildId) {
    try {
      const joinDate = await this.getUserJoinDate(userId, guildId);
      if (!joinDate) return 0;
      
      const ageMs = Date.now() - new Date(joinDate).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays;
    } catch (error) {
      console.error('Error getting user guild age:', error.message);
      return 0;
    }
  }

  // ==================== MESSAGE FLAGS ====================
  async flagMessage(guildId, channelId, messageId, userId, content, score, reason, aiAnalysis = null) {
    try {
      const result = await this.pool.query(
        `INSERT INTO message_flags (guild_id, channel_id, message_id, user_id, content, score, reason, ai_analysis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (guild_id, message_id) DO UPDATE SET
         score = EXCLUDED.score,
         reason = EXCLUDED.reason,
         ai_analysis = EXCLUDED.ai_analysis
         RETURNING *;`,
        [guildId, channelId, messageId, userId, content, score, reason, JSON.stringify(aiAnalysis)]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error flagging message:', error.message);
      throw error;
    }
  }

  async getMessageFlag(guildId, messageId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM message_flags WHERE guild_id = $1 AND message_id = $2;`,
        [guildId, messageId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting message flag:', error.message);
      return null;
    }
  }

  async getPendingFlags(guildId, limit = 20) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM message_flags 
         WHERE guild_id = $1 AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT $2;`,
        [guildId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting pending flags:', error.message);
      return [];
    }
  }

  async updateFlagStatus(guildId, messageId, status, adminId, notes = null) {
    try {
      const result = await this.pool.query(
        `UPDATE message_flags 
         SET status = $1, admin_action_by = $2, admin_action_at = NOW(), reason = COALESCE($3, reason)
         WHERE guild_id = $4 AND message_id = $5
         RETURNING *;`,
        [status, adminId, notes, guildId, messageId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating flag status:', error.message);
      throw error;
    }
  }

  // ==================== MODERATION EVENTS ====================
  async logModerationEvent(guildId, channelId, messageId, userId, actionType, reason, scoreBreakdown = null, aiAnalysis = null, moderatorId = 'AUTO') {
    try {
      const result = await this.pool.query(
        `INSERT INTO moderation_events (guild_id, channel_id, message_id, user_id, action_type, reason, score_breakdown, ai_analysis, moderator_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *;`,
        [guildId, channelId, messageId, userId, actionType, reason, JSON.stringify(scoreBreakdown), JSON.stringify(aiAnalysis), moderatorId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error logging moderation event:', error.message);
      throw error;
    }
  }

  async getModerationEvents(guildId, limit = 100) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM moderation_events 
         WHERE guild_id = $1
         ORDER BY created_at DESC
         LIMIT $2;`,
        [guildId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting moderation events:', error.message);
      return [];
    }
  }

  // ==================== CHANNEL OVERRIDES ====================
  async setChannelOverride(guildId, channelId, overrides) {
    try {
      const result = await this.pool.query(
        `INSERT INTO channel_overrides (guild_id, channel_id, nsfw, sexual, racist, hate, profanity, spam, ai_enabled, ai_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (guild_id, channel_id) DO UPDATE SET
         nsfw = COALESCE(EXCLUDED.nsfw, channel_overrides.nsfw),
         sexual = COALESCE(EXCLUDED.sexual, channel_overrides.sexual),
         racist = COALESCE(EXCLUDED.racist, channel_overrides.racist),
         hate = COALESCE(EXCLUDED.hate, channel_overrides.hate),
         profanity = COALESCE(EXCLUDED.profanity, channel_overrides.profanity),
         spam = COALESCE(EXCLUDED.spam, channel_overrides.spam),
         ai_enabled = COALESCE(EXCLUDED.ai_enabled, channel_overrides.ai_enabled),
         ai_confidence = COALESCE(EXCLUDED.ai_confidence, channel_overrides.ai_confidence),
         updated_at = NOW()
         RETURNING *;`,
        [guildId, channelId, overrides.nsfw, overrides.sexual, overrides.racist, overrides.hate, overrides.profanity, overrides.spam, overrides.ai_enabled, overrides.ai_confidence]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error setting channel override:', error.message);
      throw error;
    }
  }

  async getChannelOverride(guildId, channelId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM channel_overrides WHERE guild_id = $1 AND channel_id = $2;`,
        [guildId, channelId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting channel override:', error.message);
      return null;
    }
  }

  // ==================== ROLE EXCEPTIONS ====================
  async setRoleException(guildId, roleId, exceptions) {
    try {
      const result = await this.pool.query(
        `INSERT INTO role_exceptions (guild_id, role_id, exclude_filters, score_reduction, can_post_links, can_post_invites)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (guild_id, role_id) DO UPDATE SET
         exclude_filters = EXCLUDED.exclude_filters,
         score_reduction = EXCLUDED.score_reduction,
         can_post_links = EXCLUDED.can_post_links,
         can_post_invites = EXCLUDED.can_post_invites
         RETURNING *;`,
        [guildId, roleId, exceptions.exclude_filters, exceptions.score_reduction, exceptions.can_post_links, exceptions.can_post_invites]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error setting role exception:', error.message);
      throw error;
    }
  }

  async getRoleException(guildId, roleId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM role_exceptions WHERE guild_id = $1 AND role_id = $2;`,
        [guildId, roleId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting role exception:', error.message);
      return null;
    }
  }

  // ==================== MODERATION APPEALS ====================
  async createAppeal(guildId, userId, messageId, appealReason) {
    try {
      const result = await this.pool.query(
        `INSERT INTO moderation_appeals (guild_id, user_id, message_id, appeal_reason)
         VALUES ($1, $2, $3, $4)
         RETURNING *;`,
        [guildId, userId, messageId, appealReason]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating appeal:', error.message);
      throw error;
    }
  }

  async getPendingAppeals(guildId, limit = 20) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM moderation_appeals 
         WHERE guild_id = $1 AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT $2;`,
        [guildId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting pending appeals:', error.message);
      return [];
    }
  }

  async reviewAppeal(guildId, appealId, status, reviewerId, notes = null) {
    try {
      const result = await this.pool.query(
        `UPDATE moderation_appeals 
         SET status = $1, reviewed_by = $2, review_notes = $3, reviewed_at = NOW()
         WHERE id = $4 AND guild_id = $5
         RETURNING *;`,
        [status, reviewerId, notes, appealId, guildId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error reviewing appeal:', error.message);
      throw error;
    }
  }

  // ==================== CONFIG BACKUPS ====================
  async backupConfig(guildId, backupName, config, createdBy) {
    try {
      const result = await this.pool.query(
        `INSERT INTO config_backups (guild_id, backup_name, config, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *;`,
        [guildId, backupName, JSON.stringify(config), createdBy]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error backing up config:', error.message);
      throw error;
    }
  }

  async getConfigBackups(guildId, limit = 10) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM config_backups 
         WHERE guild_id = $1
         ORDER BY created_at DESC
         LIMIT $2;`,
        [guildId, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting config backups:', error.message);
      return [];
    }
  }

  async restoreConfig(guildId, backupId) {
    try {
      const backup = await this.pool.query(
        `SELECT config FROM config_backups WHERE id = $1 AND guild_id = $2;`,
        [backupId, guildId]
      );

      if (backup.rows.length === 0) {
        throw new Error('Backup not found');
      }

      const config = backup.rows[0].config;
      await this.setModerationsSettings(guildId, config);
      return config;
    } catch (error) {
      console.error('Error restoring config:', error.message);
      throw error;
    }
  }

  // ==================== SERVER SETTINGS ====================
  async getServerSettings(guildId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM server_settings WHERE guild_id = $1;`,
        [guildId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return {
        guild_id: guildId,
        auto_mod_enabled: true,
        raid_protection_enabled: true,
        log_channel: null,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting server settings:', error.message);
      return {};
    }
  }

  async setServerSettings(guildId, settings) {
    try {
      const result = await this.pool.query(
        `INSERT INTO server_settings (guild_id, auto_mod_enabled, raid_protection_enabled, log_channel)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) DO UPDATE SET
         auto_mod_enabled = EXCLUDED.auto_mod_enabled,
         raid_protection_enabled = EXCLUDED.raid_protection_enabled,
         log_channel = EXCLUDED.log_channel
         RETURNING *;`,
        [
          guildId,
          settings.auto_mod_enabled ?? true,
          settings.raid_protection_enabled ?? true,
          settings.log_channel ?? null,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error setting server settings:', error.message);
      throw error;
    }
  }

  // ==================== USER STATS ====================
  async getUserStats(userId, guildId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM user_stats 
         WHERE user_id = $1 AND guild_id = $2;`,
        [userId, guildId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      return {
        user_id: userId,
        guild_id: guildId,
        message_count: 0,
        unique_messages: 0,
        warning_count: 0,
        mute_count: 0,
        kick_count: 0,
        ban_count: 0,
        last_message: null,
      };
    } catch (error) {
      console.error('Error getting user stats:', error.message);
      return {};
    }
  }

  async updateUserStats(userId, guildId, stats) {
    try {
      const result = await this.pool.query(
        `INSERT INTO user_stats (user_id, guild_id, message_count, unique_messages, warning_count, mute_count, kick_count, ban_count, last_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, guild_id) DO UPDATE SET
         message_count = EXCLUDED.message_count,
         unique_messages = EXCLUDED.unique_messages,
         warning_count = EXCLUDED.warning_count,
         mute_count = EXCLUDED.mute_count,
         kick_count = EXCLUDED.kick_count,
         ban_count = EXCLUDED.ban_count,
         last_message = EXCLUDED.last_message
         RETURNING *;`,
        [
          userId,
          guildId,
          stats.message_count ?? 0,
          stats.unique_messages ?? 0,
          stats.warning_count ?? 0,
          stats.mute_count ?? 0,
          stats.kick_count ?? 0,
          stats.ban_count ?? 0,
          stats.last_message ?? null,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating user stats:', error.message);
      throw error;
    }
  }

  async incrementMessageCount(userId, guildId) {
    try {
      const stats = await this.getUserStats(userId, guildId);
      await this.updateUserStats(userId, guildId, {
        message_count: (stats.message_count || 0) + 1,
        unique_messages: (stats.unique_messages || 0) + 1,
        last_message: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error incrementing message count:', error.message);
    }
  }

  // ==================== WELCOME MESSAGES ====================
  async hasWelcomeMessageSent(guildId) {
    try {
      const result = await this.pool.query(
        'SELECT id FROM welcome_messages WHERE guild_id = $1',
        [guildId]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking welcome message:', error.message);
      return false;
    }
  }

  async recordWelcomeMessage(guildId, messageId) {
    try {
      await this.pool.query(
        'INSERT INTO welcome_messages (guild_id, message_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET message_id = $2, sent_at = NOW()',
        [guildId, messageId]
      );
      return true;
    } catch (error) {
      console.error('Error recording welcome message:', error.message);
      return false;
    }
  }

  // ==================== STATISTICS ====================
  async getModerationStats(guildId, days = 7) {
    try {
      const result = await this.pool.query(
        `SELECT 
          action_type,
          COUNT(*) as count
         FROM moderation_events
         WHERE guild_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
         GROUP BY action_type
         ORDER BY count DESC;`,
        [guildId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting moderation stats:', error.message);
      return [];
    }
  }

  // ==================== CLEANUP ====================
  async deleteExpiredFlags(daysOld = 90) {
    try {
      const result = await this.pool.query(
        `DELETE FROM message_flags 
         WHERE status IN ('approved', 'deleted')
         AND created_at < NOW() - INTERVAL '${daysOld} days';`
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error deleting expired flags:', error.message);
      return 0;
    }
  }

  // ==================== MESSAGE CONTEXT ====================
  async storeContext(guildId, flagId, before, flagged, after) {
    try {
      const result = await this.pool.query(
        `INSERT INTO message_context (guild_id, flag_id, before_messages, flagged_message, after_messages)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id, flag_id) DO UPDATE SET 
         before_messages = EXCLUDED.before_messages,
         flagged_message = EXCLUDED.flagged_message,
         after_messages = EXCLUDED.after_messages,
         created_at = NOW()
         RETURNING *;`,
        [guildId, flagId, JSON.stringify(before), JSON.stringify(flagged), JSON.stringify(after)]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error storing context:', error.message);
      throw error;
    }
  }

  async getContext(guildId, flagId) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM message_context WHERE guild_id = $1 AND flag_id = $2;`,
        [guildId, flagId]
      );
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        before: JSON.parse(row.before_messages || '[]'),
        flagged: JSON.parse(row.flagged_message || '{}'),
        after: JSON.parse(row.after_messages || '[]'),
        created_at: row.created_at
      };
    } catch (error) {
      console.error('Error getting context:', error.message);
      throw error;
    }
  }

  async deleteExpiredContext(daysOld = 7) {
    try {
      const result = await this.pool.query(
        `DELETE FROM message_context WHERE created_at < NOW() - INTERVAL '${daysOld} days' RETURNING id;`
      );
      
      if (result.rows.length > 0) {
        console.log(`🗑️ Deleted ${result.rows.length} expired context records`);
      }
      
      return result.rows.length;
    } catch (error) {
      console.error('Error deleting expired context:', error.message);
      throw error;
    }
  }

  async close() {
    try {
      await this.pool.end();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error.message);
    }
  }
}

// Create singleton instance
const db = new EnhancedDatabaseService(process.env.DATABASE_URL);

module.exports = db;
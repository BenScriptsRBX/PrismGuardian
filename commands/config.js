// commands/config.js - PrismGuard Configuration Command
// Complete implementation with channel/role overrides and approval system

const db = require('../db');

module.exports = {
  name: 'config',
  aliases: ['cfg', 'settings', 'filters', 'mod'],
  description: 'Configure PrismGuard moderation system',
  execute: async ({ api, message, args, prefix }) => {
    // Permission check: only server owner
    try {
      const guild = await api.guilds.get(message.guild_id);
      if (message.author.id !== guild.owner_id) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ Only the server owner can use this command',
          message_reference: { message_id: message.id },
        });
        return;
      }
    } catch (error) {
      await api.channels.createMessage(message.channel_id, {
        content: '❌ Error: Could not verify permissions',
        message_reference: { message_id: message.id },
      });
      return;
    }

    const subcommand = args[0]?.toLowerCase();

    // ==================== VIEW/SHOW ====================
    if (!subcommand || subcommand === 'view' || subcommand === 'show') {
      try {
        const settings = await db.getModerationsSettings(message.guild_id);
        const embed = buildFiltersEmbed(settings);
        
        await api.channels.createMessage(message.channel_id, {
          embeds: [embed],
        });
        return;
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ Error loading settings',
          message_reference: { message_id: message.id },
        });
        return;
      }
    }

    // ==================== FILTER MANAGEMENT ====================
    if (subcommand === 'set' || subcommand === 'filter') {
      await handleFilterSet(api, message, args, prefix, db);
      return;
    }

    // ==================== KEYWORD MANAGEMENT ====================
    if (subcommand === 'keyword') {
      await handleKeywordManagement(api, message, args, prefix, db);
      return;
    }

    // ==================== WHITELIST MANAGEMENT ====================
    if (subcommand === 'whitelist') {
      await handleWhitelistManagement(api, message, args, prefix, db);
      return;
    }

    // ==================== SPAM CONFIGURATION ====================
    if (subcommand === 'spam') {
      await handleSpamConfig(api, message, args, prefix, db);
      return;
    }

    // ==================== AI CONFIGURATION ====================
    if (subcommand === 'ai') {
      await handleAIConfig(api, message, args, prefix, db);
      return;
    }

    // ==================== RAID PROTECTION ====================
    if (subcommand === 'raid') {
      await handleRaidConfig(api, message, args, prefix, db);
      return;
    }

    // ==================== CHANNEL OVERRIDES ====================
    if (subcommand === 'channel') {
      await handleChannelConfig(api, message, args, prefix, db);
      return;
    }

    // ==================== ROLE OVERRIDES ====================
    if (subcommand === 'role') {
      await handleRoleConfig(api, message, args, prefix, db);
      return;
    }

    // ==================== LOG CHANNEL ====================
    if (subcommand === 'logs' || subcommand === 'logchannel') {
      await handleLogChannel(api, message, args, prefix, db);
      return;
    }

    // ==================== APPROVAL MODE ====================
    if (subcommand === 'approval') {
      await handleApprovalMode(api, message, args, prefix, db);
      return;
    }

    // ==================== SIMULATION MODE ====================
    if (subcommand === 'simulate' || subcommand === 'test') {
      await handleSimulation(api, message, args, prefix, db);
      return;
    }

    // ==================== STATISTICS ====================
    if (subcommand === 'stats') {
      await handleStats(api, message, args, prefix, db);
      return;
    }

    // ==================== BACKUP/RESTORE ====================
    if (subcommand === 'backup') {
      await handleBackup(api, message, args, prefix, db);
      return;
    }

    if (subcommand === 'restore') {
      await handleRestore(api, message, args, prefix, db);
      return;
    }

    // ==================== HELP ====================
    if (subcommand === 'help') {
      const helpEmbed = buildHelpEmbed(prefix);
      await api.channels.createMessage(message.channel_id, {
        embeds: [helpEmbed],
      });
      return;
    }

    // Invalid subcommand
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Unknown subcommand: \`${subcommand}\`\n\nUse \`${prefix}config help\` for all available commands.`,
      message_reference: { message_id: message.id },
    });
  },
};

// ==================== HANDLER FUNCTIONS ====================

async function handleFilterSet(api, message, args, prefix, db) {
  const filter = args[1]?.toLowerCase().replace(/-/g, '_');
  const action = args[2]?.toLowerCase();

  if (!filter || !action) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config set <filter> <allow|block>\`\n\n**Available filters:**\nnsfw, sexual, racist, hate-speech (or hate), profanity, spam\n\n**Examples:**\n\`${prefix}config set hate-speech block\`\n\`${prefix}config set profanity allow\``,
      message_reference: { message_id: message.id },
    });
    return;
  }

  const filterMap = {
    'nsfw': 'nsfw',
    'sexual': 'sexual',
    'racist': 'racist',
    'hate': 'hate',
    'hate_speech': 'hate',
    'profanity': 'profanity',
    'spam': 'spam'
  };

  const mappedFilter = filterMap[filter];

  if (!mappedFilter) {
    const validFilters = Object.keys(filterMap).filter(f => !f.includes('_')).join(', ');
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Invalid filter: \`${filter}\`\nValid filters: ${validFilters}`,
      message_reference: { message_id: message.id },
    });
    return;
  }

  const validActions = ['allow', 'block'];

  if (!validActions.includes(action)) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Invalid action: \`${action}\`\nValid actions: allow, block`,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    const settings = await db.getModerationsSettings(message.guild_id);
    settings[mappedFilter] = action === 'block';
    await db.setModerationsSettings(message.guild_id, settings);

    const embed = buildFiltersEmbed(settings);
    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });

    console.log(`⚙️ ${message.author.username} set ${mappedFilter} to ${action}`);
  } catch (error) {
    console.error('Error setting filter:', error.message);
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleKeywordManagement(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();

  if (!action) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config keyword <add|remove|view> [word]\``,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    if (action === 'add') {
      const word = args.slice(2).join(' ').toLowerCase();
      if (!word) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Please provide a keyword to add`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      const keywords = await db.addKeyword(message.guild_id, word);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Keyword added!\n\`\`\`\n${keywords.join(', ')}\n\`\`\``,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'remove') {
      const word = args.slice(2).join(' ').toLowerCase();
      if (!word) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Please provide a keyword to remove`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      const keywords = await db.removeKeyword(message.guild_id, word);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Keyword removed!\n\`\`\`\n${keywords.join(', ') || 'None'}\n\`\`\``,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'view') {
      const keywords = await db.getKeywords(message.guild_id);
      const embed = {
        title: '📋 Custom Keywords',
        description: keywords.length > 0 ? `\`\`\`\n${keywords.join('\n')}\n\`\`\`` : 'No custom keywords added',
        color: 3066993,
        timestamp: new Date().toISOString(),
      };

      await api.channels.createMessage(message.channel_id, {
        embeds: [embed],
      });
    }
  } catch (error) {
    console.error('Error managing keywords:', error.message);
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleWhitelistManagement(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();

  if (!action) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config whitelist <add|remove|view> [domain]\``,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    if (action === 'add') {
      const domain = args.slice(2).join(' ').toLowerCase();
      if (!domain) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Please provide a domain to whitelist`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      const domains = await db.addWhitelistedDomain(message.guild_id, domain);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Domain whitelisted!\n\`\`\`\n${domains.join('\n')}\n\`\`\``,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'remove') {
      const domain = args.slice(2).join(' ').toLowerCase();
      if (!domain) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Please provide a domain to remove`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      const domains = await db.removeWhitelistedDomain(message.guild_id, domain);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Domain removed!\n\`\`\`\n${domains.join('\n') || 'None'}\n\`\`\``,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'view') {
      const settings = await db.getModerationsSettings(message.guild_id);
      const domains = settings.whitelisted_domains || [];
      const embed = {
        title: '🔗 Whitelisted Domains',
        description: domains.length > 0 ? `\`\`\`\n${domains.join('\n')}\n\`\`\`` : 'No domains whitelisted',
        color: 3066993,
        timestamp: new Date().toISOString(),
      };

      await api.channels.createMessage(message.channel_id, {
        embeds: [embed],
      });
    }
  } catch (error) {
    console.error('Error managing whitelist:', error.message);
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleSpamConfig(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();

  if (!action) {
    const settings = await db.getModerationsSettings(message.guild_id);
    const embed = {
      title: '🚫 Spam Configuration',
      description: `**Threshold:** ${settings.spam_threshold} messages per ${settings.spam_window}s\n**Mention Limit:** ${settings.mention_threshold} mentions`,
      color: 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
    return;
  }

  if (action === 'threshold') {
    const value = parseInt(args[2]);
    if (isNaN(value)) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Invalid number: \`${args[2]}\``,
        message_reference: { message_id: message.id },
      });
      return;
    }

    try {
      const settings = await db.getModerationsSettings(message.guild_id);
      settings.spam_threshold = value;
      await db.setModerationsSettings(message.guild_id, settings);

      await api.channels.createMessage(message.channel_id, {
        content: `✅ Spam threshold set to \`${value}\` messages per \`${settings.spam_window}\`s`,
        message_reference: { message_id: message.id },
      });
    } catch (error) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  }
}

async function handleAIConfig(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();

  if (!action) {
    const settings = await db.getModerationsSettings(message.guild_id);
    const embed = {
      title: '🤖 AI Configuration',
      description: `**Enabled:** ${settings.ai_enabled ? '✅ Yes' : '❌ No'}\n**New Users Only:** ${settings.ai_new_users_only ? '✅ Yes' : '❌ No'}\n**New User Threshold:** ${settings.ai_new_user_threshold} days\n**Approval Mode:** ${settings.ai_approval_mode ? '✅ Yes (logs only, no punishment)' : '❌ No (instant punishment)'}\n**Context Capture:** ${settings.context_enabled ? '✅ Yes' : '❌ No'}\n**Confidence Threshold:** ${(settings.ai_confidence * 100).toFixed(0)}%\n**Service:** ${settings.ai_service}`,
      color: 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
    return;
  }

  try {
    const settings = await db.getModerationsSettings(message.guild_id);

    if (action === 'enable') {
      settings.ai_enabled = true;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ AI moderation enabled`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'disable') {
      settings.ai_enabled = false;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ AI moderation disabled`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'approval') {
      const mode = args[2]?.toLowerCase();
      if (mode === 'on' || mode === 'enable') {
        settings.ai_approval_mode = true;
        await db.setModerationsSettings(message.guild_id, settings);
        await api.channels.createMessage(message.channel_id, {
          content: `✅ Approval mode enabled! AI violations will be logged with no punishment. Admins can use \`!approve\` to manage them.`,
          message_reference: { message_id: message.id },
        });
      } else if (mode === 'off' || mode === 'disable') {
        settings.ai_approval_mode = false;
        await db.setModerationsSettings(message.guild_id, settings);
        await api.channels.createMessage(message.channel_id, {
          content: `✅ Approval mode disabled. AI will apply instant punishment.`,
          message_reference: { message_id: message.id },
        });
      } else {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Usage: \`${prefix}config ai approval <on|off>\``,
          message_reference: { message_id: message.id },
        });
      }
    } else if (action === 'context') {
      const mode = args[2]?.toLowerCase();
      if (mode === 'on' || mode === 'enable') {
        settings.context_enabled = true;
        await db.setModerationsSettings(message.guild_id, settings);
        await api.channels.createMessage(message.channel_id, {
          content: `✅ Context capture enabled! Use \`!context <id>\` to view message context.`,
          message_reference: { message_id: message.id },
        });
      } else if (mode === 'off' || mode === 'disable') {
        settings.context_enabled = false;
        await db.setModerationsSettings(message.guild_id, settings);
        await api.channels.createMessage(message.channel_id, {
          content: `✅ Context capture disabled.`,
          message_reference: { message_id: message.id },
        });
      } else {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Usage: \`${prefix}config ai context <on|off>\``,
          message_reference: { message_id: message.id },
        });
      }
    } else if (action === 'threshold') {
      const value = parseInt(args[2]);
      if (isNaN(value) || value < 0) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Threshold must be a positive number (days)`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      settings.ai_new_user_threshold = value;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ AI new user threshold set to ${value} days. (0 = analyze forever)`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'confidence') {
      const value = parseFloat(args[2]);
      if (isNaN(value) || value < 0 || value > 1) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Confidence must be between 0 and 1 (e.g., 0.85)`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      settings.ai_confidence = value;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ AI confidence threshold set to ${(value * 100).toFixed(0)}%`,
        message_reference: { message_id: message.id },
      });
    }
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleRaidConfig(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();

  if (!action) {
    const settings = await db.getModerationsSettings(message.guild_id);
    const embed = {
      title: '🛡️ Raid Protection',
      description: `**Enabled:** ${settings.raid_protection_enabled ? '✅ Yes' : '❌ No'}\n**Threshold:** ${settings.raid_join_threshold} users per ${settings.raid_join_window}s`,
      color: 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
    return;
  }

  try {
    const settings = await db.getModerationsSettings(message.guild_id);

    if (action === 'enable') {
      settings.raid_protection_enabled = true;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Raid protection enabled`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'disable') {
      settings.raid_protection_enabled = false;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Raid protection disabled`,
        message_reference: { message_id: message.id },
      });
    }
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleChannelConfig(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();
  const channelId = args[2];

  if (!action || !channelId) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config channel <disable-ai|enable-ai|view> [channel_id]\`\n\n**disable-ai:** Disable AI in this channel\n**enable-ai:** Enable AI in this channel`,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    if (action === 'disable-ai') {
      await db.setChannelOverride(message.guild_id, channelId, {
        ai_enabled: false
      });
      await api.channels.createMessage(message.channel_id, {
        content: `✅ <#${channelId}> AI disabled`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'enable-ai') {
      await db.setChannelOverride(message.guild_id, channelId, {
        ai_enabled: true
      });
      await api.channels.createMessage(message.channel_id, {
        content: `✅ <#${channelId}> AI enabled`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'view') {
      const override = await db.getChannelOverride(message.guild_id, channelId);
      const description = override 
        ? `**AI Status:** ${override.ai_enabled ? '✅ Enabled' : '❌ Disabled'}`
        : '❌ No overrides set';
      
      await api.channels.createMessage(message.channel_id, {
        embeds: [{
          title: `Channel Override: <#${channelId}>`,
          description,
          color: 3066993,
          timestamp: new Date().toISOString()
        }]
      });
    }
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleRoleConfig(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();
  const roleId = args[2];

  if (!action || !roleId) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config role <exempt|view> [role_id]\`\n\n**exempt:** Role members bypass all filters`,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    if (action === 'exempt') {
      await db.setRoleException(message.guild_id, roleId, {
        exclude_filters: true,
        score_reduction: 0,
        can_post_links: true,
        can_post_invites: true
      });
      await api.channels.createMessage(message.channel_id, {
        content: `✅ <@&${roleId}> is now exempt from all filters`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'view') {
      const exception = await db.getRoleException(message.guild_id, roleId);
      const description = exception 
        ? `Exempt: ${exception.exclude_filters ? '✅' : '❌'}`
        : 'No exceptions set';
      
      await api.channels.createMessage(message.channel_id, {
        embeds: [{
          title: `Role Exception: <@&${roleId}>`,
          description,
          color: 3066993,
          timestamp: new Date().toISOString()
        }]
      });
    }
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleLogChannel(api, message, args, prefix, db) {
  const channelId = args[1];
  if (!channelId) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config logs <channel_id>\``,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    const settings = await db.getModerationsSettings(message.guild_id);
    settings.log_channel = channelId;
    await db.setModerationsSettings(message.guild_id, settings);

    const embed = {
      title: '✅ Moderation Logs Configured',
      description: `Logs will be sent to <#${channelId}>`,
      color: 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleApprovalMode(api, message, args, prefix, db) {
  const action = args[1]?.toLowerCase();

  if (!action) {
    const settings = await db.getModerationsSettings(message.guild_id);
    const embed = {
      title: '🔍 Approval Mode',
      description: `**Status:** ${settings.ai_approval_mode ? '✅ Enabled' : '❌ Disabled'}\n\nWhen enabled, AI violations are logged with no punishment. Admins use \`!approve\` or \`!a\` to review.`,
      color: 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
    return;
  }

  try {
    const settings = await db.getModerationsSettings(message.guild_id);

    if (action === 'on' || action === 'enable') {
      settings.ai_approval_mode = true;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Approval mode enabled!`,
        message_reference: { message_id: message.id },
      });
    } else if (action === 'off' || action === 'disable') {
      settings.ai_approval_mode = false;
      await db.setModerationsSettings(message.guild_id, settings);
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Approval mode disabled!`,
        message_reference: { message_id: message.id },
      });
    }
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleSimulation(api, message, args, prefix, db) {
  const testMessage = args.slice(1).join(' ');
  if (!testMessage) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Usage: \`${prefix}config simulate <message text>\``,
      message_reference: { message_id: message.id },
    });
    return;
  }

  try {
    const settings = await db.getModerationsSettings(message.guild_id);
    const { score, breakdown } = calculateReputationScore(testMessage, settings, { user: message.author, createdTimestamp: Date.now() });

    const actionLevel = getActionLevel(score, settings);

    const embed = {
      title: '🔍 Simulation Results',
      description: `**Message:** "${testMessage}"\n\n**Score Breakdown:**\n${breakdown.map(b => `• ${b.reason}: +${b.points}`).join('\n')}\n\n**Total Score:** ${score}\n**Action Level:** ${actionLevel}`,
      color: score >= 10 ? 15158332 : 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleStats(api, message, args, prefix, db) {
  try {
    const stats = await db.getModerationStats(message.guild_id, 7);

    let description = '**Past 7 Days:**\n\n';
    if (stats.length === 0) {
      description += 'No moderation actions taken';
    } else {
      const total = stats.reduce((sum, s) => sum + s.count, 0);
      stats.forEach(stat => {
        const percentage = ((stat.count / total) * 100).toFixed(1);
        description += `• **${stat.action_type}:** ${stat.count} (${percentage}%)\n`;
      });
      description += `\n**Total Actions:** ${total}`;
    }

    const embed = {
      title: '📊 Moderation Statistics',
      description,
      color: 3066993,
      timestamp: new Date().toISOString(),
    };

    await api.channels.createMessage(message.channel_id, {
      embeds: [embed],
    });
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleBackup(api, message, args, prefix, db) {
  try {
    const settings = await db.getModerationsSettings(message.guild_id);
    const backupName = `backup_${new Date().toISOString().slice(0, 10)}`;
    
    await db.backupConfig(message.guild_id, backupName, settings, message.author.id);

    await api.channels.createMessage(message.channel_id, {
      content: `✅ Configuration backed up as \`${backupName}\``,
      message_reference: { message_id: message.id },
    });
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

async function handleRestore(api, message, args, prefix, db) {
  if (!args[1]) {
    const backups = await db.getConfigBackups(message.guild_id, 5);
    if (backups.length === 0) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ No backups found`,
        message_reference: { message_id: message.id },
      });
      return;
    }

    const description = backups.map(b => `• **${b.backup_name}** (ID: ${b.id}) - ${new Date(b.created_at).toLocaleDateString()}`).join('\n');
    
    await api.channels.createMessage(message.channel_id, {
      embeds: [{
        title: '📦 Available Backups',
        description: description + `\n\nRestore with: \`${prefix}config restore <id>\``,
        color: 3066993,
        timestamp: new Date().toISOString(),
      }],
    });
    return;
  }

  try {
    const backupId = parseInt(args[1]);
    await db.restoreConfig(message.guild_id, backupId);

    await api.channels.createMessage(message.channel_id, {
      content: `✅ Configuration restored from backup #${backupId}`,
      message_reference: { message_id: message.id },
    });
  } catch (error) {
    await api.channels.createMessage(message.channel_id, {
      content: `❌ Error: ${error.message}`,
      message_reference: { message_id: message.id },
    });
  }
}

// ==================== HELPER FUNCTIONS ====================

function buildFiltersEmbed(settings) {
  const blocked = '🚫 BLOCKED';
  const allowed = '✅ ALLOWED';

  const description = `**18+ NSFW:** ${settings.nsfw ? blocked : allowed}
**Sexual Content:** ${settings.sexual ? blocked : allowed}
**Racist Content:** ${settings.racist ? blocked : allowed}

**Hate Speech:** ${settings.hate ? blocked : allowed}
**Profanity:** ${settings.profanity ? blocked : allowed}

**Spam:** ${settings.spam ? blocked : allowed}

━━━━━━━━━━━━━━━━━━━━
**Scoring Thresholds:**
• Delete: ${settings.delete_threshold}
• Timeout: ${settings.timeout_threshold}
• Ban: ${settings.ban_threshold}

**AI Settings:**
• Enabled: ${settings.ai_enabled ? '✅' : '❌'}
• Approval Mode: ${settings.ai_approval_mode ? '✅' : '❌'}
• New User Threshold: ${settings.ai_new_user_threshold} days`;

  return {
    title: '✅ Filters Configured',
    description: description,
    color: 3066993,
    footer: {
      text: 'PrismGuard moderation system | Use !config help for more options'
    },
    timestamp: new Date().toISOString(),
  };
}

function buildHelpEmbed(prefix) {
  return {
    title: '📚 PrismGuard Configuration Help',
    description: `**Basic Commands:**
\`${prefix}config view\` - Show current filters
\`${prefix}config set <filter> <allow|block>\` - Set filter
\`${prefix}config logs <channel_id>\` - Set log channel

**AI Configuration:**
\`${prefix}config ai enable\` - Enable AI
\`${prefix}config ai approval on\` - Enable approval mode (logs only)
\`${prefix}config ai threshold <days>\` - Set new user threshold
\`${prefix}config ai confidence <0-1>\` - Set confidence threshold

**Channel/Role Overrides:**
\`${prefix}config channel ai-only <channel_id>\` - AI only
\`${prefix}config channel no-ai <channel_id>\` - No AI
\`${prefix}config role exempt <role_id>\` - Exempt role

**Keyword Management:**
\`${prefix}config keyword add <word>\` - Add keyword
\`${prefix}config keyword remove <word>\` - Remove keyword
\`${prefix}config keyword view\` - List keywords

**Advanced:**
\`${prefix}config simulate <message>\` - Test message
\`${prefix}config stats\` - Show statistics
\`${prefix}config backup\` - Backup settings
\`${prefix}config restore\` - List backups`,
    color: 3066993,
    timestamp: new Date().toISOString(),
  };
}

function calculateReputationScore(messageContent, settings, user) {
  let score = 0;
  const breakdown = [];

  const matchedKeywords = (settings.keywords || []).filter(k => messageContent.toLowerCase().includes(k));
  if (matchedKeywords.length > 0) {
    const points = matchedKeywords.length * 3;
    score += points;
    breakdown.push({ reason: `Keyword match (${matchedKeywords.length})`, points });
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = messageContent.match(urlRegex) || [];
  for (const link of links) {
    const isWhitelisted = (settings.whitelisted_domains || []).some(d => link.includes(d));
    if (!isWhitelisted) {
      score += 3;
      breakdown.push({ reason: `Suspicious link: ${link.substring(0, 30)}...`, points: 3 });
    }
  }

  const mentionCount = (messageContent.match(/<@!?\d+>/g) || []).length;
  if (mentionCount >= settings.mention_threshold) {
    score += 3;
    breakdown.push({ reason: `Mass mentions (${mentionCount})`, points: 3 });
  }

  if (messageContent.includes('discord.gg') || messageContent.includes('discord.com/invite')) {
    score += 4;
    breakdown.push({ reason: 'Discord invite detected', points: 4 });
  }

  return { score, breakdown };
}

function getActionLevel(score, settings) {
  if (score >= settings.ban_threshold) return '🔴 Ban';
  if (score >= settings.timeout_threshold) return '🟠 Timeout';
  if (score >= settings.delete_threshold) return '🟡 Delete';
  return '✅ Allow';
}
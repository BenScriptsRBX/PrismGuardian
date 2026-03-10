// commands/mute.js - Mute a user

const db = require('../db');

module.exports = {
  name: 'mute',
  aliases: ['m', 'timeout'],
  description: 'Mute a user for a specified duration',
  execute: async ({ api, message, args, prefix }) => {
    // Check if user has permission
    if (!await isModeratorOrOwner(api, message)) {
      await api.channels.createMessage(message.channel_id, {
        content: '❌ You don\'t have permission to use this command',
        message_reference: { message_id: message.id },
      });
      return;
    }

    // Parse user mention or ID
    const userIdMatch = args[0]?.match(/\d+/) || args[0];
    if (!userIdMatch) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Usage: \`${prefix}mute <@user> <duration> <reason>\`\nExample: \`${prefix}mute @user 1h spam\`\n\nDurations: 10m, 1h, 1d, 7d`,
        message_reference: { message_id: message.id },
      });
      return;
    }

    const targetUserId = userIdMatch.toString();
    const durationStr = args[1]?.toLowerCase() || '10m';
    const reason = args.slice(2).join(' ') || 'No reason provided';

    // Prevent muting self
    if (targetUserId === message.author.id) {
      await api.channels.createMessage(message.channel_id, {
        content: '❌ You cannot mute yourself',
        message_reference: { message_id: message.id },
      });
      return;
    }

    // Parse duration
    const durationMs = parseDuration(durationStr);
    if (durationMs === null) {
      await api.channels.createMessage(message.channel_id, {
        content: '❌ Invalid duration. Use: 10m, 1h, 1d, 7d',
        message_reference: { message_id: message.id },
      });
      return;
    }

    try {
      // Get user info
      const user = await api.users.get(targetUserId).catch(() => null);
      if (!user) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ User not found',
          message_reference: { message_id: message.id },
        });
        return;
      }

      // Prevent muting bots
      if (user.bot) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ You cannot mute bots',
          message_reference: { message_id: message.id },
        });
        return;
      }

      // Format duration for display
      const durationDisplay = formatDuration(durationMs);

      // Add infraction
      await db.addInfraction(targetUserId, message.guild_id, 'mute', `Muted for ${durationDisplay}: ${reason}`, message.author.id);
      const infractions = await db.getUserInfractions(targetUserId, message.guild_id);

      // Send mute message in channel
      await api.channels.createMessage(message.channel_id, {
        content: `🔇 **${user.username}** has been muted for ${durationDisplay}\n**Reason:** ${reason}\n**Total violations:** ${infractions.length}`,
      });

      // Send DM to muted user
      try {
        const dmChannel = await api.users.createDM(targetUserId);
        await api.channels.createMessage(dmChannel.id, {
          content: `🔇 You have been muted in **${message.guild_id}** for ${durationDisplay}\n\n**Reason:** ${reason}\n**Total violations:** ${infractions.length}\n\nYou will be able to send messages again after the mute expires.`,
        });
      } catch (e) {
        // DM failed
      }

      // Try to mute in guild (if API supports member updates)
      try {
        await api.guilds.editMember(message.guild_id, targetUserId, {
          communication_disabled_until: new Date(Date.now() + durationMs).toISOString(),
        });
        console.log(`🔇 ${user.username} muted by ${message.author.username} for ${durationDisplay}: ${reason}`);
      } catch (e) {
        console.warn(`⚠️  Could not mute ${user.username} (may require higher permissions)`);
        await api.channels.createMessage(message.channel_id, {
          content: `⚠️  Note: Could not apply timeout (may require higher permissions)`,
        });
      }

      // Auto-unmute after duration (in-memory, will reset on bot restart)
      setTimeout(async () => {
        try {
          await api.guilds.editMember(message.guild_id, targetUserId, {
            communication_disabled_until: null,
          });
          console.log(`✅ ${user.username}'s mute expired`);
        } catch (e) {
          // Unmute failed
        }
      }, durationMs);

    } catch (error) {
      console.error('Error muting user:', error.message);
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error muting user: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};

// Parse duration string (e.g., "10m", "1h", "1d")
function parseDuration(str) {
  const match = str.match(/(\d+)([mhd])/);
  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// Format milliseconds to readable duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Helper function
async function isModeratorOrOwner(api, message) {
  try {
    const guild = await api.guilds.get(message.guild_id).catch(() => null);
    if (!guild) return false;
    return message.author.id === guild.owner_id;
  } catch (error) {
    return false;
  }
}
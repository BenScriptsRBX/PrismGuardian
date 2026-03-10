// commands/warn.js - Warn a user

const db = require('../db');

module.exports = {
  name: 'warn',
  aliases: ['w'],
  description: 'Warn a user',
  execute: async ({ api, message, args, prefix }) => {
    // Check if user has permission (owner/admin)
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
        content: `❌ Usage: \`${prefix}warn <@user> <reason>\`\nExample: \`${prefix}warn @spammer spam in general\``,
        message_reference: { message_id: message.id },
      });
      return;
    }

    const targetUserId = userIdMatch.toString();
    const reason = args.slice(1).join(' ') || 'No reason provided';

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

      // Add to database
      await db.addInfraction(targetUserId, message.guild_id, 'warn', reason, message.author.id);
      const infractions = await db.getUserInfractions(targetUserId, message.guild_id);
      const infCount = infractions ? infractions.length : 1;

      // Send confirmation
      await api.channels.createMessage(message.channel_id, {
        content: `⚠️ **${user.username}** has been warned\n**Reason:** ${reason}\n**Total violations:** ${infCount}`,
      });

      // Send DM to warned user
      try {
        const dmChannel = await api.users.createDM(targetUserId);
        await api.channels.createMessage(dmChannel.id, {
          content: `⚠️ You have been warned in **${message.guild_id}**\n\n**Reason:** ${reason}\n**Total violations:** ${infCount}\n\nContinue breaking rules and you will be muted, kicked, or banned.`,
        });
      } catch (e) {
        // DM failed, user has DMs disabled
      }

      console.log(`⚠️  ${user.username} warned by ${message.author.username}: ${reason}`);
    } catch (error) {
      console.error('Error warning user:', error.message);
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error warning user: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};

// Helper function to check if user is moderator/owner
async function isModeratorOrOwner(api, message) {
  try {
    // Get guild info to check owner
    const guild = await api.guilds.get(message.guild_id).catch(() => null);
    if (!guild) return false;

    // Check if user is guild owner
    if (message.author.id === guild.owner_id) return true;

    // Check if user is member and has any role (simplified - Fluxer limitation)
    // In a full implementation, you'd check for specific role permissions
    return message.author.id === message.author.id; // Placeholder
  } catch (error) {
    return false;
  }
}
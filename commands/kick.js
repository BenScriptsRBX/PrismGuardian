// commands/kick.js - Kick a user from the server

const db = require('../db');

module.exports = {
  name: 'kick',
  aliases: ['k'],
  description: 'Kick a user from the server',
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
        content: `❌ Usage: \`${prefix}kick <@user> <reason>\`\nExample: \`${prefix}kick @user spamming\``,
        message_reference: { message_id: message.id },
      });
      return;
    }

    const targetUserId = userIdMatch.toString();
    const reason = args.slice(1).join(' ') || 'No reason provided';

    // Prevent kicking self
    if (targetUserId === message.author.id) {
      await api.channels.createMessage(message.channel_id, {
        content: '❌ You cannot kick yourself',
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

      // Prevent kicking bots
      if (user.bot) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ You cannot kick bots',
          message_reference: { message_id: message.id },
        });
        return;
      }

      // Add infraction
      await db.addInfraction(targetUserId, message.guild_id, 'kick', reason, message.author.id);
      const infractions = await db.getUserInfractions(targetUserId, message.guild_id);

      // Send kick message in channel
      await api.channels.createMessage(message.channel_id, {
        content: `👢 **${user.username}** has been kicked\n**Reason:** ${reason}\n**Total violations:** ${infractions.length}`,
      });

      // Send DM to kicked user
      try {
        const dmChannel = await api.users.createDM(targetUserId);
        await api.channels.createMessage(dmChannel.id, {
          content: `👢 You have been kicked from **${message.guild_id}**\n\n**Reason:** ${reason}\n**Total violations:** ${infractions.length}\n\nYou can rejoin the server, but please follow the rules next time.`,
        });
      } catch (e) {
        // DM failed
      }

      // Kick from guild (if API supports it)
      try {
        await api.guilds.removeMember(message.guild_id, targetUserId);
        console.log(`👢 ${user.username} kicked by ${message.author.username}: ${reason}`);
      } catch (e) {
        console.warn(`⚠️  Could not kick ${user.username} from guild (may require higher permissions)`);
        await api.channels.createMessage(message.channel_id, {
          content: `⚠️  Note: Could not remove user from guild (may require higher permissions)`,
        });
      }
    } catch (error) {
      console.error('Error kicking user:', error.message);
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error kicking user: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};

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
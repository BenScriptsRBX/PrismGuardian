// commands/clearinf.js - Clear user infractions (owner only)

const db = require('../db');

module.exports = {
  name: 'clearinf',
  aliases: ['clrinf', 'clearviolations'],
  description: 'Clear a user\'s infractions (Owner only)',
  execute: async ({ api, message, args, prefix }) => {
    // Check if user is guild owner
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

    // Parse user mention or ID
    const userIdMatch = args[0]?.match(/\d+/) || args[0];
    if (!userIdMatch) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Usage: \`${prefix}clearinf <@user>\`\nExample: \`${prefix}clearinf @user\``,
        message_reference: { message_id: message.id },
      });
      return;
    }

    const targetUserId = userIdMatch.toString();

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

      // Clear infractions
      const count = await db.clearUserInfractions(targetUserId, message.guild_id);

      await api.channels.createMessage(message.channel_id, {
        content: `✅ Cleared ${count} infraction(s) for **${user.username}**\n\nThey now have a clean slate.`,
      });

      // Log to user
      try {
        const dmChannel = await api.users.createDM(targetUserId);
        await api.channels.createMessage(dmChannel.id, {
          content: `✅ Your infractions have been cleared in **${message.guild_id}**!\n\nYou now have a clean slate. Please follow the rules going forward.`,
        });
      } catch (e) {
        // DM failed
      }

      console.log(`🧹 ${user.username}'s infractions cleared by ${message.author.username} (${count} total)`);
    } catch (error) {
      console.error('Error clearing infractions:', error.message);
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error clearing infractions: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};
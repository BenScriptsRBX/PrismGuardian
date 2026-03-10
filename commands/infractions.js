// commands/infractions.js - Check user infractions

const db = require('../db');

module.exports = {
  name: 'infractions',
  aliases: ['inf', 'record', 'violations'],
  description: 'Check a user\'s infractions',
  execute: async ({ api, message, args, prefix }) => {
    // Parse user mention or ID
    const userIdMatch = args[0]?.match(/\d+/) || args[0];
    if (!userIdMatch) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Usage: \`${prefix}infractions <@user>\`\nExample: \`${prefix}infractions @user\``,
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

      // Get infractions
      const infractions = await db.getUserInfractions(targetUserId, message.guild_id);

      if (infractions.length === 0) {
        await api.channels.createMessage(message.channel_id, {
          content: `✅ **${user.username}** has no infractions`,
        });
        return;
      }

      // Build infractions list
      let infText = `📋 **Infractions for ${user.username}** (${infractions.length} total)\n\n`;
      
      infractions.slice(0, 10).forEach((inf, index) => {
        const date = new Date(inf.created_at).toLocaleDateString();
        infText += `${index + 1}. **${inf.type.toUpperCase()}** - ${date}\n`;
        infText += `   Reason: ${inf.reason}\n`;
        infText += `   By: <@${inf.moderator_id}>\n\n`;
      });

      if (infractions.length > 10) {
        infText += `... and ${infractions.length - 10} more`;
      }

      // Send message (split if too long)
      if (infText.length > 2000) {
        const chunks = infText.match(/[\s\S]{1,2000}/g) || [];
        for (const chunk of chunks) {
          await api.channels.createMessage(message.channel_id, {
            content: chunk,
          });
        }
      } else {
        await api.channels.createMessage(message.channel_id, {
          content: infText,
        });
      }

      console.log(`📋 ${message.author.username} checked infractions for ${user.username}`);
    } catch (error) {
      console.error('Error checking infractions:', error.message);
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error checking infractions: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};
// commands/purge.js - Delete multiple messages from a channel

const db = require('../db');

module.exports = {
  name: 'purge',
  aliases: ['clear', 'delete', 'prune'],
  description: 'Delete multiple messages from a channel',
  execute: async ({ api, message, args, prefix }) => {
    // Check if user has permission (owner only)
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

    // Get the number of messages to delete
    const amount = parseInt(args[0]);

    if (!amount || isNaN(amount) || amount < 1 || amount > 100) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Please specify a number between 1 and 100\n\n**Usage:** \`${prefix}purge <number> [user]\`\n\n**Examples:**\n\`${prefix}purge 10\` - Delete last 10 messages\n\`${prefix}purge 50 @user\` - Delete 50 messages from @user`,
        message_reference: { message_id: message.id },
      });
      return;
    }

    // Check if filtering by user
    const userIdMatch = args[1]?.match(/\d+/);
    const filterUserId = userIdMatch ? userIdMatch[0] : null;

    try {
      // Get messages from the channel
      const messagesResult = await api.channels.getMessages(message.channel_id, {
        limit: Math.min(amount * 2, 100), // Fetch more in case we need to filter
      });

      if (!messagesResult || messagesResult.length === 0) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ No messages found to delete',
          message_reference: { message_id: message.id },
        });
        return;
      }

      // Filter messages if user specified
      let messagesToDelete = messagesResult;
      if (filterUserId) {
        messagesToDelete = messagesResult.filter(m => m.author.id === filterUserId);
      }

      // Limit to requested amount
      messagesToDelete = messagesToDelete.slice(0, amount);

      if (messagesToDelete.length === 0) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ No messages found from that user`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      // Delete messages (Fluxer doesn't have bulk delete, so delete one by one)
      let deletedCount = 0;
      for (const msg of messagesToDelete) {
        try {
          await api.channels.deleteMessage(message.channel_id, msg.id);
          deletedCount++;
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          // Message already deleted or can't delete
        }
      }

      // Send confirmation
      const filterText = filterUserId ? ` from <@${filterUserId}>` : '';
      const response = await api.channels.createMessage(message.channel_id, {
        content: `✅ Deleted ${deletedCount} message(s)${filterText}`,
      });

      // Auto-delete confirmation after 5 seconds
      setTimeout(async () => {
        try {
          await api.channels.deleteMessage(message.channel_id, response.id);
        } catch (e) {
          // Ignore if can't delete
        }
      }, 5000);

      console.log(`🗑️ ${message.author.username} purged ${deletedCount} messages${filterText} in ${message.guild_id}`);
    } catch (error) {
      console.error('Error purging messages:', error.message);
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error deleting messages: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};
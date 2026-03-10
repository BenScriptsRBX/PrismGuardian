// commands/unlock.js - Unlock a channel (restore member messaging)

module.exports = {
    name: 'unlock',
    aliases: ['unlockdown'],
    description: 'Unlock a channel (restore member messaging)',
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
  
      const channelId = args[0]?.match(/\d+/) || message.channel_id;
      const reason = args.slice(1).join(' ') || 'Channel unlocked by moderator';
  
      try {
        // Get the channel
        const channel = await api.channels.get(channelId);
        if (!channel) {
          await api.channels.createMessage(message.channel_id, {
            content: '❌ Channel not found',
            message_reference: { message_id: message.id },
          });
          return;
        }
  
        // Try to unlock the channel (remove permissions override)
        try {
          await api.channels.edit(channelId, {
            permission_overwrites: [], // Clear all permission overrides
            reason: reason,
          });
  
          await api.channels.createMessage(message.channel_id, {
            content: `🔓 **<#${channelId}> is now unlocked**\n\n**Reason:** ${reason}`,
          });
  
          console.log(`🔓 ${message.author.username} unlocked <#${channelId}> in ${message.guild_id}: ${reason}`);
        } catch (e) {
          // If direct channel edit fails, try with a different approach
          console.warn(`⚠️ Could not modify channel permissions (may require higher bot permissions): ${e.message}`);
          await api.channels.createMessage(message.channel_id, {
            content: `⚠️ Could not unlock channel (may require higher permissions). Error: ${e.message}`,
            message_reference: { message_id: message.id },
          });
        }
      } catch (error) {
        console.error('Error unlocking channel:', error.message);
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error unlocking channel: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
    },
  };
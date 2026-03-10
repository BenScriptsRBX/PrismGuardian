// commands/lock.js - Lock a channel (prevent members from sending messages)

module.exports = {
    name: 'lock',
    aliases: ['lockdown'],
    description: 'Lock a channel (prevent members from sending messages)',
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
      const reason = args.slice(1).join(' ') || 'Channel locked by moderator';
  
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
  
        // Try to lock the channel (modify permissions)
        try {
          await api.channels.edit(channelId, {
            permission_overwrites: [
              {
                id: message.guild_id, // @everyone role
                type: 0, // role
                deny: '2048', // SEND_MESSAGES permission
              },
            ],
            reason: reason,
          });
  
          await api.channels.createMessage(message.channel_id, {
            content: `🔒 **<#${channelId}> is now locked**\n\n**Reason:** ${reason}\n\nUse \`${prefix}unlock <#${channelId}>\` to unlock`,
          });
  
          console.log(`🔒 ${message.author.username} locked <#${channelId}> in ${message.guild_id}: ${reason}`);
        } catch (e) {
          // If direct channel edit fails, try with a different approach
          console.warn(`⚠️ Could not modify channel permissions (may require higher bot permissions): ${e.message}`);
          await api.channels.createMessage(message.channel_id, {
            content: `⚠️ Could not lock channel (may require higher permissions). Error: ${e.message}`,
            message_reference: { message_id: message.id },
          });
        }
      } catch (error) {
        console.error('Error locking channel:', error.message);
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error locking channel: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
    },
  };
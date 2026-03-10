const db = require('../db');

module.exports = {
  name: 'disapprove',
  aliases: ['d'],
  description: 'Disapprove a flagged message',
  execute: async ({ api, message, args }) => {
    // ---------------- Permission check ----------------
    try {
      const guild = await api.guilds.get(message.guild_id);
      if (message.author.id !== guild.owner_id) {
        return api.channels.createMessage(message.channel_id, {
          content: '❌ Only server owner can use this command',
          message_reference: { message_id: message.id },
        });
      }
    } catch (error) {
      return api.channels.createMessage(message.channel_id, {
        content: '❌ Error: Could not verify permissions',
        message_reference: { message_id: message.id },
      });
    }

    // ---------------- CHECK ARGUMENT ----------------
    const flagId = args[0];
    if (!flagId || isNaN(flagId)) {
      return api.channels.createMessage(message.channel_id, {
        content: '❌ Usage: `!disapprove <id>`',
        message_reference: { message_id: message.id },
      });
    }

    try {
      const flags = await db.getPendingFlags(message.guild_id, 100);
      const flag = flags.find(f => f.id === parseInt(flagId));
      if (!flag) {
        return api.channels.createMessage(message.channel_id, {
          content: `❌ Flag #${flagId} not found`,
          message_reference: { message_id: message.id },
        });
      }

      // Delete the original message
      try { await api.channels.deleteMessage(flag.channel_id, flag.message_id); } catch {}

      // Add infraction
      try { await db.addInfraction(flag.user_id, message.guild_id, 'automod', flag.reason, message.author.id, true); } catch {}

      // Update flag status
      await db.updateFlagStatus(message.guild_id, flag.message_id, 'deleted', message.author.id, 'Disapproved by admin');

      // Notify the channel
      await api.channels.createMessage(message.channel_id, {
        content: `✅ Flag #${flag.id} disapproved! Message deleted and infraction added.`,
        message_reference: { message_id: message.id },
      });

      // DM user
      try {
        const dmChannel = await api.users.createDM(flag.user_id);
        await api.channels.createMessage(dmChannel.id, {
          embeds: [{
            title: '⚠️ Message Deleted',
            description: 'Your flagged message was reviewed and deleted by a moderator.',
            color: 15105570,
            fields: [{ name: 'Reason', value: flag.reason }],
            timestamp: new Date().toISOString()
          }]
        });
      } catch {}

      console.log(`✅ Flag #${flag.id} disapproved by ${message.author.username}`);
    } catch (error) {
      return api.channels.createMessage(message.channel_id, {
        content: `❌ Error: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};
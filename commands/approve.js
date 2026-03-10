const db = require('../db');

module.exports = {
  name: 'approve',
  aliases: ['a'],
  description: 'Approve a flagged message',
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

    const firstArg = args[0];

    // ---------------- LIST PENDING FLAGS ----------------
    if (!firstArg) {
      try {
        const flags = await db.getPendingFlags(message.guild_id, 10);
        if (flags.length === 0) {
          return api.channels.createMessage(message.channel_id, {
            content: '✅ No pending flags!',
            message_reference: { message_id: message.id },
          });
        }

        let description = '**Pending Flagged Messages:**\n\n';
        flags.forEach(flag => {
          const timestamp = new Date(flag.created_at).toLocaleString();
          description += `**ID:** \`${flag.id}\` | **User:** <@${flag.user_id}> | **Reason:** ${flag.reason}\n`;
        });

        const embed = {
          title: `🚩 Flagged Messages (${flags.length})`,
          description,
          color: 15105570,
          footer: { text: 'Use !approve <id> to approve or !disapprove <id> to disapprove' },
          timestamp: new Date().toISOString(),
        };

        return api.channels.createMessage(message.channel_id, { embeds: [embed] });
      } catch (error) {
        return api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
    }

    // ---------------- GET FLAG INFO ----------------
    if (firstArg === 'info') {
      const infoId = args[1];
      if (!infoId || isNaN(infoId)) {
        return api.channels.createMessage(message.channel_id, {
          content: '❌ Usage: `!approve info <id>`',
          message_reference: { message_id: message.id },
        });
      }

      try {
        const flags = await db.getPendingFlags(message.guild_id, 100);
        const flag = flags.find(f => f.id === parseInt(infoId));
        if (!flag) {
          return api.channels.createMessage(message.channel_id, {
            content: '❌ Flag not found',
            message_reference: { message_id: message.id },
          });
        }

        const timestamp = new Date(flag.created_at).toLocaleString();
        const embed = {
          title: `🚩 Flag #${flag.id}`,
          description: `**User:** <@${flag.user_id}>\n**Reason:** ${flag.reason}\n**Time:** ${timestamp}`,
          fields: [
            { name: 'Content', value: `\`\`\`${flag.content || 'N/A'}\`\`\`` },
            { name: 'Channel', value: `<#${flag.channel_id}>`, inline: true }
          ],
          color: 15105570,
          footer: { text: `!approve ${flag.id} to approve | !disapprove ${flag.id} to disapprove` },
          timestamp: new Date().toISOString(),
        };

        return api.channels.createMessage(message.channel_id, { embeds: [embed] });
      } catch (error) {
        return api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
    }

    // ---------------- APPROVE FLAG BY ID ----------------
    if (!isNaN(firstArg)) {
      const flagId = parseInt(firstArg);
      try {
        const flags = await db.getPendingFlags(message.guild_id, 100);
        const flag = flags.find(f => f.id === flagId);
        if (!flag) {
          return api.channels.createMessage(message.channel_id, {
            content: `❌ Flag #${flagId} not found`,
            message_reference: { message_id: message.id },
          });
        }

        await db.updateFlagStatus(message.guild_id, flag.message_id, 'approved', message.author.id, 'Approved by admin');

        await api.channels.createMessage(message.channel_id, {
          content: `✅ Flag #${flag.id} approved!`,
          message_reference: { message_id: message.id },
        });

        console.log(`✅ Flag #${flag.id} approved by ${message.author.username}`);
        return;
      } catch (error) {
        return api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
    }

    // ---------------- INVALID ARG ----------------
    return api.channels.createMessage(message.channel_id, {
      content: '❌ Usage: `!approve <id>`',
      message_reference: { message_id: message.id },
    });
  },
};
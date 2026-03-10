// commands/context.js - Context viewer with database storage

const db = require('../db');

module.exports = {
  name: 'context',
  aliases: ['ctx'],
  description: 'View message context or toggle context mode',
  execute: async ({ api, message, args, prefix }) => {
    try {
      const guild = await api.guilds.get(message.guild_id);
      if (message.author.id !== guild.owner_id) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ Only server owner can use this',
          message_reference: { message_id: message.id },
        });
        return;
      }
    } catch (error) {
      return;
    }

    const firstArg = args[0];

    // ==================== TOGGLE CONTEXT MODE ====================
    if (firstArg === 'on' || firstArg === 'enable') {
      try {
        const settings = await db.getModerationsSettings(message.guild_id);
        settings.context_enabled = true;
        await db.setModerationsSettings(message.guild_id, settings);

        await api.channels.createMessage(message.channel_id, {
          content: `✅ Context mode enabled! Use \`!context <flag_id>\` to view message context.`,
          message_reference: { message_id: message.id },
        });
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
      return;
    }

    if (firstArg === 'off' || firstArg === 'disable') {
      try {
        const settings = await db.getModerationsSettings(message.guild_id);
        settings.context_enabled = false;
        await db.setModerationsSettings(message.guild_id, settings);

        await api.channels.createMessage(message.channel_id, {
          content: `✅ Context mode disabled.`,
          message_reference: { message_id: message.id },
        });
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
      return;
    }

    // ==================== VIEW CONTEXT BY FLAG ID ====================
    if (firstArg && !isNaN(firstArg)) {
      const flagId = parseInt(firstArg);
      
      try {
        const context = await db.getContext(message.guild_id, flagId);

        if (!context) {
          await api.channels.createMessage(message.channel_id, {
            content: `❌ Context for flag #${flagId} not found or expired (7 days max)`,
            message_reference: { message_id: message.id },
          });
          return;
        }

        let description = '';

        if (context.before && context.before.length > 0) {
          description += '**📌 BEFORE (5 messages):**\n';
          context.before.forEach((msg, idx) => {
            const ts = new Date(msg.timestamp).toLocaleTimeString();
            const content = msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
            description += `${idx + 1}. <@${msg.author_id}> (${ts})\n   \`${content}\`\n`;
          });
          description += '\n';
        }

        description += '🚩 **FLAGGED MESSAGE:**\n';
        if (context.flagged) {
          const flagTs = new Date(context.flagged.timestamp).toLocaleTimeString();
          description += `<@${context.flagged.author_id}> (${flagTs})\n\`${context.flagged.content}\`\n\n`;
        }

        if (context.after && context.after.length > 0) {
          description += '**📌 AFTER (3 messages):**\n';
          context.after.forEach((msg, idx) => {
            const ts = new Date(msg.timestamp).toLocaleTimeString();
            const content = msg.content.length > 60 ? msg.content.substring(0, 60) + '...' : msg.content;
            description += `${idx + 1}. <@${msg.author_id}> (${ts})\n   \`${content}\`\n`;
          });
        }

        const embed = {
          title: `📋 Context for Flag #${flagId}`,
          description: description.substring(0, 4096),
          color: 3066993,
          footer: { text: `Expires in 7 days` },
          timestamp: new Date().toISOString(),
        };

        await api.channels.createMessage(message.channel_id, {
          embeds: [embed],
        });
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
      return;
    }

    // ==================== SHOW STATUS ====================
    try {
      const settings = await db.getModerationsSettings(message.guild_id);
      await api.channels.createMessage(message.channel_id, {
        embeds: [{
          title: '📋 Context Mode',
          description: `**Status:** ${settings.context_enabled ? '✅ Enabled' : '❌ Disabled'}\n\nUse:\n\`!context on\` - Enable\n\`!context off\` - Disable\n\`!context <flag_id>\` - View context`,
          color: 3066993,
          timestamp: new Date().toISOString(),
        }],
        message_reference: { message_id: message.id },
      });
    } catch (error) {
      await api.channels.createMessage(message.channel_id, {
        content: `❌ Error: ${error.message}`,
        message_reference: { message_id: message.id },
      });
    }
  },
};
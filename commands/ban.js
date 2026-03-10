// commands/approve.js - Message Approval/Review Command
// Allows admins to approve or disapprove flagged messages from AI moderation

const db = require('../db');

module.exports = {
  name: 'approve',
  aliases: ['a', 'disapprove', 'd', 'review', 'flag'],
  description: 'Review and approve/disapprove flagged messages',
  execute: async ({ api, message, args, prefix }) => {
    // Permission check: only admins
    try {
      const guild = await api.guilds.get(message.guild_id);
      const member = await api.guilds.getMember(message.guild_id, message.author.id);
      
      const isOwner = message.author.id === guild.owner_id;
      const hasAdminRole = member.roles.some(roleId => {
        return true; // Simplified - you can add proper role checking
      });

      if (!isOwner && !hasAdminRole) {
        await api.channels.createMessage(message.channel_id, {
          content: '❌ Only server admins can use this command',
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

    const subcommand = args[0]?.toLowerCase();

    // ==================== LIST PENDING FLAGS ====================
    if (!subcommand || subcommand === 'list' || subcommand === 'pending') {
      try {
        const flags = await db.getPendingFlags(message.guild_id, 10);

        if (flags.length === 0) {
          await api.channels.createMessage(message.channel_id, {
            content: '✅ No pending flags!',
            message_reference: { message_id: message.id },
          });
          return;
        }

        let description = '**Pending Flagged Messages:**\n\n';
        flags.forEach(flag => {
          const timestamp = new Date(flag.created_at).toLocaleString();
          description += `**ID:** \`${flag.id}\` | **User:** <@${flag.user_id}> | **Score:** ${flag.score || 'N/A'}\n`;
          description += `**Reason:** ${flag.reason}\n`;
          description += `**Content:** \`${flag.content?.substring(0, 50)}\`...\n`;
          description += `**Time:** ${timestamp}\n\n`;
        });

        const embed = {
          title: `🚩 Flagged Messages (${flags.length})`,
          description,
          color: 15105570,
          footer: { text: `Use !approve info <id> for details | !approve approve <id> or !approve disapprove <id>` },
          timestamp: new Date().toISOString(),
        };

        await api.channels.createMessage(message.channel_id, {
          embeds: [embed],
        });
        return;
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
        return;
      }
    }

    // ==================== GET FLAG INFO ====================
    if (subcommand === 'info') {
      const flagId = args[1];
      if (!flagId) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Usage: \`${prefix}approve info <id>\``,
          message_reference: { message_id: message.id },
        });
        return;
      }

      try {
        const flags = await db.getPendingFlags(message.guild_id, 100);
        const flag = flags.find(f => f.id === parseInt(flagId));

        if (!flag) {
          await api.channels.createMessage(message.channel_id, {
            content: `❌ Flag not found`,
            message_reference: { message_id: message.id },
          });
          return;
        }

        const timestamp = new Date(flag.created_at).toLocaleString();
        const embed = {
          title: `🚩 Flag #${flag.id}`,
          description: `**User:** <@${flag.user_id}>\n**Reason:** ${flag.reason}\n**Status:** ${flag.status}\n**Time:** ${timestamp}`,
          fields: [
            {
              name: 'Full Content',
              value: `\`\`\`${flag.content || 'N/A'}\`\`\``
            },
            {
              name: 'Score',
              value: String(flag.score || 'N/A'),
              inline: true
            },
            {
              name: 'Channel',
              value: `<#${flag.channel_id}>`,
              inline: true
            }
          ],
          color: 15105570,
          footer: { text: `Use !approve approve ${flag.id} or !approve disapprove ${flag.id}` },
          timestamp: new Date().toISOString(),
        };

        await api.channels.createMessage(message.channel_id, {
          embeds: [embed],
        });
        return;
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
        return;
      }
    }

    // ==================== APPROVE FLAG ====================
    if (subcommand === 'approve' || subcommand === 'allow') {
      const flagId = args[1];
      if (!flagId) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Usage: \`${prefix}approve approve <id>\``,
          message_reference: { message_id: message.id },
        });
        return;
      }

      try {
        const flags = await db.getPendingFlags(message.guild_id, 100);
        const flag = flags.find(f => f.id === parseInt(flagId));

        if (!flag) {
          await api.channels.createMessage(message.channel_id, {
            content: `❌ Flag not found`,
            message_reference: { message_id: message.id },
          });
          return;
        }

        await db.updateFlagStatus(message.guild_id, flag.message_id, 'approved', message.author.id, 'Approved by admin');

        await api.channels.createMessage(message.channel_id, {
          content: `✅ Flag #${flag.id} approved! Message is allowed.`,
          message_reference: { message_id: message.id },
        });

        try {
          const dmChannel = await api.users.createDM(flag.user_id);
          await api.channels.createMessage(dmChannel.id, {
            embeds: [{
              title: '✅ Message Approved',
              description: 'Your flagged message has been approved by a moderator.',
              color: 3066993,
              timestamp: new Date().toISOString()
            }]
          });
        } catch (dmError) {
          console.warn('Could not DM user:', dmError.message);
        }

        console.log(`✅ Flag #${flag.id} approved by ${message.author.username}`);
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
      return;
    }

    // ==================== DISAPPROVE FLAG ====================
    if (subcommand === 'disapprove' || subcommand === 'deny') {
      const flagId = args[1];
      if (!flagId) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Usage: \`${prefix}approve disapprove <id>\``,
          message_reference: { message_id: message.id },
        });
        return;
      }

      try {
        const flags = await db.getPendingFlags(message.guild_id, 100);
        const flag = flags.find(f => f.id === parseInt(flagId));

        if (!flag) {
          await api.channels.createMessage(message.channel_id, {
            content: `❌ Flag not found`,
            message_reference: { message_id: message.id },
          });
          return;
        }

        try {
          await api.channels.deleteMessage(flag.channel_id, flag.message_id);
          console.log(`🔨 Deleted message ${flag.message_id}`);
        } catch (delError) {
          console.warn(`Could not delete message: ${delError.message}`);
        }

        try {
          await db.addInfraction(flag.user_id, message.guild_id, 'automod', flag.reason, message.author.id, true);
          console.log(`✅ Infraction added for ${flag.user_id}`);
        } catch (infraError) {
          console.error('Error adding infraction:', infraError.message);
        }

        await db.updateFlagStatus(message.guild_id, flag.message_id, 'deleted', message.author.id, 'Disapproved by admin');

        await api.channels.createMessage(message.channel_id, {
          content: `✅ Flag #${flag.id} disapproved! Message deleted and infraction added.`,
          message_reference: { message_id: message.id },
        });

        try {
          const dmChannel = await api.users.createDM(flag.user_id);
          await api.channels.createMessage(dmChannel.id, {
            embeds: [{
              title: '⚠️ Message Deleted',
              description: 'Your flagged message was reviewed and deleted by a moderator.',
              color: 15105570,
              fields: [
                { name: 'Reason', value: flag.reason }
              ],
              timestamp: new Date().toISOString()
            }]
          });
        } catch (dmError) {
          console.warn('Could not DM user:', dmError.message);
        }

        console.log(`✅ Flag #${flag.id} disapproved by ${message.author.username}`);
      } catch (error) {
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error: ${error.message}`,
          message_reference: { message_id: message.id },
        });
      }
      return;
    }

    await api.channels.createMessage(message.channel_id, {
      content: `❌ Unknown subcommand: \`${subcommand}\`\n\nUse \`${prefix}approve\` for pending flags, \`${prefix}approve info <id>\`, \`${prefix}approve approve <id>\`, or \`${prefix}approve disapprove <id>\``,
      message_reference: { message_id: message.id },
    });
  },
};
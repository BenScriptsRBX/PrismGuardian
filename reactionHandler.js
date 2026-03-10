// Reaction handler for flag approval/disapproval

const db = require('./db');

async function handleFlagReaction(api, reaction, userId, isAdding) {
  try {
    // Only handle check and x reactions
    if (reaction.emoji.name !== '✅' && reaction.emoji.name !== '❌') {
      return;
    }

    // Get the message
    const message = await api.channels.getMessage(reaction.channel_id, reaction.message_id);
    if (!message || !message.embeds || message.embeds.length === 0) {
      return;
    }

    // Extract flag ID from embed footer
    const footer = message.embeds[0].footer?.text || '';
    const flagIdMatch = footer.match(/Flag ID: (\d+)/);
    if (!flagIdMatch) {
      return;
    }

    const flagId = parseInt(flagIdMatch[1]);
    const guildId = reaction.guild_id;

    // Get flag from database
    const flags = await db.getPendingFlags(guildId, 100);
    const flag = flags.find(f => f.id === flagId);

    if (!flag) {
      return;
    }

    // Only process if reaction is being added
    if (!isAdding) {
      return;
    }

    // Approve with check
    if (reaction.emoji.name === '✅') {
      await db.updateFlagStatus(guildId, flag.message_id, 'approved', userId, 'Approved via reaction');
      
      // Update the message
      try {
        const updatedEmbed = message.embeds[0];
        updatedEmbed.footer = { text: `✅ Approved by <@${userId}>` };
        updatedEmbed.color = 3066993;
        
        await api.channels.editMessage(reaction.channel_id, reaction.message_id, {
          embeds: [updatedEmbed]
        });
      } catch (e) {}

      console.log(`✅ Flag #${flagId} approved via reaction`);
    }

    // Disapprove with x
    if (reaction.emoji.name === '❌') {
      // Delete the original message
      try {
        await api.channels.deleteMessage(flag.channel_id, flag.message_id);
      } catch (e) {}

      // Add infraction
      try {
        await db.addInfraction(flag.user_id, guildId, 'automod', flag.reason, userId, true);
      } catch (e) {}

      // Update flag status
      await db.updateFlagStatus(guildId, flag.message_id, 'deleted', userId, 'Disapproved via reaction');

      // Update the message
      try {
        const updatedEmbed = message.embeds[0];
        updatedEmbed.footer = { text: `❌ Disapproved by <@${userId}>` };
        updatedEmbed.color = 15158332;
        
        await api.channels.editMessage(reaction.channel_id, reaction.message_id, {
          embeds: [updatedEmbed]
        });
      } catch (e) {}

      // Send DM to user
      try {
        const dmChannel = await api.users.createDM(flag.user_id);
        await api.channels.createMessage(dmChannel.id, {
          embeds: [{
            title: '⚠️ Message Deleted',
            description: 'Your flagged message was deleted by a moderator.',
            color: 15105570,
            fields: [{ name: 'Reason', value: flag.reason }],
            timestamp: new Date().toISOString()
          }]
        });
      } catch (e) {}

      console.log(`✅ Flag #${flagId} disapproved via reaction`);
    }
  } catch (error) {
    console.error('Reaction handler error:', error.message);
  }
}

module.exports = { handleFlagReaction };
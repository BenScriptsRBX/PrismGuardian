// commands/help.js - Built-in help command

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Show available commands',
  execute: async ({ api, message, args, prefix }) => {
    const command = args[0]?.toLowerCase();

    // Show specific command help
    if (command === 'warn') {
      await api.channels.createMessage(message.channel_id, {
        content: `🛡️ **!warn** - Warn a user

**Usage:** \`${prefix}warn <@user> <reason>\`

**Description:** Issue a warning to a user. Warnings are tracked and users can be punished based on their violation count.

**Example:**
\`${prefix}warn @john spam\`
\`${prefix}warn @jane inappropriate language\`

**Aliases:** \`${prefix}w\`

**Permission:** Server Owner / Moderator

**Related:** \`${prefix}infractions\`, \`${prefix}mute\`, \`${prefix}kick\`, \`${prefix}ban\``,
      });
      return;
    }

    if (command === 'infractions' || command === 'inf') {
      await api.channels.createMessage(message.channel_id, {
        content: `🛡️ **!infractions** - Check user violations

**Usage:** \`${prefix}infractions <@user>\`

**Description:** View all infractions (warnings, mutes, kicks, bans) for a user in this server.

**Example:**
\`${prefix}infractions @john\`
\`${prefix}inf 123456789\`

**Aliases:** \`${prefix}inf\`, \`${prefix}record\`, \`${prefix}violations\`

**Related:** \`${prefix}warn\`, \`${prefix}clearinf\``,
      });
      return;
    }

    if (command === 'clearinf') {
      await api.channels.createMessage(message.channel_id, {
        content: `🛡️ **!clearinf** - Clear user infractions

**Usage:** \`${prefix}clearinf <@user>\`

**Description:** Clear all infractions for a user, giving them a fresh start.

**Example:**
\`${prefix}clearinf @john\`

**Aliases:** \`${prefix}clrinf\`, \`${prefix}clearviolations\`

**Permission:** Server Owner ONLY

**Related:** \`${prefix}warn\`, \`${prefix}infractions\``,
      });
      return;
    }

    if (command === 'mute') {
      await api.channels.createMessage(message.channel_id, {
        content: `🛡️ **!mute** - Mute a user temporarily

**Usage:** \`${prefix}mute <@user> <duration> <reason>\`

**Duration Options:** 10m, 1h, 1d, 7d

**Description:** Mute a user for the specified duration. They cannot send messages during this time.

**Examples:**
\`${prefix}mute @john 10m spam\`
\`${prefix}mute @jane 1h disrespect\`
\`${prefix}mute @bob 1d nsfw\`

**Aliases:** \`${prefix}m\`, \`${prefix}timeout\`

**Permission:** Server Owner / Moderator

**Auto-unmute:** User is automatically unmuted after duration expires

**Related:** \`${prefix}warn\`, \`${prefix}kick\`, \`${prefix}ban\``,
      });
      return;
    }

    if (command === 'kick') {
      await api.channels.createMessage(message.channel_id, {
        content: `🛡️ **!kick** - Remove user from server

**Usage:** \`${prefix}kick <@user> <reason>\`

**Description:** Kick a user from the server. They can rejoin if invited.

**Example:**
\`${prefix}kick @john repeated violations\`
\`${prefix}kick @jane rule breaker\`

**Permission:** Server Owner / Moderator

**Related:** \`${prefix}warn\`, \`${prefix}ban\`, \`${prefix}mute\``,
      });
      return;
    }

    if (command === 'ban') {
      await api.channels.createMessage(message.channel_id, {
        content: `🛡️ **!ban** - Permanently ban user from server

**Usage:** \`${prefix}ban <@user> <reason>\`

**Description:** Permanently ban a user from the server. This action is permanent.

**Example:**
\`${prefix}ban @john severe harassment\`
\`${prefix}ban @jane hacking attempt\`

**Permission:** Server Owner / Moderator

**Related:** \`${prefix}kick\`, \`${prefix}warn\`, \`${prefix}mute\``,
      });
      return;
    }

    if (command === 'purge') {
      await api.channels.createMessage(message.channel_id, {
        content: `🗑️ **!purge** - Delete multiple messages

**Usage:** \`${prefix}purge <amount> [@user]\`

**Description:** Bulk delete messages from a channel. Can filter by user.

**Amount:** 1-100 messages

**Examples:**
\`${prefix}purge 10\` - Delete last 10 messages
\`${prefix}purge 50 @john\` - Delete 50 messages from @john
\`${prefix}purge 25\` - Delete last 25 messages

**Aliases:** \`${prefix}clear\`, \`${prefix}delete\`, \`${prefix}prune\`

**Permission:** Server Owner ONLY

**Note:** Deletes one by one (Fluxer limitation)`,
      });
      return;
    }

    if (command === 'lock') {
      await api.channels.createMessage(message.channel_id, {
        content: `🔒 **!lock** - Lock a channel (prevent messaging)

**Usage:** \`${prefix}lock [channel] [reason]\`

**Description:** Lock a channel to prevent members from sending messages. Only mods/bots can send.

**Examples:**
\`${prefix}lock\` - Lock current channel
\`${prefix}lock #general\` - Lock #general channel
\`${prefix}lock #general raid detected\` - Lock with reason

**Aliases:** \`${prefix}lockdown\`

**Permission:** Server Owner ONLY

**Related:** \`${prefix}unlock\``,
      });
      return;
    }

    if (command === 'unlock') {
      await api.channels.createMessage(message.channel_id, {
        content: `🔓 **!unlock** - Unlock a channel

**Usage:** \`${prefix}unlock [channel] [reason]\`

**Description:** Unlock a previously locked channel to allow members to send messages again.

**Examples:**
\`${prefix}unlock\` - Unlock current channel
\`${prefix}unlock #general\` - Unlock #general channel
\`${prefix}unlock #general raid ended\` - Unlock with reason

**Aliases:** \`${prefix}unlockdown\`

**Permission:** Server Owner ONLY

**Related:** \`${prefix}lock\``,
      });
      return;
    }

    if (command === 'config' || command === 'filter' || command === 'filters') {
      await api.channels.createMessage(message.channel_id, {
        content: `⚙️ **!config** - Configure moderation filters

**Usage:** 
\`${prefix}config view\` - Show current filters
\`${prefix}config set <filter> <allow|block>\` - Enable/disable a filter
\`${prefix}config logs <channel_id>\` - Set moderation log channel

**Available Filters:**
• nsfw - Block NSFW content
• sexual - Block sexual content
• racist - Block racist content
• hate - Block hate speech
• profanity - Block profanity/cursing
• spam - Block spam messages
• images - Block inappropriate images

**Examples:**
\`${prefix}config set nsfw block\`
\`${prefix}config set profanity allow\`
\`${prefix}config logs 1234567890\`

**Aliases:** \`${prefix}cfg\`, \`${prefix}settings\`, \`${prefix}filters\`

**Permission:** Server Owner ONLY`,
      });
      return;
    }

    // Show all commands
    const helpText = `🛡️ **PrismGuardian Bot - Commands**

**Moderation Commands:**
\`${prefix}warn <@user> <reason>\` - Warn a user
\`${prefix}infractions <@user>\` - Check user violations
\`${prefix}clearinf <@user>\` - Clear infractions (owner only)
\`${prefix}mute <@user> <duration> <reason>\` - Mute user (10m/1h/1d/7d)
\`${prefix}kick <@user> <reason>\` - Kick user from server
\`${prefix}ban <@user> <reason>\` - Permanently ban user

**Channel Management:**
\`${prefix}purge <amount> [@user]\` - Delete messages (1-100)
\`${prefix}lock [channel] [reason]\` - Lock a channel
\`${prefix}unlock [channel] [reason]\` - Unlock a channel

**Configuration:**
\`${prefix}config view\` - Show filter settings
\`${prefix}config set <filter> <allow|block>\` - Configure filters
\`${prefix}config logs <channel_id>\` - Set moderation log channel

**Utility:**
\`${prefix}ping\` - Check bot latency
\`${prefix}help [command]\` - Show this message

**Available Filters:**
nsfw, sexual, racist, hate, profanity, spam

**Examples:**
\`${prefix}help purge\` - Get help on purge command
\`${prefix}help lock\` - Get help on lock command
\`${prefix}purge 10\` - Delete last 10 messages
\`${prefix}lock #general raid\` - Lock general channel`;

    await api.channels.createMessage(message.channel_id, {
      content: helpText,
    });
  },
};
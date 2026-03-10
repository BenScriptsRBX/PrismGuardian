// main.js - PrismGuardian Fluxer Bot
const { Client, GatewayDispatchEvents } = require('@discordjs/core');
const { REST } = require('@discordjs/rest');
const { WebSocketManager } = require('@discordjs/ws');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { handleFlagReaction } = require('./reactionHandler');

// ==================== SETUP ====================
const token = process.env.FLUXER_TOKEN;
if (!token) {
  throw new Error('You forgot the FLUXER_TOKEN in your .env file!');
}

const PREFIX = process.env.PREFIX || '!';
const FLUXER_API = 'https://api.fluxer.app';
const API_VERSION = '1';

// ==================== INITIALIZE CLIENT ====================
const rest = new REST({ api: FLUXER_API, version: API_VERSION }).setToken(token);

const gateway = new WebSocketManager({
  intents: 0,
  rest,
  token,
  version: API_VERSION,
});

const client = new Client({ rest, gateway });

// ==================== INITIALIZE DATABASE ====================
const db = require('./db');

// ==================== COMMAND LOADER ====================
const commands = new Map();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');

  // Check if commands folder exists
  if (!fs.existsSync(commandsPath)) {
    console.warn('⚠️  Commands folder not found! Creating /commands directory...');
    fs.mkdirSync(commandsPath, { recursive: true });
    console.log('📁 Created /commands folder - add your command files there!\n');
    return;
  }

  // Read all .js files in /commands
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  if (commandFiles.length === 0) {
    console.warn('⚠️  No command files found in /commands folder\n');
    return;
  }

  console.log(`\n📂 Loading ${commandFiles.length} command file(s)...\n`);

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      // Clear require cache to allow hot-reloading
      delete require.cache[require.resolve(filePath)];
      
      const command = require(filePath);

      // Validate command structure
      if (!command.name || !command.execute) {
        console.warn(`   ⚠️  Skipping ${file}: Missing 'name' or 'execute' property`);
        continue;
      }

      commands.set(command.name, command);
      
      // Show aliases if any
      const aliases = command.aliases ? ` (aliases: ${command.aliases.join(', ')})` : '';
      console.log(`   ✅ Loaded: ${command.name}${aliases}`);
    } catch (error) {
      console.error(`   ❌ Error loading ${file}:`, error.message);
    }
  }

  console.log(`\n✨ Successfully loaded ${commands.size} command(s)\n`);
}

// ==================== READY EVENT ====================
// ==================== READY EVENT ====================
client.on(GatewayDispatchEvents.Ready, async ({ data }) => {
  const { username, discriminator } = data.user;
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   🌈 PrismGuardian is Online! 🛡️    ║');
  console.log('╚═══════════════════════════════════════╝\n');
  console.log(`📊 Bot: ${username}#${discriminator}`);
  console.log(`🎯 Prefix: ${PREFIX}`);
  console.log(`📝 Commands loaded: ${commands.size}`);
  console.log(`✨ Ready to go!\n`);

  // Initialize database if not already done
  if (!db.initialized) {
    try {
      await db.initialize();
      console.log('🗄️ Database ready\n');
    } catch (error) {
      console.error('⚠️  Database initialization failed, some features may not work\n');
    }
  }
});

// ==================== TRACK WELCOME MESSAGES ====================
let botStartTime = Date.now();

// ==================== GUILD CREATE EVENT (Bot joins server) ====================
client.on(GatewayDispatchEvents.GuildCreate, async ({ api, data }) => {
  const guild = data;
  
  // Don't send welcome message on startup (within 5 seconds of bot start)
  const timeSinceStart = Date.now() - botStartTime;
  if (timeSinceStart < 5000) {
    console.log(`⏭️ Skipping welcome message for ${guild.name} (startup)`);
    return;
  }
  
  // Check database if we've already sent welcome to this server
  const alreadySent = await db.hasWelcomeMessageSent(guild.id);
  if (alreadySent) {
    console.log(`⏭️ Welcome already sent to ${guild.name}`);
    return;
  }
  
  console.log(`\n✨ Joined new server: ${guild.name} (${guild.id})`);

  try {
    // Get the default channel (usually #general)
    const channels = await api.guilds.getChannels(guild.id);
    let defaultChannel = null;

    // Try to find #general or first text channel
    for (const channel of channels) {
      if (channel.name === 'general' || channel.type === 0) {
        defaultChannel = channel;
        break;
      }
    }

    if (!defaultChannel) {
      console.warn(`⚠️ Could not find suitable channel for welcome message in ${guild.name}`);
      return;
    }

    // Send welcome embed
    const welcomeEmbed = {
      title: '👋 Welcome to PrismGuardian!',
      description: 'Advanced AI-powered moderation bot protecting your community from spam, hate speech, and inappropriate content.',
      color: 5793266, // Purple
      fields: [
        {
          name: '🚀 Quick Start',
          value: `\`${PREFIX}help\` - View all commands\n\`${PREFIX}config view\` - See filter settings`
        },
        {
          name: '🛡️ What We Protect Against',
          value: 'Hate speech • Profanity • Spam • Sexual content • Racist content • NSFW'
        },
        {
          name: '⚙️ Setup',
          value: `Use \`${PREFIX}config set <filter> allow\` to disable a filter\nUse \`${PREFIX}config logs <channel>\` to set mod logs`
        }
      ],
      footer: {
        text: 'PrismGuardian v1.0 | Type !help for more info'
      },
      timestamp: new Date().toISOString()
    };

    const response = await api.channels.createMessage(defaultChannel.id, {
      embeds: [welcomeEmbed]
    });

    // Record in database
    await db.recordWelcomeMessage(guild.id, response.id);

    console.log(`✅ Welcome message sent to ${guild.name}`);
  } catch (error) {
    console.error(`❌ Error sending welcome message:`, error.message);
  }
});

// ==================== INITIALIZE AUTOMOD ====================
const textLogic = require('./autoMod/textLogic.js');

// ==================== REACTION HANDLER ====================
client.on(GatewayDispatchEvents.MessageReactionAdd, async ({ api, data }) => {
  await handleFlagReaction(api, data, data.user_id, true);
});

client.on(GatewayDispatchEvents.MessageReactionRemove, async ({ api, data }) => {
  await handleFlagReaction(api, data, data.user_id, false);
});

// ==================== MESSAGE CREATE EVENT ====================
client.on(GatewayDispatchEvents.MessageCreate, async ({ api, data }) => {
  const message = data;

  // Ignore bot messages
  if (message.author.bot) {
    return;
  }

  // Ignore DMs (only moderate in guilds)
  if (!message.guild_id) {
    return;
  }

  try {
    // ==================== COMMAND HANDLER ====================
    if (message.content.startsWith(PREFIX)) {
      // Parse command and arguments
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      // Try to find command by name or alias
      let command = commands.get(commandName);

      if (!command) {
        // Check aliases
        for (const [, cmd] of commands) {
          if (cmd.aliases && cmd.aliases.includes(commandName)) {
            command = cmd;
            break;
          }
        }
      }

      if (!command) {
        console.log(`❌ Unknown command: ${commandName}`);
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Unknown command: \`${commandName}\`\nType \`${PREFIX}help\` for available commands`,
          message_reference: { message_id: message.id },
        });
        return;
      }

      console.log(`📝 ${message.author.username} used: ${commandName}`);

      // Execute command
      try {
        await command.execute({
          api,
          message,
          args,
          prefix: PREFIX,
        });
      } catch (error) {
        console.error(`❌ Error executing command ${commandName}:`, error.message);
        await api.channels.createMessage(message.channel_id, {
          content: `❌ Error executing command: ${error.message}`,
          message_reference: { message_id: message.id },
        }).catch(() => null);
      }
      return;
    }

    // ==================== AUTO-MODERATION ====================
    try {
      const settings = await db.getModerationsSettings(message.guild_id);
      if (!settings) {
        return; // No settings configured
      }

      // Check if any filters are enabled
      const hasActiveFilters = settings.nsfw || settings.sexual || settings.racist || 
                               settings.hate || settings.profanity || settings.spam;
      if (!hasActiveFilters) {
        return; // No filters enabled
      }

      // Run text moderation (Regex > Toxic-BERT > Groq)
      const modResult = await textLogic.moderateText(message, api, db);

      if (!modResult.safe && !modResult.alreadyLogged) {
        // Message wasn't already handled by regex/patterns
        console.log(`⚠️ VIOLATION: ${message.author.username} - ${modResult.reason} (${modResult.filterType})`);

        // Delete the message
        try {
          await api.channels.deleteMessage(message.channel_id, message.id);
        } catch (e) {
          // Already deleted
        }

        // Send warning DM to user as embed
        try {
          const dmChannel = await api.users.createDM(message.author.id);
          const severityIcon = modResult.severity === 'CRITICAL' ? '🚨' : 
                              modResult.severity === 'HIGH' ? '⚠️' : '📋';
          
          const dmEmbed = {
            title: `${severityIcon} Message Removed`,
            description: `Your message in the server was removed for violating community guidelines.`,
            color: modResult.severity === 'CRITICAL' ? 15158332 : modResult.severity === 'HIGH' ? 15105570 : 9807270,
            fields: [
              {
                name: '❌ Reason',
                value: modResult.reason
              },
              {
                name: '⚡ Severity',
                value: modResult.severity || 'MEDIUM'
              }
            ],
            footer: {
              text: 'Please follow the server\'s content policies'
            },
            timestamp: new Date().toISOString()
          };
          
          await api.channels.createMessage(dmChannel.id, {
            embeds: [dmEmbed]
          });
        } catch (e) {
          // DM failed
        }


        try {
          await db.addInfraction(
            message.author.id,
            message.guild_id,
            'automod',
            modResult.reason,
            'bot_automod',
            true // automated
          );
          
          // Get updated infraction count and apply progressive punishment
          const infractions = await db.getUserInfractions(message.author.id, message.guild_id, 100);
          const violationCount = infractions.length;
          
          console.log(`📊 ${message.author.username} has ${violationCount} infraction(s)`);
          
          // Check if user is new (account created less than 7 days ago)
          // Note: Fluxer may not provide created_timestamp, so default to not new
          const accountAgeMs = message.author.created_timestamp ? Date.now() - message.author.created_timestamp : Date.now();
          const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
          const isNewUser = accountAgeMs && accountAgeDays < 7;
          
          console.log(`📅 ${message.author.username} account age: ${isNewUser ? accountAgeDays.toFixed(1) : 'unknown'} days${isNewUser ? ' (NEW USER)' : ''}`);
          
          // Progressive punishment thresholds (stricter for new users)
          // NOTE: Automatic punishments disabled for now - bot needs higher permissions
          // Just log what punishment WOULD be applied
          let punishment = null;
          let punishmentTime = null;
          
          if (isNewUser) {
            // New users get stricter punishment
            if (violationCount >= 10) {
              punishment = 'ban';
            } else if (violationCount >= 5) {
              punishment = 'kick';
            } else if (violationCount >= 2) {
              punishment = 'mute';
              punishmentTime = 10 * 60 * 1000; // 10 minutes
            }
          } else {
            // Regular users have more lenient thresholds
            if (violationCount >= 20) {
              punishment = 'ban';
            } else if (violationCount >= 10) {
              punishment = 'kick';
            } else if (violationCount >= 5) {
              punishment = 'mute';
              punishmentTime = 60 * 60 * 1000; // 1 hour
            } else if (violationCount >= 3) {
              punishment = 'mute';
              punishmentTime = 10 * 60 * 1000; // 10 minutes
            }
          }
          
          // Apply punishment
          if (punishment) {
            console.log(`🔨 Applying punishment: ${punishment} to ${message.author.username}`);
            
            try {
              if (punishment === 'ban') {
                // Ban the user
                if (api.guilds.createBan) {
                  await api.guilds.createBan(message.guild_id, message.author.id, {
                    reason: `Auto-mod: ${violationCount} infractions`
                  });
                } else if (api.guilds.banUser) {
                  await api.guilds.banUser(message.guild_id, message.author.id);
                }
                console.log(`✅ ${message.author.username} has been banned`);
                
                // Send ban DM
                try {
                  const dmChannel = await api.users.createDM(message.author.id);
                  const banEmbed = {
                    title: '🔨 You Have Been Banned',
                    description: `You have been permanently banned from the server for violating community guidelines.`,
                    color: 15158332,
                    fields: [
                      { name: '❌ Reason', value: `${violationCount} infractions (auto-mod)` },
                      { name: '⚠️ Next Step', value: 'You cannot rejoin this server' }
                    ],
                    timestamp: new Date().toISOString()
                  };
                  await api.channels.createMessage(dmChannel.id, { embeds: [banEmbed] });
                } catch (e) {
                  console.warn('Could not DM banned user');
                }
                
              } else if (punishment === 'kick') {
                // Kick the user
                await api.guilds.removeMember(message.guild_id, message.author.id);
                console.log(`✅ ${message.author.username} has been kicked`);
                
                // Send kick DM
                try {
                  const dmChannel = await api.users.createDM(message.author.id);
                  const kickEmbed = {
                    title: '👢 You Have Been Kicked',
                    description: `You have been removed from the server for violating community guidelines.`,
                    color: 15105570,
                    fields: [
                      { name: '❌ Reason', value: `${violationCount} infractions (auto-mod)` },
                      { name: '⚠️ Next Step', value: 'You can rejoin the server with a new invite' }
                    ],
                    timestamp: new Date().toISOString()
                  };
                  await api.channels.createMessage(dmChannel.id, { embeds: [kickEmbed] });
                } catch (e) {
                  console.warn('Could not DM kicked user');
                }
                
              } else if (punishment === 'mute') {
                // Mute the user
                const until = new Date(Date.now() + punishmentTime).toISOString();
                await api.guilds.editMember(message.guild_id, message.author.id, {
                  communication_disabled_until: until
                });
                const minutes = punishmentTime / 1000 / 60;
                console.log(`✅ ${message.author.username} has been muted for ${minutes} minutes`);
                
                // Send mute DM
                try {
                  const dmChannel = await api.users.createDM(message.author.id);
                  const muteEmbed = {
                    title: '🔇 You Have Been Muted',
                    description: `You have been muted for violating community guidelines.`,
                    color: 9807270,
                    fields: [
                      { name: '❌ Reason', value: `${violationCount} infractions (auto-mod)` },
                      { name: '⏱️ Duration', value: `${minutes} minute(s)` },
                      { name: '⚠️ Next Step', value: `You will be able to chat again after the mute expires` }
                    ],
                    timestamp: new Date().toISOString()
                  };
                  await api.channels.createMessage(dmChannel.id, { embeds: [muteEmbed] });
                } catch (e) {
                  console.warn('Could not DM muted user');
                }
              }
            } catch (punishErr) {
              console.error(`❌ Failed to apply ${punishment}:`, punishErr.message);
            }
          }
        } catch (e) {
          console.error('Error adding infraction:', e.message);
        }
        // Log message removal to mod channel (with punishment info if applied)
        if (settings.log_channel) {
          try {
            const severityIcon = modResult.severity === 'CRITICAL' ? '🚨' : 
                                modResult.severity === 'HIGH' ? '⚠️' : '📋';
            
            const infractions = await db.getUserInfractions(message.author.id, message.guild_id, 100);
            const violationCount = infractions.length;
            
            // Determine what punishment was/will be applied
            let punishmentText = 'None (Warning only)';
            const accountAgeMs = message.author.created_timestamp ? Date.now() - message.author.created_timestamp : Date.now();
            const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
            const isNewUser = accountAgeMs && accountAgeDays < 7;
            
            if (isNewUser) {
              if (violationCount >= 10) punishmentText = 'Ban';
              else if (violationCount >= 5) punishmentText = 'Kick';
              else if (violationCount >= 2) punishmentText = '10-min Mute';
            } else {
              if (violationCount >= 20) punishmentText = 'Ban';
              else if (violationCount >= 10) punishmentText = 'Kick';
              else if (violationCount >= 5) punishmentText = '1-hour Mute';
              else if (violationCount >= 3) punishmentText = '10-min Mute';
            }
            
            const logEmbed = {
              title: `${severityIcon} Message Removed`,
              description: `A message was removed for violating community guidelines`,
              color: modResult.severity === 'CRITICAL' ? 15158332 : modResult.severity === 'HIGH' ? 15105570 : 9807270,
              fields: [
                { name: '👤 User', value: `${message.author.username} (${message.author.id})`, inline: true },
                { name: '❌ Reason', value: modResult.reason, inline: true },
                { name: '📊 Total Infractions', value: `${violationCount}`, inline: true },
                { name: '🔨 Punishment Applied', value: punishmentText, inline: true },
                { name: '📝 Message Content', value: `\`\`\`${message.content.substring(0, 100)}\`\`\`` }
              ],
              footer: { text: 'Auto-moderation' },
              timestamp: new Date().toISOString()
            };
            
            await api.channels.createMessage(settings.log_channel, { embeds: [logEmbed] });
          } catch (e) {
            console.error('Error logging to mod channel:', e.message);
          }
        }
      }

      // ==================== IMAGE MODERATION ====================
      // Disabled for now - Fluxer message structure differs from Discord.js
      // Re-enable after understanding Fluxer's attachment handling
      /*
      try {
        const imageResult = await imageDetector.moderateImage(message, api, db);
        
        if (imageResult.hasImages && !imageResult.safe) {
          console.log(`🚫 NSFW Image detected: ${message.author.username}`);
        }
      } catch (error) {
        console.error('Error in image moderation:', error.message);
      }
      */
    } catch (error) {
      console.error('Error in auto-moderation:', error.message);
    }
  } catch (error) {
    console.error('Error in message handler:', error.message);
  }
});

client.on(GatewayDispatchEvents.GuildMemberAdd, async ({ api, data }) => {
  try {
    await db.recordUserJoin(data.user.id, data.guild_id);
    console.log(`✅ Recorded join: ${data.user.username} in guild ${data.guild_id}`);
  } catch (error) {
    console.error('Error recording user join:', error.message);
  }
});

// ==================== STARTUP ====================
async function start() {
  try {
    console.log('🚀 Starting PrismGuardian...\n');
    
    // Load commands
    await loadCommands();
    
    // Connect to gateway
    await gateway.connect();
  } catch (error) {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

start();

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await db.close();
  gateway.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await db.close();
  gateway.destroy();
  process.exit(0);
});

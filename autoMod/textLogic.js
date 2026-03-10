// autoMod/textLogic.js - AI Moderation Pipeline with Reactions

const db = require('../db');

// ==================== CATEGORY-BASED REGEX ====================
const HATE_SPEECH_SLURS = [
  'nigger', 'nigga', 'chink', 'kike', 'spic', 'gook', 'wetback',
  'beaner', 'paki', 'faggot', 'fag', 'tranny', 'retard',
];

const RACIST_TERMS = [
  'racist', 'supremacist', 'aryan',
];

const PROFANITY = [
  'shit', 'damn', 'crap', 'piss', 'dick', 'asshole', 'bitch',
];

const SENSITIVE_DATA_PATTERNS = [
  /\b[A-Za-z0-9_]{20,}\b/,
  /sk-[A-Za-z0-9]{20,}/i,
  /AKIA[0-9A-Z]{16}/,
];

// ==================== TOXIC-BERT CONFIG ====================
const TOXIC_BERT_THRESHOLDS = {
  identity_hate: 0.05,
  toxic: 0.2,
  severe_toxicity: 0.1,
  obscene: 0.05,
  insult: 0.05,
  threat: 0.05,
  sexually_explicit: 0.1,
  profanity: 0.1,
};

// ==================== GROQ BATCH PROCESSING ====================
let messageQueue = [];
let isProcessing = false;
const BATCH_SIZE = 10;
const BATCH_TIMEOUT = 5000;
let batchTimer = null;

async function flushGroqBatch() {
  if (messageQueue.length === 0 || isProcessing) return;

  isProcessing = true;
  const batch = messageQueue.splice(0, BATCH_SIZE);

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY not set');
      isProcessing = false;
      return;
    }

    const moderationPrompt = `You are a content moderator. Classify each message as SAFE or one violation type only.

Return ONLY valid JSON with no markdown:
{"msg1": {"primary": "safe", "conf": 0.95}, "msg2": {"primary": "profanity", "conf": 0.65}}

Violation types: safe, profanity, spam, sexual, nsfw, racist, hate_speech
Return ONE type in "primary" field only. Be conservative - when unsure, return "safe".

${batch.map((m, i) => `M${i + 1}: ${m.content}`).join('\n')}`;

    const payload = {
      messages: [{ role: 'user', content: moderationPrompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      max_tokens: 1500,
      top_p: 1,
      stream: false,
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`❌ Groq API error: ${response.status}`);
      isProcessing = false;
      return;
    }

    const data = await response.json();
    console.log(`✅ Groq API responded`);

    if (data.error) {
      console.error(`❌ Groq error: ${data.error.message}`);
      isProcessing = false;
      return;
    }

    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`⚠️ No JSON in Groq response`);
      isProcessing = false;
      return;
    }

    const results = JSON.parse(jsonMatch[0]);
    const usersViolatedInBatch = new Set();

    for (const [key, res] of Object.entries(results)) {
      const msgIndex = parseInt(key.replace('msg', '')) - 1;
      const msg = batch[msgIndex];

      if (!msg || res.primary === 'safe' || !res.primary) {
        console.log(`[GROQ] Message ${key}: ${res.primary} - SKIPPED`);
        continue;
      }

      console.log(`[GROQ] Message ${key}: ${res.primary} (conf: ${res.conf}) - VIOLATION`);

      if (usersViolatedInBatch.has(msg.userId)) {
        console.log(`⏭️ Skip duplicate for ${msg.userId}`);
        continue;
      }

      const settings = await msg.db.getModerationsSettings(msg.guildId);
      let shouldBlock = false;
      let violationType = null;

      const primaryViolation = res.primary.split('|')[0].trim();

      switch(primaryViolation) {
        case 'profanity':
          if (settings.profanity) {
            shouldBlock = true;
            violationType = 'Profanity';
          }
          break;
        case 'spam':
          if (settings.spam) {
            shouldBlock = true;
            violationType = 'Spam';
          }
          break;
        case 'sexual':
          if (settings.sexual) {
            shouldBlock = true;
            violationType = 'Sexual content';
          }
          break;
        case 'nsfw':
          if (settings.nsfw) {
            shouldBlock = true;
            violationType = 'NSFW content';
          }
          break;
        case 'racist':
          if (settings.racist) {
            shouldBlock = true;
            violationType = 'Racist content';
          }
          break;
        case 'hate_speech':
          if (settings.hate) {
            shouldBlock = true;
            violationType = 'Hate speech';
          }
          break;
      }

      if (shouldBlock) {
        usersViolatedInBatch.add(msg.userId);
        console.log(`🚫 Violation: ${msg.userId} - ${violationType}`);

        const freshSettings = await msg.db.getModerationsSettings(msg.guildId);

        // ===== APPROVAL MODE =====
        if (freshSettings.ai_approval_mode) {
          console.log(`📋 Approval mode - flagging message`);

          try {
            const flagResult = await msg.db.flagMessage(
              msg.guildId,
              msg.channelId,
              msg.id,
              msg.userId,
              msg.content,
              5,
              violationType,
              { groq_confidence: res.conf, ai_service: 'groq' }
            );

            const flagId = flagResult?.id || 'unknown';
            console.log(`✅ Flagged with ID: ${flagId}`);

            // Log to mod channel
            if (freshSettings.log_channel) {
              const logMsg = await msg.api.channels.createMessage(freshSettings.log_channel, {
                embeds: [{
                  title: '🚩 Message Flagged for Review',
                  description: `User: <@${msg.userId}> | Flag ID: **${flagId}**`,
                  color: 15105570,
                  fields: [
                    { name: 'Reason', value: violationType, inline: true },
                    { name: 'Confidence', value: `${(res.conf * 100).toFixed(0)}%`, inline: true },
                    { name: 'Channel', value: `<#${msg.channelId}>`, inline: true },
                    { name: 'Content', value: `\`\`\`${msg.content.substring(0, 100)}\`\`\`` }
                  ],
                  footer: { text: `Flag ID: ${flagId} | React ✅ to approve or ❌ to disapprove` },
                  timestamp: new Date().toISOString()
                }]
              });

              // Add reactions
              try {
                await msg.api.channels.createReaction(freshSettings.log_channel, logMsg.id, '✅');
                await msg.api.channels.createReaction(freshSettings.log_channel, logMsg.id, '❌');
                console.log(`✅ Reactions added`);
              } catch (e) {
                console.warn('Reaction error:', e.message);
              }
            }
          } catch (error) {
            console.error('Flag error:', error.message);
          }
        } else {
          // ===== NORMAL MODE - DELETE & PUNISH =====
          console.log(`🔨 Deleting message...`);
          try {
            await msg.api.channels.deleteMessage(msg.channelId, msg.id);
            console.log(`✅ Deleted`);
          } catch (e) {
            console.warn('Delete error:', e.message);
          }

          try {
            await msg.db.addInfraction(msg.userId, msg.guildId, 'automod', violationType, 'bot_automod', true);
            console.log(`✅ Infraction added`);
          } catch (e) {
            console.error('Infraction error:', e.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Groq batch error:', error.message);
  } finally {
    isProcessing = false;
  }
}

function queueForGroq(msgData) {
  messageQueue.push(msgData);
  console.log(`📤 Queued (${messageQueue.length}/${BATCH_SIZE})`);

  if (batchTimer) clearTimeout(batchTimer);

  if (messageQueue.length >= BATCH_SIZE) {
    flushGroqBatch();
  } else {
    batchTimer = setTimeout(flushGroqBatch, BATCH_TIMEOUT);
  }
}

// ==================== HELPER FUNCTIONS ====================

function checkSensitiveData(content) {
  for (const pattern of SENSITIVE_DATA_PATTERNS) {
    if (pattern.test(content)) {
      return [{ type: 'Sensitive data detected' }];
    }
  }
  return [];
}

function checkCustomKeywords(content, keywords) {
  for (const keyword of keywords) {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      return { reason: `Custom keyword: ${keyword}` };
    }
  }
  return null;
}

function checkRegexByCategory(content, settings) {
  const text = content.toLowerCase();

  if (settings.hate && HATE_SPEECH_SLURS.some(s => text.includes(s))) {
    return { reason: 'Hate speech detected', category: 'hate' };
  }
  if (settings.racist && RACIST_TERMS.some(s => text.includes(s))) {
    return { reason: 'Racist content detected', category: 'racist' };
  }
  if (settings.profanity && PROFANITY.some(s => text.includes(s))) {
    return { reason: 'Profanity detected', category: 'profanity' };
  }

  return null;
}

async function deleteMessageWithRetry(api, channelId, messageId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await api.channels.deleteMessage(channelId, messageId);
      return true;
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Failed to delete after ${retries} retries:`, error.message);
        return false;
      }
      await new Promise(r => setTimeout(r, 100 * (i + 1)));
    }
  }
}

// ==================== MAIN ENTRY POINT ====================
async function moderateText(message, api, db) {
  const text = message.content;
  const settings = await db.getModerationsSettings(message.guild_id);

  if (!settings) {
    return { safe: true };
  }

  // ===== STEP 1: SENSITIVE DATA =====
  const sensitiveFindings = checkSensitiveData(message.content);
  if (sensitiveFindings.length > 0) {
    await deleteMessageWithRetry(api, message.channel_id, message.id);
    return { safe: false, reason: 'Sensitive data', severity: 'CRITICAL' };
  }

  // ===== STEP 2: CUSTOM KEYWORDS =====
  if (settings.keywords && settings.keywords.length > 0) {
    const keywordViolation = checkCustomKeywords(message.content, settings.keywords);
    if (keywordViolation) {
      await deleteMessageWithRetry(api, message.channel_id, message.id);
      await db.addInfraction(message.author.id, message.guild_id, 'warning', keywordViolation.reason, 'bot_automod', true).catch(() => null);
      return { safe: false, reason: keywordViolation.reason };
    }
  }

  // ===== STEP 3: REGEX CHECK =====
  const regexViolation = checkRegexByCategory(message.content, settings);
  if (regexViolation) {
    await deleteMessageWithRetry(api, message.channel_id, message.id);
    await db.addInfraction(message.author.id, message.guild_id, 'warning', regexViolation.reason, 'bot_automod', true).catch(() => null);
    return { safe: false, reason: regexViolation.reason };
  }

  // ===== STEP 4: AI MODERATION (GROQ) =====
  if (settings.ai_enabled) {
    try {
      // Check channel override
      const channelOverride = await db.getChannelOverride(message.guild_id, message.channel_id);
      if (channelOverride && !channelOverride.ai_enabled) {
        console.log(`⏭️ AI disabled in this channel`);
        return { safe: true };
      }

      const guildAge = await db.getUserGuildAge(message.author.id, message.guild_id);
      const isNewUser = guildAge < (settings.ai_new_user_threshold || 7);
      const shouldAnalyze = settings.ai_new_user_threshold === 0 || isNewUser;

      if (shouldAnalyze) {
        queueForGroq({
          id: message.id,
          userId: message.author.id,
          guildId: message.guild_id,
          channelId: message.channel_id,
          content: message.content,
          api,
          db
        });
      }
    } catch (error) {
      console.error('AI moderation error:', error.message);
    }
  }

  return { safe: true };
}

module.exports = { moderateText };

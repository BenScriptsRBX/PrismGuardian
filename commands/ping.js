// commands/ping.js - Example command

module.exports = {
    name: 'ping',
    aliases: ['p'],
    description: 'Check bot latency',
    execute: async ({ api, message, args, prefix }) => {
      const now = Date.now();
      
      const msg = await api.channels.createMessage(message.channel_id, {
        content: '🏓 Pong!',
      });
      
      const latency = Date.now() - now;
      
      await api.channels.editMessage(message.channel_id, msg.id, {
        content: `🏓 Pong! (\`${latency}ms\`)`,
      });
    },
  };
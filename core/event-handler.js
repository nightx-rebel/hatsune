import logger from '../lib/logger.js';
import serializeMessage from './serializer.js';
import { handleMessage } from './message-handler.js';

export async function registerEventHandlers(manager, pluginSystem) {
  manager.events.on('user:connected', ({ userId, socket }) => {
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        if (!message.message || message.key.fromMe) continue;
        const client = { sendMessage: async (jid, content, options = {}) => {
          await manager.sendMessage(userId, jid, content, options);
        } };
        const serialized = serializeMessage(message, client, socket, userId);
        try {
          await handleMessage(serialized, pluginSystem);
        } catch (error) {
          logger.error('Message handling failed', 'EVENT', { userId, error: error.message || String(error) });
        }
      }
    });
  });
}

export default registerEventHandlers;

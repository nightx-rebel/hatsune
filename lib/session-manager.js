import { createAuthStore, MultiSocketManager } from 'wa-multi-socket';
import { config } from '../config.js';
import logger from './logger.js';

const manager = new MultiSocketManager({
  authStore: createAuthStore(config.database.authStoreUrl || 'sqlite://./data/wa-auth.sqlite'),
  reconnect: config.session.reconnect,
  maxReconnectAttempts: config.session.retries,
  pairingTimeoutMs: config.runtime.pairingTimeout,
  socketConfig: {
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  },
  maxConcurrentConnections: 25,
  maxConcurrentPairings: 5,
  sendIntervalMs: 500,
  maxQueuedMessagesPerUser: 100,
});

manager.events.on('manager:error', ({ userId, error }) => {
  logger.error(`MultiSocketManager error for ${userId || 'global'}`, 'SESSION', error);
});

manager.events.on('user:pairing-code', ({ userId, pairingCode }) => {
  logger.info(`Pairing code created for ${userId}`, 'SESSION', { pairingCode });
});

manager.events.on('user:connected', ({ userId, socket }) => {
  logger.info(`Session connected: ${userId}`, 'SESSION', { socketId: socket?.user?.id || 'unknown' });
});

manager.events.on('user:disconnect', ({ userId, reason }) => {
  logger.warn(`Session disconnected: ${userId}`, 'SESSION', { reason });
});

export async function startSessionManager() {
  await manager.start();
  return manager;
}

export async function addSessionUser(userId, options = {}) {
  const result = await manager.addUser(userId, options);
  return result;
}

export async function getSessionStatus(userId) {
  const status = manager.getUserStatus?.(userId) ?? 'offline';
  return status;
}

export async function sendSessionMessage(userId, jid, content, opts = {}) {
  await manager.sendMessage(userId, jid, content, opts);
}

export async function closeSessionManager() {
  await manager.close();
}

export { manager };
export default manager;

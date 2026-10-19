import { manager } from '../lib/session-manager.js';

export class WhatsAppClient {
  constructor(userId) {
    this.userId = userId;
    this.manager = manager;
  }

  async sendMessage(jid, content, options = {}) {
    await this.manager.sendMessage(this.userId, jid, content, options);
  }

  async getSocket() {
    return this.manager.getSocket?.(this.userId) ?? null;
  }

  async getStatus() {
    return this.manager.getUserStatus?.(this.userId) ?? 'offline';
  }
}

export default WhatsAppClient;

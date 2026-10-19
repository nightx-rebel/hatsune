import { config } from '../config.js';
import logger from '../lib/logger.js';
import { matchCommand } from './command-handler.js';

export async function handleMessage(msg, pluginSystem) {
  const prefix = config.prefix || '!';
  const parsed = matchCommand(pluginSystem.commands || new Map(), msg.body, prefix);

  if (parsed && typeof parsed.handler === 'function') {
    try {
      await parsed.handler({ ...msg, args: parsed.args, command: parsed.command, prefix });
      return true;
    } catch (error) {
      const message = error?.message || String(error);
      logger.error('Plugin command execution failed', 'MESSAGE', { command: parsed.command, message });
      await msg.reply(`Command failed: ${message}`);
      return false;
    }
  }

  for (const entry of pluginSystem.all || []) {
    try {
      const handled = await entry.exec(msg, { config, logger });
      if (handled) return true;
    } catch (error) {
      logger.error('Plugin execution failed', 'MESSAGE', { error: String(error) });
    }
  }

  return false;
}

export default handleMessage;

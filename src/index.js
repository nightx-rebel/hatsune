import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config.js';
import { initializePlugins, pluginSystem } from '../core/plugin-loader.js';
import { registerEventHandlers } from '../core/event-handler.js';
import { manager, startSessionManager, addSessionUser, closeSessionManager } from '../lib/session-manager.js';
import AppDatabase from '../lib/database.js';
import logger from '../lib/logger.js';
import { startPairApi } from './express-pair.js';

const database = new AppDatabase(config.database.path);
const userChatMap = new Map();
const pendingUserIds = new Map();

const normaliseWhatsappNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('62') ? `+${digits}` : `+${digits}`;
};

const getTelegramPairState = (chatId) => {
  const row = database.getUserByTelegramChat(chatId);
  return row ? { paired: true, userId: row.id, phone: row.whatsapp_number } : { paired: false, userId: null, phone: null };
};

const normalizePairCode = (value) => {
  const code = String(value || '').trim();
  if (!code) return undefined;
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '');
  if (cleaned.length === 0) return undefined;
  if (cleaned.length >= 8) return cleaned.slice(0, 8);
  return cleaned.padStart(8, '0');
};

const parsePairInput = (text) => {
  const clean = String(text || '').trim();
  const tokens = clean.split(/\s+/g).filter(Boolean);
  if (tokens.length === 0) return null;
  const maybePhone = tokens[0].startsWith('+') || /^\d{8,15}$/.test(tokens[0]) ? tokens[0] : null;
  const maybeCode = tokens.length > 1 && /^\d{4,8}$/.test(tokens[tokens.length - 1]) ? tokens[tokens.length - 1] : null;

  const phone = maybePhone || (tokens.length > 1 && /^\d{8,15}$/.test(tokens[1]) ? tokens[1] : null);
  const code = maybeCode || (tokens.length > 2 ? tokens[2] : null);

  if (!phone || !code || !/^\d{4,8}$/.test(code)) {
    return null;
  }

  return { phone: normaliseWhatsappNumber(phone), code: normalizePairCode(code) };
};

const startBot = async () => {
  const token = config.telegramBotToken;
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram pairing interface disabled.', 'BOOT');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, async (msg) => {
    const chatId = String(msg.chat.id);
    const state = getTelegramPairState(chatId);

    if (state.paired) {
      await bot.sendMessage(chatId, `This Telegram chat is already paired to WhatsApp number: ${state.phone}`);
      return;
    }

    await bot.sendMessage(
      chatId,
      'Telegram is locked until a WhatsApp session is paired. Use the Express route: /pair?phone=6281234567890&code=3939399 or send: /pair 6281234567890 3939399',
    );
    userChatMap.set(chatId, { waitingForNumber: true });
  });

  bot.onText(/\/pair(?:\s+.*)?/, async (msg, match) => {
    const chatId = String(msg.chat.id);
    const state = getTelegramPairState(chatId);
    if (state.paired) {
      await bot.sendMessage(chatId, `Already paired to ${state.phone}.`);
      return;
    }

    const input = match && match[0] ? match[0].replace(/^\/pair\s*/, '').trim() : '';
    const parsed = input ? parsePairInput(input) : null;

    if (!parsed) {
      await bot.sendMessage(chatId, 'To pair, send: /pair 6281234567890 3939399\nOr use the HTTP endpoint: /pair?phone=6281234567890&code=3939399');
      userChatMap.set(chatId, { waitingForNumber: true });
      return;
    }

    const userId = `tg-${chatId}-${Date.now()}`;
    pendingUserIds.set(userId, chatId);
    try {
      const result = await addSessionUser(userId, {
        phoneNumber: parsed.phone,
        pairingCode: parsed.code,
      });

      if (result?.pairingCode) {
        await bot.sendMessage(chatId, `Your pairing code is: ${result.pairingCode}\nOpen WhatsApp > Linked devices > Link with phone number and enter this code.`);
        database.saveUser({
          id: userId,
          telegram_chat_id: chatId,
          whatsapp_number: parsed.phone,
          owner: 0,
        });
      } else {
        await bot.sendMessage(chatId, 'A session is being prepared. Please wait a few moments and try again.');
      }
    } catch (error) {
      logger.error('Telegram pairing failed', 'BOT', { chatId, error: error.message || String(error) });
      await bot.sendMessage(chatId, 'Pairing failed. Please try again later.');
    }
  });

  bot.on('message', async (msg) => {
    const chatId = String(msg.chat.id);
    const state = getTelegramPairState(chatId);
    if (state.paired || !msg.text) return;

    const pairData = parsePairInput(msg.text);
    if (!pairData) {
      if (userChatMap.get(chatId)?.waitingForNumber) {
        await bot.sendMessage(chatId, 'Send a phone number and code in this format: 6281234567890 3939399');
      }
      return;
    }

    if (!userChatMap.has(chatId) || !userChatMap.get(chatId)?.waitingForNumber) {
      return;
    }

    const userId = `tg-${chatId}-${Date.now()}`;
    userChatMap.set(chatId, { waitingForNumber: false, userId, phone: pairData.phone });
    pendingUserIds.set(userId, chatId);

    try {
      const result = await addSessionUser(userId, {
        phoneNumber: pairData.phone,
        pairingCode: pairData.code,
      });

      if (result?.pairingCode) {
        await bot.sendMessage(chatId, `Your pairing code is: ${result.pairingCode}\nOpen WhatsApp > Linked devices > Link with phone number and enter this code.`);
        database.saveUser({
          id: userId,
          telegram_chat_id: chatId,
          whatsapp_number: pairData.phone,
          owner: 0,
        });
      } else {
        await bot.sendMessage(chatId, 'Pairing is in progress. Wait a bit and try again.');
      }
    } catch (error) {
      logger.error('Telegram pairing failed', 'BOT', { chatId, error: error.message || String(error) });
      await bot.sendMessage(chatId, 'Pairing failed. Please try again later.');
    }
  });

  manager.events.on('user:pairing-code', ({ userId, pairingCode }) => {
    const chatId = pendingUserIds.get(userId);
    if (chatId) {
      bot.sendMessage(chatId, `Pairing code for ${userId}: ${pairingCode}`);
    }
  });

  logger.info('Telegram bot started and listening for pairing requests.', 'BOOT');
};

const start = async () => {
  try {
    await startSessionManager();
    await initializePlugins();
    registerEventHandlers(manager, pluginSystem);
    startPairApi();
    await startBot();
    logger.info('Hatsune application started successfully.', 'BOOT');
  } catch (error) {
    logger.error('Application startup failed', 'BOOT', { error: error.message || String(error) });
    process.exitCode = 1;
  }
};

const shutdown = async () => {
  logger.info('Shutting down Hatsune.', 'BOOT');
  try {
    await closeSessionManager();
    database.close();
  } catch (error) {
    logger.error('Shutdown failed.', 'BOOT', { error: error.message || String(error) });
  }
  process.exit(0);
};

process.on('SIGINT', () => { shutdown(); });
process.on('SIGTERM', () => { shutdown(); });

start();

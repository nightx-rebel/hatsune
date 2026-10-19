import { Module } from '../core/plugin-loader.js';

export const commands = new Map();
commands.set('ping', async ({ reply }) => {
  await reply('pong 🏓');
});
commands.set('menu', async ({ reply }) => {
  await reply('Available commands:\n!ping\n!status\n!help');
});
commands.set('help', async ({ reply }) => {
  await reply('Hatsune commands:\n!ping\n!status\n!menu');
});

export default Module({
  name: 'ping',
  type: 'all',
})((msg) => {
  const body = String(msg.body || '').trim();
  if (body === '!ping') {
    return msg.reply('pong 🏓');
  }
  if (body === '!status') {
    return msg.reply('Bot is healthy and ready.');
  }
  return false;
});

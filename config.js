import dotenv from 'dotenv';

dotenv.config();

export const config = {
  botName: process.env.BOT_NAME || 'Hatsune',
  prefix: process.env.PREFIX || '!',
  owner: process.env.OWNER || 'your-telegram-username',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    path: process.env.DB_PATH || './data/hatsune.db',
    authStoreUrl: process.env.WA_AUTH_DATABASE_URL || 'sqlite://./data/wa-auth.sqlite'
  },
  runtime: {
    pairingTimeout: Number(process.env.PAIRING_TIMEOUT || 180000),
    apiPort: Number(process.env.API_PORT || 3000),
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  pairing: {
    enabled: process.env.PAIRING_ENABLED !== 'false',
    codeLength: Number(process.env.PAIRING_CODE_LENGTH || 6),
    requireOwner: process.env.REQUIRE_OWNER === 'true'
  },
  plugins: {
    enabled: true,
    forceReload: false,
    directory: './plugins'
  },
  session: {
    defaultName: process.env.DEFAULT_SESSION_NAME || 'default',
    reconnect: process.env.RECONNECT !== 'false',
    retries: Number(process.env.MAX_RETRIES || 5)
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW || 60000),
    max: Number(process.env.RATE_LIMIT_MAX || 40)
  },
  cache: {
    maxItems: Number(process.env.CACHE_MAX_ITEMS || 5000)
  }
};

export default config;

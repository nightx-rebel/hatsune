# Hatsune

<div align="center">

### A modular, multi-user WhatsApp bot with Telegram pairing

Built on the official Baileys package and [`wa-multi-socket`](https://github.com/nightx-rebel/wa-multi-socket).

[Getting started](#-getting-started) · [Pairing API](#-pair-a-whatsapp-account) · [Configuration](#-configuration) · [Plugins](#-plugins)

</div>

---

Hatsune provides a Telegram pairing interface, an HTTP pairing API, and a plugin-oriented message-processing core. WhatsApp authentication, sockets, reconnects, and session lifecycle are delegated to the upstream `wa-multi-socket` manager; Hatsune does not implement a second session manager.

> [!IMPORTANT]
> WhatsApp session credentials are highly sensitive. Keep `.env`, the `data/` directory, and database backups private. The pairing endpoint can create sessions and should only be exposed on a trusted network or behind suitable access controls.

## ✨ Highlights

- **Multi-session foundation** — upstream manager handles WhatsApp sockets, auth persistence, reconnection, pairing, and queued sends.
- **Two pairing surfaces** — an Express API and an optional Telegram bot.
- **Modular message pipeline** — serialization, event dispatch, command routing, and plugins are separated under `core/`.
- **Persistent application data** — SQLite stores application metadata; the upstream manager stores WhatsApp auth state separately.
- **Operational basics** — configurable logging, graceful shutdown hooks, and a health endpoint.

## 🧰 Requirements

- Node.js **22.13 or newer** (required by `wa-multi-socket`)
- npm
- Git (used during installation to fetch and build the pinned upstream manager)
- A Telegram bot token if you want Telegram pairing

## 🚀 Getting started

```bash
git clone https://github.com/nightx-rebel/hatsune.git
cd hatsune
npm install
cp .env.example .env
```

Set `TELEGRAM_BOT_TOKEN` in `.env` to enable the Telegram interface. It may be left blank when using the HTTP pairing API only.

Start Hatsune:

```bash
npm start
```

For development with Node's file watcher:

```bash
npm run dev
```

The `npm install` post-install step builds the pinned `wa-multi-socket` source into `node_modules`. Its build checkout is temporary and is not committed to this repository.

## 🔗 Pair a WhatsApp account

The pairing API listens on `API_PORT` (default `3000`).

### HTTP GET

```text
GET /pair?phone=6281234567890&code=3939399
```

Optional `userId` lets you choose a stable upstream session ID:

```text
GET /pair?phone=6281234567890&code=3939399&userId=customer-42
```

### HTTP POST

```bash
curl -X POST http://localhost:3000/pair \
  -H 'content-type: application/json' \
  -d '{"phone":"6281234567890","code":"3939399","userId":"customer-42"}'
```

The response includes the session ID, status, and pairing code. The upstream module requires custom pairing codes to be exactly eight alphanumeric characters; Hatsune normalizes shorter numeric values by padding them on the left (for example, `3939399` becomes `03939399`). Enter the returned code in WhatsApp under **Settings → Linked devices → Link with phone number**.

### API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Basic process health response |
| `GET` | `/pair` | Start a pairing request using query parameters |
| `POST` | `/pair` | Start a pairing request using a JSON body |
| `GET` | `/pair-status?userId=...` | Read the in-memory pairing request status |

`/pair-status` currently reports the API process's in-memory request state; it is cleared on restart and is not a durable WhatsApp connection-status API.

## 🤖 Telegram pairing

Telegram is optional. When `TELEGRAM_BOT_TOKEN` is set, the bot starts alongside the Express API:

1. Send `/start` to the Telegram bot.
2. Follow the prompt to submit `/pair <international-phone> <numeric-code>`.
3. Use the returned pairing code in WhatsApp's linked-device flow.

If the token is empty, the Telegram interface stays disabled while the Express API can still run. Telegram is used for pairing interaction only; Hatsune does not include payment, subscription, or paid-membership features.

## ⚙️ Configuration

Copy `.env.example` to `.env`. Environment variables override the defaults in `config.js`.

| Variable | Default | Description |
| --- | --- | --- |
| `BOT_NAME` | `Hatsune` | Display name |
| `PREFIX` | `!` | WhatsApp command prefix |
| `OWNER` | `your_telegram_username` | Owner setting |
| `TELEGRAM_BOT_TOKEN` | empty | Enables Telegram pairing when set |
| `DB_TYPE` | `sqlite` | Application database type setting |
| `DB_PATH` | `./data/hatsune.db` | Application metadata database path |
| `WA_AUTH_DATABASE_URL` | `sqlite://./data/wa-auth.sqlite` | Upstream WhatsApp auth store URL |
| `API_PORT` | `3000` | Express API listen port |
| `PAIRING_ENABLED` | `true` | Pairing setting |
| `PAIRING_TIMEOUT` | `180000` | Pairing timeout in milliseconds |
| `PAIRING_CODE_LENGTH` | `6` | Pairing configuration setting |
| `REQUIRE_OWNER` | `false` | Owner restriction setting |
| `RECONNECT` | `true` | Enable upstream session reconnects |
| `MAX_RETRIES` | `5` | Upstream reconnect-attempt setting |
| `DEFAULT_SESSION_NAME` | `default` | Default session name setting |
| `LOG_LEVEL` | `info` | Log verbosity |
| `RATE_LIMIT_WINDOW` | `60000` | Configured rate-limit window in milliseconds |
| `RATE_LIMIT_MAX` | `40` | Configured rate-limit maximum |
| `CACHE_MAX_ITEMS` | `5000` | In-memory cache capacity |

For PostgreSQL auth storage, set `WA_AUTH_DATABASE_URL` to a `postgres://` or `postgresql://` connection URL. The upstream manager supports SQLite and PostgreSQL URLs. Keep credentials out of source control.

## 🧩 Plugins and architecture

```text
.
├── core/       # Client helpers, serializer, event/message/command handling, plugins
├── lib/        # Session manager adapter, database, cache, logger
├── plugins/    # Bot commands and feature plugins
├── src/        # Application and Express API entrypoints
├── data/       # Local databases and runtime state (ignored by Git)
├── temp/       # Logs and build/runtime scratch files (ignored by Git)
└── vendor/     # Local upstream build checkout (ignored by Git)
```

Plugins are loaded from `plugins/`. The current example includes `!ping`, `!menu`, `!help`, and `!status`. Use the existing registration pattern in `core/plugin-loader.js` when adding commands or message handlers.

## 🗃️ Storage

Hatsune keeps two kinds of data in separate stores:

- **Application metadata:** SQLite at `DB_PATH`.
- **WhatsApp credentials and Signal keys:** the upstream manager's auth store at `WA_AUTH_DATABASE_URL`.

The default database files are created under `data/`, which is intentionally excluded from Git. Back them up securely if session persistence is required.

## ✅ Checks

```bash
npm run check
```

This performs JavaScript syntax checks. It does not replace live WhatsApp pairing tests, load tests, or deployment-specific monitoring.

## 📈 Capacity and production readiness

The manager provides connection and send-queue controls, but actual capacity depends on host resources, network quality, database configuration, WhatsApp limits, and workload. **No 1,000+ concurrent-session capacity is claimed without representative load testing.**

Before public deployment, put the pairing API behind trusted access controls, configure TLS at the proxy, monitor resource usage, and test reconnect and shutdown behavior with the intended database and workload.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

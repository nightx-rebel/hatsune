import express from 'express';
import { config } from '../config.js';
import { addSessionUser } from '../lib/session-manager.js';

const app = express();
app.use(express.json());

const pendingPairs = new Map();

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('62') ? `+${digits}` : `+${digits}`;
};

const normalizePairCode = (value) => {
  const code = String(value || '').trim();
  if (!code) return undefined;
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '');
  if (cleaned.length === 0) return undefined;
  if (cleaned.length >= 8) return cleaned.slice(0, 8);
  return cleaned.padStart(8, '0');
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'hatsune', status: 'running' });
});

const pairUser = async ({ phone, userId, code, res }) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ ok: false, message: 'phone is required' });
  }

  const normalizedUserId = String(userId || `web-${Date.now()}`).trim();
  const normalizedCode = normalizePairCode(code);

  try {
    const result = await addSessionUser(normalizedUserId, {
      phoneNumber: normalizedPhone,
      pairingCode: normalizedCode,
    });

    const pairingCode = result?.pairingCode || normalizedCode || null;
    pendingPairs.set(normalizedUserId, {
      phone: normalizedPhone,
      status: 'pairing',
      pairingCode,
    });

    return res.json({
      ok: true,
      userId: normalizedUserId,
      phone: normalizedPhone,
      status: 'pairing',
      pairingCode,
      socket: !!result?.socket,
      needsScan: !result?.pairingCode,
      hint: 'Open WhatsApp > Linked devices > Link with phone number and use the pairing code above.',
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message || 'Pairing failed' });
  }
};

app.get('/pair', async (req, res) => {
  const { code, phone, userId } = req.query;
  return pairUser({ phone, userId, code, res });
});

app.post('/pair', async (req, res) => {
  const { phone, userId, code } = req.body || {};
  return pairUser({ phone, userId, code, res });
});

app.get('/pair-status', (req, res) => {
  const userId = String(req.query.userId || '').trim();
  const status = userId ? pendingPairs.get(userId) : null;
  if (!status) return res.json({ ok: true, status: 'unknown' });
  return res.json({ ok: true, ...status });
});

export function startPairApi() {
  const port = Number(config.runtime.apiPort || 3000);
  app.listen(port, () => {
    console.log(`Pair API listening on http://localhost:${port}`);
  });
}

export default app;

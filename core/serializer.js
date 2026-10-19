export function serializeMessage(raw, client, conn, userId) {
  const content = raw?.message ?? {};
  const body =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.audioMessage?.caption ||
    content.stickerMessage?.caption ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    '';

  const key = raw?.key ?? {};
  const sender = key.participant || key.remoteJid || raw?.sender || '';
  const from = key.remoteJid || raw?.chat || '';
  const chat = from;
  const msg = {
    raw,
    body,
    sender,
    from,
    chat,
    key,
    id: key.id || raw?.key?.id || raw?.message?.messageContextInfo?.stanzaId || `${Date.now()}`,
    type: raw?.messageType || raw?.message?.messageContextInfo?.deviceListMetadataVersion || 'text',
    isGroup: Boolean(from && from.includes('@g.us')),
    isFromMe: Boolean(raw?.key?.fromMe),
    pushName: raw?.pushName || '',
    quoted: raw?.message?.extendedTextMessage?.contextInfo || raw?.message?.imageMessage?.contextInfo || null,
    mentions: raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
    client,
    conn,
    userId,
    text: body,
    reply: async (text, options = {}) => {
      if (!from) throw new Error('Cannot reply without a valid from value.');
      await client.sendMessage(from, { text }, options);
      return { ok: true };
    },
    send: async (contentPayload, options = {}) => {
      if (!from) throw new Error('Cannot send without a valid from value.');
      await client.sendMessage(from, contentPayload, options);
      return { ok: true };
    },
    download: async () => {
      if (!raw) return null;
      return { raw, ok: true };
    },
    loadGroupInfo: async () => {
      if (!from || !from.includes('@g.us')) return null;
      return { id: from, name: raw?.pushName || from };
    },
    addParticipant: async (participantId) => {
      if (!from || !from.includes('@g.us')) return null;
      if (!conn?.groupParticipantsUpdate) {
        throw new Error('groupParticipantsUpdate is unavailable on this connection.');
      }
      return conn.groupParticipantsUpdate(from, [participantId], 'add');
    },
  };

  return msg;
}

export default serializeMessage;

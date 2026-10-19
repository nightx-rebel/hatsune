export function parseCommand(text, prefix = '!') {
  const clean = String(text || '').trim();
  if (!clean) return null;
  if (!clean.startsWith(prefix)) return null;
  const trimmed = clean.slice(prefix.length).trim();
  if (!trimmed) return null;
  const [command, ...args] = trimmed.split(/\s+/g);
  return { command: command.toLowerCase(), args, raw: trimmed, text: clean };
}

export function matchCommand(commandMap, text, prefix = '!') {
  const parsed = parseCommand(text, prefix);
  if (!parsed) return null;
  const handler = commandMap.get(parsed.command);
  return handler ? { ...parsed, handler } : null;
}

export default { parseCommand, matchCommand };

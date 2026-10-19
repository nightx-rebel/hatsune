import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../plugins');
export const commands = new Map();
const text = [];
const message = [];
const all = [];
let snapshot;
let busy = false;
let stage;

export const Module = (meta) => (exec) => {
  if (typeof exec !== 'function') throw new TypeError('Plugin module must export a function.');
  const entry = { meta, exec };
  if (meta?.type === 'text') text.push(entry);
  if (meta?.type === 'message') message.push(entry);
  if (!meta?.type || meta.type === 'all') all.push(entry);
  return entry;
};

const loadPluginFile = async (filePath) => {
  const pluginModule = await import(pathToFileURL(filePath).href);
  const resolved = pluginModule.default ?? pluginModule;
  if (typeof resolved === 'function' && resolved.name === 'Module') {
    return resolved;
  }
  if (!resolved || typeof resolved !== 'object') {
    return null;
  }
  if (resolved.commands && resolved.commands instanceof Map) {
    for (const [name, handler] of resolved.commands) {
      commands.set(name, handler);
    }
  }
  if (resolved.meta && typeof resolved.exec === 'function') {
    return resolved;
  }
  return null;
};

const collectModules = async () => {
  const files = await fs.readdir(DIR);
  const pluginFiles = files.filter((file) => file.endsWith('.js')).sort();
  const results = [];
  for (const file of pluginFiles) {
    const entry = await loadPluginFile(path.join(DIR, file));
    if (entry) results.push(entry);
  }
  return results;
};

export async function initializePlugins() {
  snapshot = await collectModules();
  stage = 'ready';
  return snapshot;
}

export async function reloadPlugins() {
  busy = true;
  commands.clear();
  const freshModules = await collectModules();
  snapshot = freshModules;
  stage = 'reloaded';
  busy = false;
  return snapshot;
}

export const pluginSystem = {
  commands,
  text,
  message,
  all,
  snapshot,
  stage,
  busy,
  reload: reloadPlugins,
  initialize: initializePlugins,
};

export default pluginSystem;

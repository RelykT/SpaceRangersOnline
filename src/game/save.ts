import { rehydrate } from '../sim/world';
import { SAVE_VERSION, type World } from '../sim/types';

const KEY = 'kromka-save-v1';
const DB_NAME = 'kromka';
const STORE = 'saves';

export interface SaveFile {
  version: number;
  savedAt: number;
  world: World;
}

export function serialize(world: World): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), world };
  return JSON.stringify(file);
}

function parseSave(text: string): World {
  const data = JSON.parse(text) as SaveFile;
  if (!data || data.version !== SAVE_VERSION || !data.world?.player || !Array.isArray(data.world.systems)) {
    throw new Error('bad save');
  }
  return rehydrate(data.world);
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(text: string): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(text, 'slot');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<string | null> {
  const db = await idb();
  const text = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('slot');
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return text;
}

export async function saveGame(world: World): Promise<void> {
  const text = serialize(world);
  localStorage.setItem(KEY, text);
  try {
    await idbPut(text);
  } catch {
    /* localStorage already holds the save */
  }
}

export async function loadGame(): Promise<World | null> {
  try {
    const fromIdb = await idbGet();
    if (fromIdb) return parseSave(fromIdb);
  } catch {
    /* fall through */
  }
  const text = localStorage.getItem(KEY);
  if (!text) return null;
  try {
    return parseSave(text);
  } catch {
    return null;
  }
}

export function exportGame(world: World): void {
  const blob = new Blob([serialize(world)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kromka-${world.seed}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importGame(file: File): Promise<World> {
  const text = await file.text();
  const world = parseSave(text);
  await saveGame(world);
  return world;
}

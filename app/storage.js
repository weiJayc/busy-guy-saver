// File System Access API wrapper + a tiny IndexedDB store for the file
// handle, so the app can reconnect to the same tasks.json across reloads
// without asking the user to re-pick it from scratch every time (only a
// permission re-grant click is needed, since browsers won't silently regain
// file access after a reload).

const DB_NAME = 'task-scheduler';
const DB_STORE = 'handles';
const HANDLE_KEY = 'tasksFile';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadHandle() {
  const db = await openDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

async function verifyPermission(handle, requestIfNeeded) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (!requestIfNeeded) return false;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function pickNewOrExistingFile() {
  const handle = await window.showSaveFilePicker({
    suggestedName: 'tasks.json',
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  });
  await saveHandle(handle);
  return handle;
}

async function readTasks(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return { version: 1, tasks: [] };
  return JSON.parse(text);
}

async function writeTasks(handle, data) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

const isFileSystemAccessSupported = 'showSaveFilePicker' in window;

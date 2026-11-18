import { ERPState } from '../types/erp';

const LS_KEY = 'sgai_erp_state_v1';
const IDB_NAME = 'sgai_agropastoral_idb';
const IDB_STORE = 'erp_snapshots';
const IDB_RECORD_KEY = 'active_state';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponible'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function loadStateSync(fallback: ERPState): ERPState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as ERPState;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.inputs)) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export async function loadStateFromIDB(): Promise<ERPState | null> {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        const result = req.result as ERPState | undefined;
        if (result && Array.isArray(result.inputs)) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function persistERPState(state: ERPState): Promise<void> {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // Si LocalStorage atteint son quota, IndexedDB assure le relais hors-ligne
  }

  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(state, IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IDB errors in restricted environments
  }
}

export async function clearPersistedERPState(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.delete(IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

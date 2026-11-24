/**
 * Resolve — Take every thought captive.
 * Copyright (c) 2026 Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */

/**
 * Key-value store in IndexedDB of the extension's own origin. Unlike chrome.storage.local, which
 * content scripts can read and write, IndexedDB is bound to an origin: content scripts run in the
 * page's origin and cannot reach it. Data persists across browser restarts.
 */
export interface PrivateStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /**
   * Atomic read-modify-write in one IndexedDB transaction: `change` receives the current value
   * and returns the new one (`undefined` deletes). Resolves with the value written.
   */
  update(key: string, change: (current: unknown) => unknown): Promise<unknown>;
}

const DB_NAME = 'resolve';
const STORE = 'private';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'));
    };
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => {
        resolve(request.result);
      };
      tx.onerror = () => {
        reject(tx.error ?? new Error('IndexedDB transaction failed'));
      };
    });
  } finally {
    db.close();
  }
}

export const privateStore: PrivateStore = {
  get: (key) => run('readonly', (store) => store.get(key) as IDBRequest<unknown>),
  set: async (key, value) => {
    await run('readwrite', (store) => store.put(value, key));
  },
  remove: async (key) => {
    await run('readwrite', (store) => store.delete(key));
  },
  update: async (key, change) => {
    const db = await open();
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        let written: unknown;
        const read = store.get(key);
        read.onsuccess = () => {
          written = change(read.result);
          if (written === undefined) store.delete(key);
          else store.put(written, key);
        };
        tx.oncomplete = () => {
          resolve(written);
        };
        tx.onerror = () => {
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
      });
    } finally {
      db.close();
    }
  },
};

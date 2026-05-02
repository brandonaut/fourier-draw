import type { Path } from '../path/types';

export interface Drawing {
  id: string;
  name: string;
  createdAt: number;
  path: Path;
  thumbnail?: Blob;
}

const DB_NAME = 'fourier-draw';
const DB_VERSION = 1;
const STORE = 'drawings';

function open(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class DrawingStore {
  private readonly factory: IDBFactory;

  constructor(factory: IDBFactory = indexedDB) {
    this.factory = factory;
  }

  async save(drawing: Drawing): Promise<void> {
    const db = await open(this.factory);
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await txReq(tx.objectStore(STORE).put(drawing));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async load(id: string): Promise<Drawing | undefined> {
    const db = await open(this.factory);
    try {
      const tx = db.transaction(STORE, 'readonly');
      return await txReq<Drawing>(tx.objectStore(STORE).get(id) as IDBRequest<Drawing>);
    } finally {
      db.close();
    }
  }

  async list(): Promise<Drawing[]> {
    const db = await open(this.factory);
    try {
      const tx = db.transaction(STORE, 'readonly');
      const all = await txReq<Drawing[]>(
        tx.objectStore(STORE).getAll() as IDBRequest<Drawing[]>
      );
      return all.sort((a, b) => b.createdAt - a.createdAt);
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<void> {
    const db = await open(this.factory);
    try {
      const tx = db.transaction(STORE, 'readwrite');
      await txReq(tx.objectStore(STORE).delete(id));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}

export function newDrawingId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { DrawingStore, newDrawingId, type Drawing } from './db';

describe('DrawingStore', () => {
  let store: DrawingStore;

  beforeEach(() => {
    // Fresh in-memory IDB per test for isolation.
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    store = new DrawingStore();
  });

  afterEach(() => {
    // No teardown needed — fake-indexeddb is per-factory.
  });

  const sample = (overrides: Partial<Drawing> = {}): Drawing => ({
    id: newDrawingId(),
    name: 'sample',
    createdAt: Date.now(),
    path: [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ],
    ...overrides
  });

  it('saves and loads a drawing', async () => {
    const d = sample({ name: 'circle' });
    await store.save(d);
    const got = await store.load(d.id);
    expect(got?.name).toBe('circle');
    expect(got?.path).toEqual(d.path);
  });

  it('list returns drawings in newest-first order', async () => {
    await store.save(sample({ id: 'a', createdAt: 100 }));
    await store.save(sample({ id: 'b', createdAt: 300 }));
    await store.save(sample({ id: 'c', createdAt: 200 }));
    const list = await store.list();
    expect(list.map(d => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('delete removes the drawing', async () => {
    const d = sample();
    await store.save(d);
    await store.delete(d.id);
    expect(await store.load(d.id)).toBeUndefined();
  });

  it('save with the same id replaces the prior entry', async () => {
    const d = sample({ name: 'one' });
    await store.save(d);
    await store.save({ ...d, name: 'two' });
    expect((await store.load(d.id))?.name).toBe('two');
    expect(await store.list()).toHaveLength(1);
  });
});

describe('newDrawingId', () => {
  it('produces unique strings', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newDrawingId()));
    expect(ids.size).toBe(50);
  });
});

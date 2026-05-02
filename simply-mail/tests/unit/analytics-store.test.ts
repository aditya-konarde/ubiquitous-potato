import 'fake-indexeddb/auto';
import { analyticsStore, getWeekStartISO } from '@/shared/analytics-store';
import type { EmailEvent } from '@/shared/analytics-store';

describe('analytics store', () => {
  beforeEach(async () => {
    analyticsStore.reset();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('simply-mail-analytics');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  it('init creates the database and object store', async () => {
    const db = await analyticsStore.init();
    expect(db).toBeDefined();
    expect(db.objectStoreNames.contains('events')).toBe(true);
    expect(db.name).toBe('simply-mail-analytics');
  });

  it('init is idempotent — returns same db on second call', async () => {
    const db1 = await analyticsStore.init();
    const db2 = await analyticsStore.init();
    expect(db1).toBe(db2);
  });

  it('recordEvent stores data and retrieves it', async () => {
    await analyticsStore.recordEvent({
      type: 'received',
      sender: 'alice@example.com',
      subject: 'Hello',
      timestamp: Date.now(),
    });

    const db = await analyticsStore.init();
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const request = store.getAll();
    await new Promise<void>((resolve) => {
      request.onsuccess = () => resolve();
    });

    const events = request.result as EmailEvent[];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('received');
    expect(events[0].sender).toBe('alice@example.com');
    expect(events[0].subject).toBe('Hello');
    expect(events[0].id).toMatch(/^simply-mail-/);
  });

  it('getWeeklyDigest calculates correctly', async () => {
    const now = Date.now();

    // Record several events this week
    await analyticsStore.recordEvent({ type: 'received', sender: 'bob@test.com', subject: 'Hi', timestamp: now });
    await analyticsStore.recordEvent({ type: 'received', sender: 'bob@test.com', subject: 'Hi again', timestamp: now });
    await analyticsStore.recordEvent({ type: 'received', sender: 'carol@test.com', subject: 'Hey', timestamp: now });
    await analyticsStore.recordEvent({ type: 'sent', sender: 'me', subject: 'Re: Hi', timestamp: now });
    await analyticsStore.recordEvent({ type: 'sent', sender: 'me', subject: 'Fwd', timestamp: now });
    await analyticsStore.recordEvent({ type: 'sent', sender: 'me', subject: 'Fwd2', timestamp: now });
    await analyticsStore.recordEvent({ type: 'replied', sender: 'me', subject: '', timestamp: now });

    const digest = await analyticsStore.getWeeklyDigest();
    expect(digest.received).toBe(3);
    expect(digest.sent).toBe(3);
    expect(digest.replied).toBe(1);
    expect(digest.topSenders).toHaveLength(2);
    expect(digest.topSenders[0]).toEqual({ sender: 'bob@test.com', count: 2 });
    expect(digest.topSenders[1]).toEqual({ sender: 'carol@test.com', count: 1 });
  });

  it('getWeeklyDigest returns empty digest when no events', async () => {
    const digest = await analyticsStore.getWeeklyDigest();
    expect(digest.received).toBe(0);
    expect(digest.sent).toBe(0);
    expect(digest.replied).toBe(0);
    expect(digest.topSenders).toHaveLength(0);
  });

  it('cleanup removes old events', async () => {
    const now = Date.now();
    const oldTimestamp = now - 100 * 24 * 60 * 60 * 1000; // 100 days ago

    await analyticsStore.recordEvent({ type: 'received', sender: 'old@test.com', subject: 'Old', timestamp: oldTimestamp });
    await analyticsStore.recordEvent({ type: 'received', sender: 'new@test.com', subject: 'New', timestamp: now });

    // Cleanup with 90-day retention
    await analyticsStore.cleanup(90);

    const db = await analyticsStore.init();
    const tx = db.transaction('events', 'readonly');
    const store = tx.objectStore('events');
    const request = store.getAll();
    await new Promise<void>((resolve) => {
      request.onsuccess = () => resolve();
    });

    const events = request.result as EmailEvent[];
    expect(events).toHaveLength(1);
    expect(events[0].sender).toBe('new@test.com');
  });

  it('getWeekStartISO returns Monday of the current week', () => {
    // 2024-01-03 is a Wednesday
    const wednesday = new Date('2024-01-03T12:00:00Z').getTime();
    const weekStart = getWeekStartISO(wednesday);
    // Monday of that week is 2024-01-01
    expect(weekStart).toBe('2024-01-01');
  });
});

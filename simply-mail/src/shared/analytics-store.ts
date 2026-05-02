export interface EmailEvent {
  id: string;
  type: 'received' | 'sent' | 'replied';
  sender: string;
  subject: string;
  timestamp: number;
}

export interface WeeklyDigest {
  weekStart: string; // ISO date string (Monday of that week)
  received: number;
  sent: number;
  replied: number;
  topSenders: Array<{ sender: string; count: number }>;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function getWeekStartISO(timestamp: number): string {
  return getMonday(new Date(timestamp)).toISOString().split('T')[0];
}

function generateId(): string {
  return `simply-mail-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

class AnalyticsStore {
  private dbName = 'simply-mail-analytics';
  private storeName = 'events';
  private dbPromise: Promise<IDBDatabase> | null = null;

  reset(): void {
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        try { db.close(); } catch { /* ignore */ }
      });
      this.dbPromise = null;
    }
  }

  init(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async recordEvent(event: Omit<EmailEvent, 'id'>): Promise<void> {
    const db = await this.init();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const fullEvent: EmailEvent = { ...event, id: generateId() };
      const request = store.put(fullEvent);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getWeeklyDigest(): Promise<WeeklyDigest> {
    const db = await this.init();
    const now = new Date();
    const weekStart = getMonday(now);
    const weekStartISO = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return new Promise<WeeklyDigest>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const index = store.index('timestamp');
      const range = IDBKeyRange.bound(weekStart.getTime(), weekEnd.getTime());
      const request = index.openCursor(range);

      let received = 0;
      let sent = 0;
      let replied = 0;
      const senderCounts = new Map<string, number>();

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const event = cursor.value as EmailEvent;
          switch (event.type) {
            case 'received':
              received++;
              if (event.sender) {
                senderCounts.set(event.sender, (senderCounts.get(event.sender) ?? 0) + 1);
              }
              break;
            case 'sent':
              sent++;
              break;
            case 'replied':
              replied++;
              break;
          }
          cursor.continue();
        } else {
          // Sort senders by count descending
          const topSenders = Array.from(senderCounts.entries())
            .map(([sender, count]) => ({ sender, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          resolve({
            weekStart: weekStartISO,
            received,
            sent,
            replied,
            topSenders,
          });
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async cleanup(retentionDays: number): Promise<void> {
    const db = await this.init();
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const analyticsStore = new AnalyticsStore();

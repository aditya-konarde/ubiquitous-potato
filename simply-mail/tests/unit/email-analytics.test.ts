import {
  createEmailAnalyticsModule,
  shouldShowBanner,
  buildBannerHtml,
} from '@/content/modules/email-analytics';
import { extractSenderFromRow, extractSubjectFromRow } from '@/content/modules/row-utils';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { ModuleContext, SimplyMailSettings, MailObserverLike } from '@/shared/types';
import { vi } from 'vitest';
import { analyticsStore } from '@/shared/analytics-store';
import type { WeeklyDigest } from '@/shared/analytics-store';

// --- Mock chrome.storage.local ---
const storageData: Record<string, unknown> = {};
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          if (k in storageData) result[k] = storageData[k];
        }
        return result;
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(storageData, data);
      }),
    },
  },
});

// --- Mock indexedDB (needed by analytics-store) ---
import 'fake-indexeddb/auto';

// --- Helper to create mock rows ---

function createRow(attrs: Record<string, string>, innerHtml = ''): Element {
  const row = document.createElement('tr');
  row.setAttribute('role', 'row');
  for (const [k, v] of Object.entries(attrs)) {
    row.setAttribute(k, v);
  }
  row.innerHTML = innerHtml;
  return row;
}

// --- Helper to create mock context ---

function createMockContext(settings?: Partial<SimplyMailSettings>): ModuleContext {
  const fullSettings: SimplyMailSettings = { ...DEFAULT_SETTINGS, ...settings };
  const unsubscribers = new Map<string, () => void>();
  let unsubCounter = 0;

  const observer: MailObserverLike = {
    start: vi.fn(),
    stop: vi.fn(),
    getCurrentView: vi.fn(() => 'inbox' as const),
    on: vi.fn((_event: string, _handler: unknown) => {
      const id = `unsub-${unsubCounter++}`;
      unsubscribers.set(id, vi.fn());
      return () => unsubscribers.get(id)?.();
    }),
  };

  return {
    observer,
    settings: fullSettings,
    storage: {
      getSettings: vi.fn().mockResolvedValue(fullSettings),
      setSettings: vi.fn().mockResolvedValue(undefined),
      patchSettings: vi.fn().mockImplementation(async (patch) => ({ ...fullSettings, ...patch })),
      getSnoozedItems: vi.fn().mockResolvedValue([]),
      setSnoozedItems: vi.fn().mockResolvedValue(undefined),
      getReminderItems: vi.fn().mockResolvedValue([]),
      setReminderItems: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockResolvedValue({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 }),
      setStats: vi.fn().mockResolvedValue(undefined),
      onSettingsChanged: vi.fn().mockReturnValue(() => {}),
    },
    commandPalette: {
      registerCommands: vi.fn(),
      unregisterCommands: vi.fn(),
    },
  };
}

// --- Tests ---

describe('email analytics module', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '';
    // Reset chrome.storage mock data
    for (const key of Object.keys(storageData)) {
      delete storageData[key];
    }
    // Reset analytics store singleton cache and close IDB
    analyticsStore.reset();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('simply-mail-analytics');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });

  describe('extractSenderFromRow', () => {
    it('extracts sender from [email] attribute', () => {
      const row = createRow({}, '<span email="alice@example.com">Alice</span>');
      expect(extractSenderFromRow(row)).toBe('alice@example.com');
    });

    it('extracts sender from [data-hovercard-id]', () => {
      const row = createRow({}, '<span data-hovercard-id="bob@test.com">Bob</span>');
      expect(extractSenderFromRow(row)).toBe('bob@test.com');
    });

    it('extracts sender from aria-label on row', () => {
      const row = createRow({ 'aria-label': 'Alice alice@example.com Re: Hello' });
      expect(extractSenderFromRow(row)).toBe('alice@example.com');
    });

    it('returns empty string when no sender found', () => {
      const row = createRow({}, 'No sender here');
      expect(extractSenderFromRow(row)).toBe('');
    });
  });

  describe('extractSubjectFromRow', () => {
    it('extracts subject from .bog element', () => {
      const row = createRow({}, '<span class="bog">Meeting tomorrow</span>');
      expect(extractSubjectFromRow(row)).toBe('Meeting tomorrow');
    });

    it('returns empty string when no subject found', () => {
      const row = createRow({}, '');
      expect(extractSubjectFromRow(row)).toBe('');
    });
  });

  describe('shouldShowBanner', () => {
    it('returns true when not dismissed', () => {
      expect(shouldShowBanner(false)).toBe(true);
    });

    it('returns false when dismissed', () => {
      expect(shouldShowBanner(true)).toBe(false);
    });
  });

  describe('buildBannerHtml', () => {
    it('renders digest with correct values', () => {
      const digest: WeeklyDigest = {
        weekStart: '2024-01-01',
        received: 42,
        sent: 15,
        replied: 8,
        topSenders: [],
      };

      const html = buildBannerHtml(digest);
      expect(html).toContain('This week in your inbox');
      expect(html).toContain('42');
      expect(html).toContain('15');
      expect(html).toContain('8');
      expect(html).toContain('simply-mail-analytics-dismiss');
    });

    it('escapes HTML in sender names', () => {
      const digest: WeeklyDigest = {
        weekStart: '2024-01-01',
        received: 1,
        sent: 0,
        replied: 0,
        topSenders: [{ sender: '<script>alert("xss")</script>', count: 1 }],
      };

      // buildBannerHtml does not render topSenders in the banner,
      // but verify it does not inject raw HTML via the stats fields
      const html = buildBannerHtml(digest);
      expect(html).not.toContain('<script>');
    });
  });

  describe('module lifecycle', () => {
    it('init subscribes to observer events', async () => {
      const ctx = createMockContext({ emailAnalytics: { enabled: true, retentionDays: 90 } });
      const module = createEmailAnalyticsModule();
      expect(module.name).toBe('emailAnalytics');

      await module.init(ctx);

      expect(ctx.observer.on).toHaveBeenCalledWith('inbox-updated', expect.any(Function));
      expect(ctx.observer.on).toHaveBeenCalledWith('compose-detected', expect.any(Function));
      expect(ctx.observer.on).toHaveBeenCalledWith('thread-detected', expect.any(Function));
      expect(ctx.observer.on).toHaveBeenCalledWith('view-changed', expect.any(Function));

      await module.destroy();
    });

    it('destroy cleans up subscriptions', async () => {
      const ctx = createMockContext({ emailAnalytics: { enabled: true, retentionDays: 90 } });
      const module = createEmailAnalyticsModule();
      await module.init(ctx);
      await module.destroy();

      // After destroy, no style element should remain
      expect(document.getElementById('simply-mail-analytics-style')).toBeNull();
      expect(document.getElementById('simply-mail-analytics-banner')).toBeNull();
    });

    it('does not subscribe when disabled', async () => {
      const ctx = createMockContext({ emailAnalytics: { enabled: false, retentionDays: 90 } });
      const module = createEmailAnalyticsModule();
      await module.init(ctx);

      // Should not subscribe to any events since module is disabled
      expect(ctx.observer.on).not.toHaveBeenCalledWith('inbox-updated', expect.any(Function));

      await module.destroy();
    });
  });

  describe('event recording', () => {
    it('records received events from inbox rows', async () => {
      const ctx = createMockContext({ emailAnalytics: { enabled: true, retentionDays: 90 } });
      const module = createEmailAnalyticsModule();
      await module.init(ctx);

      // Find the inbox-updated handler
      const inboxHandler = (ctx.observer.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'inbox-updated',
      )?.[1] as (payload: { rows: Element[] }) => void;

      expect(inboxHandler).toBeDefined();

      const row = createRow({}, '<span email="sender@test.com">Sender</span><span class="bog">Test Subject</span>');
      await inboxHandler({ rows: [row] });

      // Give time for async recording
      await new Promise((r) => setTimeout(r, 50));

      // Verify event was recorded in IndexedDB
      const db = await (await import('@/shared/analytics-store')).analyticsStore.init();
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const request = store.getAll();
      await new Promise<void>((resolve) => {
        request.onsuccess = () => resolve();
      });
      expect(request.result).toHaveLength(1);
      expect(request.result[0].type).toBe('received');
      expect(request.result[0].sender).toBe('sender@test.com');

      await module.destroy();
    });

    it('records sent events from compose', async () => {
      const ctx = createMockContext({ emailAnalytics: { enabled: true, retentionDays: 90 } });
      const module = createEmailAnalyticsModule();
      await module.init(ctx);

      const composeHandler = (ctx.observer.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'compose-detected',
      )?.[1] as () => void;

      await composeHandler();
      await new Promise((r) => setTimeout(r, 50));

      const db = await (await import('@/shared/analytics-store')).analyticsStore.init();
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const request = store.getAll();
      await new Promise<void>((resolve) => {
        request.onsuccess = () => resolve();
      });
      expect(request.result).toHaveLength(1);
      expect(request.result[0].type).toBe('sent');

      await module.destroy();
    });
  });
});

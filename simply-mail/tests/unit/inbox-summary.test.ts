import { createInboxSummaryModule } from '@/content/modules/inbox-summary';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Record<string, unknown>): ModuleContext {
  const settings = { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
  return {
    observer: {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentView: vi.fn<() => MailView>(() => 'inbox'),
      on: vi.fn(() => () => undefined),
    },
    settings,
    storage: {
      getSettings: vi.fn(async () => settings),
      setSettings: vi.fn(async () => undefined),
      patchSettings: vi.fn(async () => settings),
      getSnoozedItems: vi.fn(async () => []),
      setSnoozedItems: vi.fn(async () => undefined),
      getReminderItems: vi.fn(async () => []),
      setReminderItems: vi.fn(async () => undefined),
      getStats: vi.fn(async () => ({ trackersBlockedToday: 5, snoozedCount: 2, reminderCount: 1 })),
      setStats: vi.fn(async () => undefined),
      onSettingsChanged: vi.fn(() => () => undefined),
    },
    commandPalette: {
      registerCommands: vi.fn(),
      unregisterCommands: vi.fn(),
    },
  };
}

describe('inbox-summary module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has correct module name', () => {
    const mod = createInboxSummaryModule();
    expect(mod.name).toBe('inboxSummary');
  });

  it('creates and destroys cleanly', async () => {
    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    await mod.destroy();
  });

  it('subscribes to observer events on init', async () => {
    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    expect(ctx.observer.on).toHaveBeenCalledWith('view-changed', expect.any(Function));
    expect(ctx.observer.on).toHaveBeenCalledWith('inbox-updated', expect.any(Function));
    await mod.destroy();
  });

  it('creates stat chips on init in inbox view', async () => {
    // Ensure role="main" exists in DOM for getMountPoint
    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    document.body.appendChild(main);

    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    const container = document.getElementById('simply-mail-inbox-summary');
    expect(container).not.toBeNull();
    const chips = container?.querySelectorAll('.simply-mail-inbox-summary-chip');
    expect(chips?.length).toBeGreaterThanOrEqual(3);
    await mod.destroy();
  });

  it('does not render in thread view', async () => {
    const ctx = createContext();
    ctx.observer.getCurrentView = vi.fn<() => MailView>(() => 'thread');
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    const container = document.getElementById('simply-mail-inbox-summary');
    expect(container).toBeNull();
    await mod.destroy();
  });

  it('does not render in compose view', async () => {
    const ctx = createContext();
    ctx.observer.getCurrentView = vi.fn<() => MailView>(() => 'compose');
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    const container = document.getElementById('simply-mail-inbox-summary');
    expect(container).toBeNull();
    await mod.destroy();
  });

  it('cleans up DOM on destroy', async () => {
    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    await mod.destroy();
    expect(document.getElementById('simply-mail-inbox-summary')).toBeNull();
    expect(document.getElementById('simply-mail-inbox-summary-style')).toBeNull();
  });

  it('handles settings change without throwing', async () => {
    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    expect(() => mod.onSettingsChange!(DEFAULT_SETTINGS, ctx)).not.toThrow();
    await mod.destroy();
  });

  it('stagger animation delays increase per chip', async () => {
    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    document.body.appendChild(main);

    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    const chips = document.querySelectorAll('.simply-mail-inbox-summary-chip');
    if (chips.length >= 2) {
      const d0 = parseFloat((chips[0] as HTMLElement).style.animationDelay);
      const d1 = parseFloat((chips[1] as HTMLElement).style.animationDelay);
      expect(d1).toBeGreaterThan(d0);
    }
    await mod.destroy();
  });

  it('injects CSS style element', async () => {
    const ctx = createContext();
    const mod = createInboxSummaryModule();
    await mod.init(ctx);
    const style = document.getElementById('simply-mail-inbox-summary-style');
    expect(style).not.toBeNull();
    await mod.destroy();
  });
});

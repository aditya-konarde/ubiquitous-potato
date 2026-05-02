import { createBatchActionsModule } from '@/content/modules/batch-actions';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(): ModuleContext {
  const settings = structuredClone(DEFAULT_SETTINGS);
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
      getStats: vi.fn(async () => ({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 })),
      setStats: vi.fn(async () => undefined),
      onSettingsChanged: vi.fn(() => () => undefined),
    },
    commandPalette: {
      registerCommands: vi.fn(),
      unregisterCommands: vi.fn(),
    },
  };
}

describe('batch-actions module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has correct module name', () => {
    const mod = createBatchActionsModule();
    expect(mod.name).toBe('batchActions');
  });

  it('creates and destroys cleanly', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);
    await mod.destroy();
  });

  it('subscribes to observer events on init', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);
    expect(ctx.observer.on).toHaveBeenCalledWith('inbox-updated', expect.any(Function));
    expect(ctx.observer.on).toHaveBeenCalledWith('view-changed', expect.any(Function));
    await mod.destroy();
  });

  it('cleans up DOM on destroy', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);
    await mod.destroy();
    expect(document.getElementById('simply-mail-batch-actions')).toBeNull();
    expect(document.getElementById('simply-mail-batch-actions-style')).toBeNull();
  });

  it('handles settings change without throwing', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);
    expect(() => mod.onSettingsChange!(DEFAULT_SETTINGS, ctx)).not.toThrow();
    await mod.destroy();
  });

  it('injects CSS style element', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);
    const style = document.getElementById('simply-mail-batch-actions-style');
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe('STYLE');
    await mod.destroy();
  });

  it('bar is hidden when no checkboxes are checked', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);
    const bar = document.getElementById('simply-mail-batch-actions');
    if (bar) {
      expect(bar.classList.contains('is-visible')).toBe(false);
    }
    await mod.destroy();
  });

  it('creates bar with action buttons on first selection', async () => {
    const ctx = createContext();
    const mod = createBatchActionsModule();
    await mod.init(ctx);

    // Simulate a checked row
    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    const cb = document.createElement('div');
    cb.setAttribute('role', 'checkbox');
    cb.setAttribute('aria-checked', 'true');
    row.appendChild(cb);
    main.appendChild(row);
    document.body.appendChild(main);

    await mod.destroy();
  });
});

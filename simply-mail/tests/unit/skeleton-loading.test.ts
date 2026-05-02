import { createSkeletonLoadingModule } from '@/content/modules/skeleton-loading';
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

describe('skeleton-loading module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has correct module name', () => {
    const mod = createSkeletonLoadingModule();
    expect(mod.name).toBe('skeletonLoading');
  });

  it('creates and destroys cleanly', async () => {
    const ctx = createContext();
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    await mod.destroy();
  });

  it('subscribes to observer events on init', async () => {
    const ctx = createContext();
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    expect(ctx.observer.on).toHaveBeenCalledWith('inbox-updated', expect.any(Function));
    await mod.destroy();
  });

  it('cleans up DOM on destroy', async () => {
    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    document.body.appendChild(main);

    const ctx = createContext();
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    await mod.destroy();
    expect(document.getElementById('simply-mail-skeleton-loading-style')).toBeNull();
    expect(document.getElementById('simply-mail-skeleton-container')).toBeNull();
  });

  it('handles settings change without throwing', async () => {
    const ctx = createContext();
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    expect(() => mod.onSettingsChange!(DEFAULT_SETTINGS, ctx)).not.toThrow();
    await mod.destroy();
  });

  it('injects CSS style element', async () => {
    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    document.body.appendChild(main);

    const ctx = createContext();
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    const style = document.getElementById('simply-mail-skeleton-loading-style');
    expect(style).not.toBeNull();
    expect(style?.tagName).toBe('STYLE');
    await mod.destroy();
  });

  it('does not show skeletons on non-inbox views', async () => {
    const ctx = createContext();
    ctx.observer.getCurrentView = vi.fn<() => MailView>(() => 'thread');
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    expect(document.getElementById('simply-mail-skeleton-container')).toBeNull();
    await mod.destroy();
  });

  it('does not show skeletons on compose view', async () => {
    const ctx = createContext();
    ctx.observer.getCurrentView = vi.fn<() => MailView>(() => 'compose');
    const mod = createSkeletonLoadingModule();
    await mod.init(ctx);
    expect(document.getElementById('simply-mail-skeleton-container')).toBeNull();
    await mod.destroy();
  });
});

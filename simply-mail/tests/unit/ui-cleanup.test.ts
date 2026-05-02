import { createUiCleanupModule } from '@/content/modules/ui-cleanup';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext, SimplyMailSettings } from '@/shared/types';

function createContext(overrides?: Partial<SimplyMailSettings['uiCleanup']>): ModuleContext {
  return {
    observer: {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentView: vi.fn<() => MailView>(() => 'inbox'),
      on: vi.fn(() => () => undefined),
    },
    settings: {
      ...structuredClone(DEFAULT_SETTINGS),
      uiCleanup: { ...DEFAULT_SETTINGS.uiCleanup, enabled: true, ...overrides },
    },
    storage: {
      getSettings: vi.fn(async () => DEFAULT_SETTINGS),
      setSettings: vi.fn(async () => undefined),
      patchSettings: vi.fn(async () => DEFAULT_SETTINGS),
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

describe('createUiCleanupModule', () => {
  afterEach(() => {
    document.body.className = '';
    document.getElementById('simply-mail-ui-cleanup')?.remove();
  });

  it('injects cleanup styles without layout containment on the mail app root', () => {
    const module = createUiCleanupModule();
    const context = createContext();

    module.init(context);

    const style = document.getElementById('simply-mail-ui-cleanup');
    expect(style).not.toBeNull();
    expect(style?.textContent).not.toContain('contain: layout style');
  });

  it('adds and removes the shell class cleanly', () => {
    const module = createUiCleanupModule();
    const context = createContext();

    module.init(context);
    expect(document.body.classList.contains('simply-mail-shell')).toBe(true);

    module.destroy();
    expect(document.body.classList.contains('simply-mail-shell')).toBe(false);
    expect(document.getElementById('simply-mail-ui-cleanup')).toBeNull();
  });

  it('does not inject compact density CSS when disabled', () => {
    const module = createUiCleanupModule();
    const context = createContext({ compactDensity: false });

    module.init(context);

    const style = document.getElementById('simply-mail-ui-cleanup');
    expect(style).not.toBeNull();
    expect(style?.textContent).not.toContain('simply-mail-compact-density');
    // compact rules should not be present
    expect(style?.textContent).not.toContain('height: 36px');
  });

  it('injects compact density CSS when enabled', () => {
    const module = createUiCleanupModule();
    const context = createContext({ compactDensity: true });

    module.init(context);

    const style = document.getElementById('simply-mail-ui-cleanup');
    expect(style).not.toBeNull();
    const css = style?.textContent ?? '';
    expect(css).toContain('height: 36px');
    expect(css).toContain('padding-top: 2px');
    expect(css).toContain('padding-bottom: 2px');
  });

  it('removes compact density CSS when settings change to disable it', () => {
    const module = createUiCleanupModule();
    const context = createContext({ compactDensity: true });

    module.init(context);

    let style = document.getElementById('simply-mail-ui-cleanup');
    expect(style?.textContent).toContain('height: 36px');

    const updatedSettings: SimplyMailSettings = {
      ...structuredClone(DEFAULT_SETTINGS),
      uiCleanup: { ...DEFAULT_SETTINGS.uiCleanup, enabled: true, compactDensity: false },
    };

    module.onSettingsChange!(updatedSettings, context);

    style = document.getElementById('simply-mail-ui-cleanup');
    expect(style?.textContent).not.toContain('height: 36px');
  });
});

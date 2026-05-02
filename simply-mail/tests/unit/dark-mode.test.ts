import { createDarkModeModule } from '@/content/modules/dark-mode';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(): ModuleContext {
  return {
    observer: {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentView: vi.fn<() => MailView>(() => 'inbox'),
      on: vi.fn(() => () => undefined),
    },
    settings: {
      ...structuredClone(DEFAULT_SETTINGS),
      darkMode: { ...DEFAULT_SETTINGS.darkMode, enabled: true, mode: 'dark' },
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

describe('createDarkModeModule', () => {
  function stubMatchMedia() {
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));
    return mediaQuery;
  }

  afterEach(() => {
    document.documentElement.classList.remove('simply-mail-dark-mode');
    document.getElementById('simply-mail-dark-mode')?.remove();
    document.getElementById('simply-mail-dark-mode-transitions')?.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('applies and removes dark mode shell styling', () => {
    stubMatchMedia();
    const module = createDarkModeModule();
    const context = createContext();

    module.init(context);

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(true);
    expect(document.getElementById('simply-mail-dark-mode')).not.toBeNull();

    module.destroy();

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(false);
    expect(document.getElementById('simply-mail-dark-mode')).toBeNull();
  });

  it('updates the shell class when settings change to light mode', () => {
    stubMatchMedia();
    const module = createDarkModeModule();
    const context = createContext();

    module.init(context);
    module.onSettingsChange?.(
      {
        ...context.settings,
        darkMode: { ...context.settings.darkMode, mode: 'light' },
      },
      context,
    );

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(false);
  });

  it('includes body inversion styling when that option is enabled', () => {
    stubMatchMedia();
    const module = createDarkModeModule();
    const context = createContext();
    context.settings.darkMode.invertMessageBodies = true;

    module.init(context);

    expect(document.getElementById('simply-mail-dark-mode')?.textContent).toContain('filter: invert(1) hue-rotate(180deg);');
  });

  it('injects a transition stylesheet when toggling from light to dark', () => {
    vi.useFakeTimers();
    stubMatchMedia();
    const module = createDarkModeModule();
    const context = createContext();

    module.init(context);

    expect(document.getElementById('simply-mail-dark-mode-transitions')).not.toBeNull();

    vi.advanceTimersByTime(350);

    expect(document.getElementById('simply-mail-dark-mode-transitions')).toBeNull();
  });

  it('removes the transition stylesheet on destroy', () => {
    vi.useFakeTimers();
    stubMatchMedia();
    const module = createDarkModeModule();
    const context = createContext();

    module.init(context);

    expect(document.getElementById('simply-mail-dark-mode-transitions')).not.toBeNull();

    module.destroy();

    expect(document.getElementById('simply-mail-dark-mode-transitions')).toBeNull();
  });

  it('responds to system theme changes when mode is system', () => {
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => {
        if (query === '(prefers-color-scheme: dark)') return mediaQuery;
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
      }),
    );

    const module = createDarkModeModule();
    const context = createContext();
    context.settings.darkMode.mode = 'system';

    module.init(context);

    // Starts light (matches: false)
    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(false);

    // Simulate OS switching to dark
    const handler = mediaQuery.addEventListener.mock.calls.find(
      (call: unknown[]) => (call as [string, EventListener])[0] === 'change',
    )?.[1] as EventListener | undefined;
    expect(handler).toBeDefined();

    mediaQuery.matches = true;
    handler!(new Event('change'));

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(true);

    // Simulate OS switching back to light
    mediaQuery.matches = false;
    handler!(new Event('change'));

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(false);
  });

  it('ignores system theme changes when mode is light', () => {
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    );

    const module = createDarkModeModule();
    const context = createContext();
    context.settings.darkMode.mode = 'light';

    module.init(context);

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(false);

    const handler = mediaQuery.addEventListener.mock.calls.find(
      (call: unknown[]) => (call as [string, EventListener])[0] === 'change',
    )?.[1] as EventListener | undefined;

    // System changes shouldn't affect anything in light mode
    handler!(new Event('change'));

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(false);
  });

  it('ignores system theme changes when mode is dark', () => {
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    );

    const module = createDarkModeModule();
    const context = createContext();
    context.settings.darkMode.mode = 'dark';

    module.init(context);

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(true);

    const handler = mediaQuery.addEventListener.mock.calls.find(
      (call: unknown[]) => (call as [string, EventListener])[0] === 'change',
    )?.[1] as EventListener | undefined;

    // System changes shouldn't affect anything in dark mode
    mediaQuery.matches = true;
    handler!(new Event('change'));

    expect(document.documentElement.classList.contains('simply-mail-dark-mode')).toBe(true);
  });

  it('removes the matchMedia listener on destroy', () => {
    const mediaQuery = stubMatchMedia();
    const module = createDarkModeModule();
    const context = createContext();

    module.init(context);

    expect(mediaQuery.removeEventListener).not.toHaveBeenCalled();

    module.destroy();

    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

import { createPauseInboxModule } from '@/content/modules/pause-inbox';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Partial<ModuleContext['settings']>): ModuleContext {
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

function setupDOM() {
  document.body.innerHTML = `
    <main role="main">
      <table role="grid">
        <tbody>
          <tr role="row"><td>Message 1</td></tr>
          <tr role="row"><td>Message 2</td></tr>
        </tbody>
      </table>
    </main>
  `;
}

describe('createPauseInboxModule', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.getElementById('simply-mail-pause-overlay-style')?.remove();
  });

  it('returns a module named pauseInbox', () => {
    const module = createPauseInboxModule();
    expect(module.name).toBe('pauseInbox');
  });

  it('has init and destroy lifecycle methods', () => {
    const module = createPauseInboxModule();
    expect(typeof module.init).toBe('function');
    expect(typeof module.destroy).toBe('function');
    expect(typeof module.onSettingsChange).toBe('function');
  });

  it('shows overlay when paused and enabled', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);

    const overlay = document.getElementById('simply-mail-pause-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('Inbox is paused');
    expect(overlay?.textContent).toContain('Focus mode is active');
    expect(overlay?.querySelector('button')?.textContent).toBe('Unpause');

    module.destroy();
  });

  it('does not show overlay when not paused', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: false });
    context.settings.pauseInbox.enabled = true;

    module.init(context);

    const overlay = document.getElementById('simply-mail-pause-overlay');
    expect(overlay).toBeNull();

    module.destroy();
  });

  it('does not show overlay when pauseInbox is disabled', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = false;

    module.init(context);

    const overlay = document.getElementById('simply-mail-pause-overlay');
    expect(overlay).toBeNull();

    module.destroy();
  });

  it('hides inbox rows when hideInboxWhenPaused is true', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;
    context.settings.pauseInbox.hideInboxWhenPaused = true;

    module.init(context);

    const rows = document.querySelectorAll('tr[role="row"]');
    rows.forEach((row) => {
      expect(row.classList.contains('simply-mail-inbox-hidden')).toBe(true);
    });

    module.destroy();
  });

  it('does not hide inbox rows when hideInboxWhenPaused is false', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;
    context.settings.pauseInbox.hideInboxWhenPaused = false;

    module.init(context);

    const rows = document.querySelectorAll('tr[role="row"]');
    rows.forEach((row) => {
      expect(row.classList.contains('simply-mail-inbox-hidden')).toBe(false);
    });

    module.destroy();
  });

  it('unpause button triggers settings patch with paused = false', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);

    const button = document.querySelector<HTMLButtonElement>('#simply-mail-pause-overlay button');
    expect(button).not.toBeNull();
    button?.click();

    expect(context.storage.patchSettings).toHaveBeenCalledWith({ paused: false });

    module.destroy();
  });

  it('removes overlay on destroy', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);
    expect(document.getElementById('simply-mail-pause-overlay')).not.toBeNull();

    module.destroy();
    expect(document.getElementById('simply-mail-pause-overlay')).toBeNull();
  });

  it('removes style element on destroy', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);
    expect(document.getElementById('simply-mail-pause-overlay-style')).not.toBeNull();

    module.destroy();
    expect(document.getElementById('simply-mail-pause-overlay-style')).toBeNull();
  });

  it('restores hidden inbox rows on destroy', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;
    context.settings.pauseInbox.hideInboxWhenPaused = true;

    module.init(context);

    const rows = document.querySelectorAll('tr[role="row"]');
    rows.forEach((row) => {
      expect(row.classList.contains('simply-mail-inbox-hidden')).toBe(true);
    });

    module.destroy();

    rows.forEach((row) => {
      expect(row.classList.contains('simply-mail-inbox-hidden')).toBe(false);
    });
  });

  it('responds to onSettingsChange by showing overlay', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: false });
    context.settings.pauseInbox.enabled = true;

    module.init(context);
    expect(document.getElementById('simply-mail-pause-overlay')).toBeNull();

    const newSettings = structuredClone(context.settings);
    newSettings.paused = true;
    module.onSettingsChange!(newSettings, context);

    expect(document.getElementById('simply-mail-pause-overlay')).not.toBeNull();

    module.destroy();
  });

  it('responds to onSettingsChange by hiding overlay', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);
    expect(document.getElementById('simply-mail-pause-overlay')).not.toBeNull();

    const newSettings = structuredClone(context.settings);
    newSettings.paused = false;
    module.onSettingsChange!(newSettings, context);

    expect(document.getElementById('simply-mail-pause-overlay')).toBeNull();

    module.destroy();
  });

  it('does not show overlay on non-inbox views', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('thread');

    module.init(context);

    expect(document.getElementById('simply-mail-pause-overlay')).toBeNull();

    module.destroy();
  });

  it('subscribes to view-changed event on init', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);

    expect(context.observer.on).toHaveBeenCalledWith('view-changed', expect.any(Function));

    module.destroy();
  });

  it('shows timer element when overlay is displayed', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);

    const timer = document.getElementById('simply-mail-pause-timer');
    expect(timer).not.toBeNull();
    expect(timer?.textContent).toBe('Focused for 0m');

    module.destroy();
  });

  it('removes timer element when overlay is removed', () => {
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);
    expect(document.getElementById('simply-mail-pause-timer')).not.toBeNull();

    module.destroy();
    expect(document.getElementById('simply-mail-pause-timer')).toBeNull();
  });

  it('clears timer interval on destroy', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    module.destroy();
    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('clears timer when settings change to unpaused', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const module = createPauseInboxModule();
    const context = createContext({ paused: true });
    context.settings.pauseInbox.enabled = true;

    module.init(context);

    const newSettings = structuredClone(context.settings);
    newSettings.paused = false;
    module.onSettingsChange!(newSettings, context);

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(document.getElementById('simply-mail-pause-timer')).toBeNull();

    clearIntervalSpy.mockRestore();
    module.destroy();
  });
});

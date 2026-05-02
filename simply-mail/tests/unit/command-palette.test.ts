import { CommandPaletteRegistry } from '@/content/command-registry';
import { createCommandPaletteModule } from '@/content/modules/command-palette';
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
    settings: structuredClone(DEFAULT_SETTINGS),
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
    commandPalette: new CommandPaletteRegistry(),
  };
}

describe('createCommandPaletteModule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock chrome.runtime.onMessage for content script listener
    if (typeof globalThis.chrome === 'undefined') {
      Object.defineProperty(globalThis, 'chrome', {
        value: { runtime: { onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } },
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.getElementById('simply-mail-command-palette')?.remove();
    document.getElementById('simply-mail-command-palette-style')?.remove();
    document.body.innerHTML = '';
  });

  it('opens with ctrl+k and renders base commands', () => {
    const module = createCommandPaletteModule();
    const context = createContext();

    module.init(context);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    vi.advanceTimersByTime(60);

    const root = document.getElementById('simply-mail-command-palette');
    expect(root?.classList.contains('is-open')).toBe(true);
    expect(document.querySelector('.simply-mail-command-input')).not.toBeNull();
    expect(document.documentElement.textContent).toContain('Go to Inbox');

    module.destroy();
  });

  it('does not hijack ctrl+k inside a typing context', () => {
    const module = createCommandPaletteModule();
    const context = createContext();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    module.init(context);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

    expect(document.getElementById('simply-mail-command-palette')).toBeNull();

    module.destroy();
  });

  it('restores focus after closing the dialog', () => {
    const module = createCommandPaletteModule();
    const context = createContext();
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    module.init(context);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    vi.advanceTimersByTime(60);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.activeElement).toBe(button);

    module.destroy();
  });

  it('exposes dialog accessibility attributes', () => {
    const module = createCommandPaletteModule();
    const context = createContext();

    module.init(context);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    vi.advanceTimersByTime(60);

    const panel = document.querySelector('.simply-mail-command-panel');
    const input = document.querySelector('.simply-mail-command-input');
    const list = document.getElementById('simply-mail-command-palette-list');

    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(input?.getAttribute('aria-controls')).toBe('simply-mail-command-palette-list');
    expect(list?.getAttribute('role')).toBe('listbox');
    expect(document.getElementById('simply-mail-command-palette-title')?.textContent).toContain('command palette');

    module.destroy();
  });

  it('rerenders when module commands are registered while open', async () => {
    const module = createCommandPaletteModule();
    const context = createContext();

    module.init(context);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    context.commandPalette.registerCommands('test-module', [{ id: 'custom', title: 'Custom Action', run: vi.fn() }]);

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(document.documentElement.textContent).toContain('Custom Action');

    module.destroy();
  });

  it('highlights matched text in command titles when searching', () => {
    const module = createCommandPaletteModule();
    const context = createContext();

    module.init(context);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    vi.advanceTimersByTime(60);

    const input = document.querySelector<HTMLInputElement>('.simply-mail-command-input');
    input!.value = 'inbox';
    input!.dispatchEvent(new Event('input', { bubbles: true }));

    const highlights = document.querySelectorAll('.simply-mail-palette-highlight');
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights[0].textContent?.toLowerCase()).toContain('inbox');

    module.destroy();
  });

  it('initializes and destroys without chrome.runtime message hooks', () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const module = createCommandPaletteModule();
    const context = createContext();

    expect(() => module.init(context)).not.toThrow();
    expect(() => module.destroy()).not.toThrow();

    Object.defineProperty(globalThis, 'chrome', {
      value: originalChrome,
      writable: true,
      configurable: true,
    });
  });
});

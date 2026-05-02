import { createSenderAvatarsModule, getInitials } from '@/content/modules/sender-avatars';
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

describe('getInitials', () => {
  it('extracts initials from "First Last" format', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('extracts initials from "Name <email>" format', () => {
    expect(getInitials('Jane Smith <jane@example.com>')).toBe('JS');
  });

  it('returns first letter for single-word name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('returns first letter of local part for bare email', () => {
    expect(getInitials('alice@example.com')).toBe('A');
  });

  it('handles empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('handles multi-word name (first + last)', () => {
    expect(getInitials('Alice Bob Carol')).toBe('AC');
  });
});

describe('sender-avatars module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has correct module name', () => {
    const mod = createSenderAvatarsModule();
    expect(mod.name).toBe('senderAvatars');
  });

  it('creates and destroys cleanly', async () => {
    const ctx = createContext();
    const mod = createSenderAvatarsModule();
    await mod.init(ctx);
    await mod.destroy();
  });

  it('subscribes to observer events on init', async () => {
    const ctx = createContext();
    const mod = createSenderAvatarsModule();
    await mod.init(ctx);
    expect(ctx.observer.on).toHaveBeenCalledWith('inbox-updated', expect.any(Function));
    expect(ctx.observer.on).toHaveBeenCalledWith('view-changed', expect.any(Function));
    await mod.destroy();
  });

  it('cleans up DOM on destroy', async () => {
    const ctx = createContext();
    const mod = createSenderAvatarsModule();
    await mod.init(ctx);
    await mod.destroy();
    expect(document.getElementById('simply-mail-sender-avatars-style')).toBeNull();
  });

  it('injects CSS style element', async () => {
    const ctx = createContext();
    const mod = createSenderAvatarsModule();
    await mod.init(ctx);
    const style = document.getElementById('simply-mail-sender-avatars-style');
    expect(style).not.toBeNull();
    await mod.destroy();
  });
});

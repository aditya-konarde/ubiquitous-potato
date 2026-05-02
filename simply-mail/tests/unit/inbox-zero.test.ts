import { createInboxZeroModule } from '@/content/modules/inbox-zero';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Partial<ModuleContext>): ModuleContext {
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
    commandPalette: {
      registerCommands: vi.fn(),
      unregisterCommands: vi.fn(),
    },
    ...overrides,
  };
}

function triggerEvent(context: ModuleContext, event: 'view-changed' | 'inbox-updated', payload: Record<string, unknown>): void {
  const onMock = context.observer.on as ReturnType<typeof vi.fn>;
  for (const call of onMock.mock.calls) {
    const [eventName, handler] = call as [string, (p: unknown) => void];
    if (eventName === event) {
      handler(payload);
    }
  }
}

const MOTIVATIONAL_MESSAGES = [
  'Inbox zero achieved. You are free.',
  'Clean slate. Nice work.',
  'Nothing here. That is the point.',
  'All caught up. Go do something great.',
];

describe('createInboxZeroModule', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main role="main"></main>';
    window.location.hash = '#inbox';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows celebration when inbox becomes empty after data arrives', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    expect(document.getElementById('simply-mail-inbox-zero')).toBeNull();

    triggerEvent(context, 'inbox-updated', { rows: [] });

    expect(document.getElementById('simply-mail-inbox-zero')?.textContent).toContain('Inbox Zero');

    module.destroy();
  });

  it('does not flash an empty state immediately after a view change', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });
    expect(document.getElementById('simply-mail-inbox-zero')).not.toBeNull();

    triggerEvent(context, 'view-changed', { view: 'inbox', hash: '#inbox' });
    expect(document.getElementById('simply-mail-inbox-zero')).toBeNull();

    module.destroy();
  });

  it('removes celebration when rows are present', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    module.init(context);

    triggerEvent(context, 'inbox-updated', { rows: [] });
    expect(document.getElementById('simply-mail-inbox-zero')).not.toBeNull();

    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    triggerEvent(context, 'inbox-updated', { rows: [row] });

    expect(document.getElementById('simply-mail-inbox-zero')).toBeNull();

    module.destroy();
  });

  it('respects search settings after fresh rows arrive', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    context.settings.inboxZero.showWhenEmptySearch = false;
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('search');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });
    expect(document.getElementById('simply-mail-inbox-zero')).toBeNull();

    context.settings.inboxZero.showWhenEmptySearch = true;
    module.onSettingsChange?.(context.settings, context);
    triggerEvent(context, 'inbox-updated', { rows: [] });
    expect(document.getElementById('simply-mail-inbox-zero')).not.toBeNull();

    module.destroy();
  });

  it('cleans up DOM and style on destroy', () => {
    const module = createInboxZeroModule();
    const context = createContext();

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });
    module.destroy();

    expect(document.getElementById('simply-mail-inbox-zero')).toBeNull();
    expect(document.getElementById('simply-mail-inbox-zero-style')).toBeNull();
  });

  it('shows a rotating motivational message from the curated set', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const el = document.getElementById('simply-mail-inbox-zero');
    const paragraph = el?.querySelector('p');
    expect(paragraph?.textContent).toBeTruthy();
    expect(MOTIVATIONAL_MESSAGES).toContain(paragraph?.textContent);

    module.destroy();
  });

  it('shows keyboard shortcut hint at the bottom', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const hint = document.querySelector('.simply-mail-inbox-zero-hint');
    expect(hint?.textContent).toBe('Press e to archive, ? for shortcuts');

    module.destroy();
  });

  it('shows trackers blocked count when greater than zero', async () => {
    const context = createContext({
      storage: {
        ...createContext().storage,
        getStats: vi.fn(async () => ({ trackersBlockedToday: 7, snoozedCount: 0, reminderCount: 0 })),
      },
    });
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    const module = createInboxZeroModule();
    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    // Wait for the async getStats() to resolve
    await new Promise((r) => setTimeout(r, 10));

    const statsEl = document.querySelector('.simply-mail-inbox-zero-stats');
    expect(statsEl?.textContent).toBe('7 trackers blocked today');

    module.destroy();
  });

  it('does not show trackers blocked count when zero', async () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    await new Promise((r) => setTimeout(r, 10));
    const statsEl = document.querySelector('.simply-mail-inbox-zero-stats');
    expect(statsEl).toBeNull();

    module.destroy();
  });

  it('renders 20 confetti particles radiating outward', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const particles = document.querySelectorAll('.simply-mail-inbox-zero-confetti span');
    expect(particles.length).toBe(20);

    // Each particle should have an animation with simply-mail-particle- prefix
    particles.forEach((p) => {
      const style = (p as HTMLElement).style;
      expect(style.animation).toContain('simply-mail-particle-');
    });

    module.destroy();
  });

  it('includes bounce animation in the card CSS', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const style = document.getElementById('simply-mail-inbox-zero-style') as HTMLStyleElement;
    expect(style).not.toBeNull();
    const css = style.textContent ?? '';

    expect(css).toContain('simply-mail-zero-bounce');
    // Spring curve should be present
    expect(css).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');

    module.destroy();
  });

  it('includes scale(0.95) in the entrance animation', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const style = document.getElementById('simply-mail-inbox-zero-style') as HTMLStyleElement;
    const css = style.textContent ?? '';

    expect(css).toContain('scale(0.95)');

    module.destroy();
  });

  it('includes prefers-reduced-motion override', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const style = document.getElementById('simply-mail-inbox-zero-style') as HTMLStyleElement;
    const css = style.textContent ?? '';

    expect(css).toContain('prefers-reduced-motion');

    module.destroy();
  });

  it('generates unique particle keyframes (20 @keyframes)', () => {
    const module = createInboxZeroModule();
    const context = createContext();
    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');

    module.init(context);
    triggerEvent(context, 'inbox-updated', { rows: [] });

    const style = document.getElementById('simply-mail-inbox-zero-style') as HTMLStyleElement;
    const css = style.textContent ?? '';

    // Should have 20 unique particle keyframes
    for (let i = 0; i < 20; i++) {
      expect(css).toContain(`@keyframes simply-mail-particle-${i}`);
    }

    module.destroy();
  });
});

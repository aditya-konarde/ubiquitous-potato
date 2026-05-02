import { createSplitInboxModule } from '@/content/modules/split-inbox';
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
    commandPalette: {
      registerCommands: vi.fn(),
      unregisterCommands: vi.fn(),
    },
  };
}

describe('createSplitInboxModule', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main role="main"><table role="grid"><tbody><tr role="row"><td>Row 1</td></tr><tr role="row"><td>Row 2</td></tr></tbody></table></main>';
    window.location.hash = '#inbox';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.getElementById('simply-mail-split-inbox-style')?.remove();
  });

  it('renders split inbox tabs and registers palette commands', () => {
    const module = createSplitInboxModule();
    const context = createContext();

    module.init(context);

    expect(document.getElementById('simply-mail-split-inbox')).not.toBeNull();
    expect(document.body.textContent).toContain('Important');
    expect(context.commandPalette.registerCommands).toHaveBeenCalledWith(
      'splitInbox',
      expect.arrayContaining([expect.objectContaining({ title: 'Open tab: Important' })]),
    );

    module.destroy();
  });

  it('shows an honest count only on the active tab', () => {
    const module = createSplitInboxModule();
    const context = createContext();

    module.init(context);

    const counts = Array.from(document.querySelectorAll('.simply-mail-split-inbox-count')).map((node) => node.textContent);
    expect(counts).toEqual(['2', '—', '—']);
    expect(document.querySelector('.simply-mail-split-inbox-button.is-active .simply-mail-split-inbox-count')?.textContent).toBe('2');

    module.destroy();
  });

  it('adds a summary that explains the count trust model', () => {
    const module = createSplitInboxModule();
    const context = createContext();

    module.init(context);

    const summary = document.querySelector('.simply-mail-split-inbox-summary');
    expect(summary?.textContent).toContain('Important');
    expect(summary?.textContent).toContain('2 conversations');
    expect(summary?.textContent).toContain('Only the active tab shows a real count');

    module.destroy();
  });

  it('shows empty state message when active tab has zero results', () => {
    document.body.innerHTML = '<main role="main"><table role="grid"><tbody></tbody></table></main>';
    window.location.hash = '#inbox';

    const module = createSplitInboxModule();
    const context = createContext();
    // Use empty inbox so no rows match the active tab
    const emptyObserver = { ...context.observer, getRows: () => [] };
    context.observer = emptyObserver as any;

    module.init(context);

    const empty = document.querySelector('.simply-mail-split-inbox-empty');
    expect(empty?.textContent).toBe('No messages match this view');

    module.destroy();
  });
});

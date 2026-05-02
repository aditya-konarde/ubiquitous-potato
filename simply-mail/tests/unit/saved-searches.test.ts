import { createSavedSearchesModule } from '@/content/modules/saved-searches';
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

describe('createSavedSearchesModule', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav role="navigation"></nav>';
    window.location.hash = '#inbox';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.getElementById('simply-mail-saved-searches-style')?.remove();
  });

  it('renders a sidebar rail with saved searches', () => {
    const module = createSavedSearchesModule();
    const context = createContext();

    module.init(context);

    expect(document.getElementById('simply-mail-saved-searches')).not.toBeNull();
    expect(document.body.textContent).toContain('Saved searches');
    expect(document.body.textContent).toContain('Unread');
    module.destroy();
  });

  it('highlights the active saved search when the hash matches', () => {
    const module = createSavedSearchesModule();
    const context = createContext();
    window.location.hash = '#search/is%3Aunread';

    module.init(context);

    expect(document.querySelector('.simply-mail-saved-search.is-active')?.textContent).toContain('Unread');
    module.destroy();
  });

  it('shows No results when saved searches list is empty', () => {
    document.body.innerHTML = '<nav role="navigation"></nav>';
    window.location.hash = '#inbox';

    const module = createSavedSearchesModule();
    const context = createContext();
    context.settings = { ...context.settings, savedSearchesList: [] };

    module.init(context);

    expect(document.querySelector('.simply-mail-saved-searches-empty')?.textContent).toBe('No results');

    module.destroy();
  });
});

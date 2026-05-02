import { createKeyboardNavigationModule } from '@/content/modules/keyboard-nav';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailObserverEventMap, MailView, ModuleContext } from '@/shared/types';

function createContext() {
  const handlers = new Map<keyof MailObserverEventMap, Set<(payload: unknown) => void>>();
  const observer = {
    start: vi.fn(),
    stop: vi.fn(),
    getCurrentView: vi.fn<() => MailView>(() => 'inbox'),
    on: vi.fn(<TEvent extends keyof MailObserverEventMap>(event: TEvent, handler: (payload: MailObserverEventMap[TEvent]) => void) => {
      const next = handlers.get(event) ?? new Set();
      next.add(handler as (payload: unknown) => void);
      handlers.set(event, next);
      return () => next.delete(handler as (payload: unknown) => void);
    }),
  };

  const context: ModuleContext = {
    observer,
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

  return {
    context,
    emit<TEvent extends keyof MailObserverEventMap>(event: TEvent, payload: MailObserverEventMap[TEvent]) {
      for (const handler of Array.from(handlers.get(event) ?? [])) {
        handler(payload);
      }
    },
  };
}

describe('createKeyboardNavigationModule', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.querySelectorAll('style').forEach((s) => s.remove());
    document.getElementById('simply-mail-keyboard-help')?.remove();
  });

  it('selects the first row when inbox rows appear', () => {
    document.body.innerHTML = '<table><tr role="row"><td>One</td></tr><tr role="row"><td>Two</td></tr></table>';
    const { context, emit } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    emit('inbox-updated', { rows: Array.from(document.querySelectorAll('tr[role="row"]')) });

    expect(document.querySelector('tr[role="row"]')?.classList.contains('simply-mail-row-selected')).toBe(true);
    module.destroy();
  });

  it('ignores movement shortcuts while focus is inside a text input', () => {
    document.body.innerHTML = '<input type="text" /><table><tr role="row"><td>One</td></tr><tr role="row"><td>Two</td></tr></table>';
    const { context } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    document.querySelector('tr[role="row"]')?.classList.add('simply-mail-row-selected');

    const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true });
    document.querySelector('input')?.dispatchEvent(event);

    expect(document.querySelectorAll('.simply-mail-row-selected')).toHaveLength(1);
    expect(document.querySelectorAll('tr[role="row"]')[1]?.classList.contains('simply-mail-row-selected')).toBe(false);
    module.destroy();
  });

  it('focuses the search input when slash is pressed', () => {
    document.body.innerHTML = '<input aria-label="Search mail" /><table><tr role="row"><td>One</td></tr></table>';
    const { context } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));

    expect(document.activeElement).toBe(document.querySelector('input'));
    module.destroy();
  });

  describe('help panel', () => {
    it('shows the help overlay when ? is pressed', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));

      const overlay = document.getElementById('simply-mail-keyboard-help');
      expect(overlay).not.toBeNull();
      expect(overlay?.hidden).toBe(false);
      expect(overlay?.querySelector('.simply-mail-help-heading')?.textContent).toBe('Keyboard shortcuts');
      module.destroy();
    });

    it('hides the help overlay when ? is pressed again', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(document.getElementById('simply-mail-keyboard-help')?.hidden).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(document.getElementById('simply-mail-keyboard-help')?.hidden).toBe(true);
      module.destroy();
    });

    it('hides the help overlay when Escape is pressed while visible', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(document.getElementById('simply-mail-keyboard-help')?.hidden).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.getElementById('simply-mail-keyboard-help')?.hidden).toBe(true);
      module.destroy();
    });

    it('lists all expected shortcuts in the help table', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));

      const keys = Array.from(document.querySelectorAll('.simply-mail-help-keys')).map((el) => el.textContent);
      expect(keys).toContain('j / k');
      expect(keys).toContain('Enter');
      expect(keys).toContain('x');
      expect(keys).toContain('e');
      expect(keys).toContain('r');
      expect(keys).toContain('/');
      expect(keys).toContain('Cmd/Ctrl+K');
      expect(keys).toContain('?');
      expect(keys).toContain('Escape');
      module.destroy();
    });

    it('does not show help when typing in an input field', () => {
      document.body.innerHTML = '<input type="text" /><table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      const input = document.querySelector('input')!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));

      expect(document.getElementById('simply-mail-keyboard-help')).toBeNull();
      module.destroy();
    });

    it('removes the help overlay on destroy', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(document.getElementById('simply-mail-keyboard-help')).not.toBeNull();

      module.destroy();
      expect(document.getElementById('simply-mail-keyboard-help')).toBeNull();
    });

    it('removes help styles on destroy', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      expect(document.getElementById('simply-mail-keyboard-help-style')).not.toBeNull();

      module.destroy();
      expect(document.getElementById('simply-mail-keyboard-help-style')).toBeNull();
    });

    it('hides help overlay when backdrop is clicked', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(document.getElementById('simply-mail-keyboard-help')?.hidden).toBe(false);

      const backdrop = document.querySelector('.simply-mail-help-backdrop') as HTMLElement;
      backdrop.click();
      expect(document.getElementById('simply-mail-keyboard-help')?.hidden).toBe(true);
      module.destroy();
    });
  });

  it('scrolls selected row into view with smooth behavior on j/k navigation', () => {
    document.body.innerHTML =
      '<table><tr role="row"><td>One</td></tr><tr role="row"><td>Two</td></tr><tr role="row"><td>Three</td></tr></table>';
    const { context } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    const rows = document.querySelectorAll('tr[role="row"]');
    rows[0]?.classList.add('simply-mail-row-selected');

    const mockScrollIntoView = vi.fn();
    rows[1]!.scrollIntoView = mockScrollIntoView;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));

    expect(rows[1]?.classList.contains('simply-mail-row-selected')).toBe(true);
    expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });

    module.destroy();
  });

  it('opens a thread when Enter is pressed on a selected row', () => {
    document.body.innerHTML =
      '<table><tr role="row"><td>One</td></tr><tr role="row"><td>Two</td></tr></table>';
    const { context } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    const rows = document.querySelectorAll('tr[role="row"]');
    rows[0]?.classList.add('simply-mail-row-selected');

    const clickSpy = vi.fn();
    rows[0]!.addEventListener('click', clickSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(clickSpy).toHaveBeenCalled();

    module.destroy();
  });

  it('toggles the checkbox when x is pressed on a selected row', () => {
    document.body.innerHTML =
      '<table><tr role="row"><td><div role="checkbox" aria-label="Select"></div>One</td></tr></table>';
    const { context } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    document.querySelector('tr[role="row"]')?.classList.add('simply-mail-row-selected');

    const checkbox = document.querySelector('div[role="checkbox"]') as HTMLElement;
    const clickSpy = vi.fn();
    checkbox.addEventListener('click', clickSpy);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));

    expect(clickSpy).toHaveBeenCalled();

    module.destroy();
  });

  it('does nothing on x when row has no checkbox', () => {
    document.body.innerHTML =
      '<table><tr role="row"><td>No checkbox here</td></tr></table>';
    const { context } = createContext();
    const module = createKeyboardNavigationModule();

    module.init(context);
    document.querySelector('tr[role="row"]')?.classList.add('simply-mail-row-selected');

    // Should not throw
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    }).not.toThrow();

    module.destroy();
  });

  describe('saved search shortcuts (1-9)', () => {
    it('navigates to the first saved search when 1 is pressed', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

      expect(window.location.hash).toBe('#search/is%3Aunread');

      module.destroy();
    });

    it('navigates to the second saved search when 2 is pressed', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

      expect(window.location.hash).toBe('#search/has%3Aattachment');

      module.destroy();
    });

    it('does nothing when pressing a number beyond saved search count', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      // Trim to 2 saved searches so pressing '3' is out of range
      context.settings.savedSearchesList = context.settings.savedSearchesList.slice(0, 2);
      const module = createKeyboardNavigationModule();

      module.init(context);
      const hashBefore = window.location.hash;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));

      expect(window.location.hash).toBe(hashBefore);

      module.destroy();
    });

    it('does not navigate when pressing a number key inside a text input', () => {
      document.body.innerHTML = '<input type="text" /><table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      const hashBefore = window.location.hash;
      const input = document.querySelector('input')!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));

      expect(window.location.hash).toBe(hashBefore);

      module.destroy();
    });

    it('lists the saved search shortcut in the help panel', () => {
      document.body.innerHTML = '<table><tr role="row"><td>One</td></tr></table>';
      const { context } = createContext();
      const module = createKeyboardNavigationModule();

      module.init(context);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));

      const keys = Array.from(document.querySelectorAll('.simply-mail-help-keys')).map((el) => el.textContent);
      expect(keys).toContain('1–9');

      module.destroy();
    });
  });
});

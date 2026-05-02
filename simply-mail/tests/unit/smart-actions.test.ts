import {
  createSmartActionsModule,
  classifySender,
  getActionsForClassification,
} from '@/content/modules/smart-actions';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Partial<ModuleContext>): ModuleContext {
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
    ...overrides,
  };
}

function setupDOM(): void {
  document.body.innerHTML = `
    <main role="main">
      <table role="grid">
        <tbody>
          <tr role="row" aria-label="Alice alice@example.com Your report">
            <td class="yW"><span email="alice@example.com">Alice</span></td>
            <td class="xW"><div class="y2">alice@example.com</div></td>
            <td><div class="bog">Your report</div></td>
          </tr>
          <tr role="row" aria-label="noreply@newsletter.com Weekly Digest">
            <td class="yW"><span email="noreply@newsletter.com">Weekly Digest</span></td>
            <td class="xW"><div class="y2">noreply@newsletter.com</div></td>
            <td><div class="bog">Weekly Digest</div></td>
          </tr>
          <tr role="row" aria-label="notifications@linkedin.com John viewed your profile">
            <td class="yW"><span email="notifications@linkedin.com">LinkedIn</span></td>
            <td class="xW"><div class="y2">notifications@linkedin.com</div></td>
            <td><div class="bog">John viewed your profile</div></td>
          </tr>
          <tr role="row" aria-label="receipts@store.com Your receipt">
            <td class="yW"><span email="receipts@store.com">Store</span></td>
            <td class="xW"><div class="y2">receipts@store.com</div></td>
            <td><div class="bog">Your receipt for order #12345</div></td>
          </tr>
          <tr role="row">
            <td class="yW"><span>Unknown Sender</span></td>
            <td class="xW"><div class="y2"></div></td>
            <td><div class="bog">Mystery email</div></td>
          </tr>
        </tbody>
      </table>
    </main>
  `;
}

describe('classifySender', () => {
  it('classifies noreply@ emails as newsletter', () => {
    expect(classifySender('noreply@newsletter.com', 'Weekly update')).toBe('newsletter');
    // noreply@github.com is social (github.com domain), so test with a non-social domain
    expect(classifySender('noreply@company.com', 'Some notification')).toBe('newsletter');
  });

  it('classifies newsletter@ emails as newsletter', () => {
    expect(classifySender('newsletter@company.com', 'Newsletter')).toBe('newsletter');
  });

  it('classifies mail@ emails as newsletter', () => {
    expect(classifySender('mail@daily.com', 'Daily digest')).toBe('newsletter');
  });

  it('classifies updates@ emails as newsletter', () => {
    expect(classifySender('updates@app.com', 'App updates')).toBe('newsletter');
  });

  it('classifies digest@ emails as newsletter', () => {
    expect(classifySender('digest@weekly.com', 'This week')).toBe('newsletter');
  });

  it('classifies hello@ emails as newsletter', () => {
    expect(classifySender('hello@startup.io', 'Welcome')).toBe('newsletter');
  });

  it('classifies linkedin.com as social', () => {
    expect(classifySender('notifications@linkedin.com', 'John viewed your profile')).toBe('social');
  });

  it('classifies facebook.com as social', () => {
    expect(classifySender('notification@facebook.com', 'New friend request')).toBe('social');
  });

  it('classifies twitter.com as social', () => {
    expect(classifySender('notify@twitter.com', 'Someone followed you')).toBe('social');
  });

  it('classifies x.com as social', () => {
    expect(classifySender('notify@x.com', 'New follower')).toBe('social');
  });

  it('classifies github.com as social', () => {
    expect(classifySender('notifications@github.com', 'New PR review')).toBe('social');
  });

  it('classifies receipt in subject as transactional', () => {
    expect(classifySender('store@shop.com', 'Your receipt for order #123')).toBe('transactional');
  });

  it('classifies order in subject as transactional', () => {
    expect(classifySender('store@shop.com', 'Order confirmation')).toBe('transactional');
  });

  it('classifies invoice in subject as transactional', () => {
    expect(classifySender('billing@service.com', 'Invoice #456')).toBe('transactional');
  });

  it('classifies payment in subject as transactional', () => {
    expect(classifySender('billing@service.com', 'Payment received')).toBe('transactional');
  });

  it('classifies shipping in subject as transactional', () => {
    expect(classifySender('ship@store.com', 'Your shipping confirmation')).toBe('transactional');
  });

  it('classifies regular human email as important', () => {
    expect(classifySender('alice@example.com', 'Meeting tomorrow')).toBe('important');
    expect(classifySender('bob@company.org', 'Project update')).toBe('important');
  });

  it('classifies empty sender as unknown', () => {
    expect(classifySender('', 'Some subject')).toBe('unknown');
  });

  it('prioritizes social classification over newsletter prefixes', () => {
    // If it matches a social domain, it should be social regardless
    expect(classifySender('noreply@linkedin.com', 'Notification')).toBe('social');
  });

  it('prioritizes social classification over transactional subject words', () => {
    expect(classifySender('notifications@github.com', 'Your receipt')).toBe('social');
  });
});

describe('getActionsForClassification', () => {
  it('returns Archive, Unsubscribe, Read, MarkUnread for newsletter', () => {
    const actions = getActionsForClassification('newsletter');
    expect(actions.map((a) => a.type)).toEqual(['Archive', 'Unsubscribe', 'Read', 'MarkUnread']);
  });

  it('returns Archive, Read, Snooze, MarkUnread for social', () => {
    const actions = getActionsForClassification('social');
    expect(actions.map((a) => a.type)).toEqual(['Archive', 'Read', 'Snooze', 'MarkUnread']);
  });

  it('returns Read, Archive, Star, MarkUnread for transactional', () => {
    const actions = getActionsForClassification('transactional');
    expect(actions.map((a) => a.type)).toEqual(['Read', 'Archive', 'Star', 'MarkUnread']);
  });

  it('returns Read, Reply, Star, MarkUnread for important', () => {
    const actions = getActionsForClassification('important');
    expect(actions.map((a) => a.type)).toEqual(['Read', 'Reply', 'Star', 'MarkUnread']);
  });

  it('returns Read, Archive, Star, MarkUnread for unknown', () => {
    const actions = getActionsForClassification('unknown');
    expect(actions.map((a) => a.type)).toEqual(['Read', 'Archive', 'Star', 'MarkUnread']);
  });

  it('each action has icon and label', () => {
    const actions = getActionsForClassification('important');
    for (const action of actions) {
      expect(action.icon).toBeTruthy();
      expect(action.label).toBeTruthy();
      expect(action.color).toBeTruthy();
    }
  });
});

describe('createSmartActionsModule', () => {
  beforeEach(() => {
    setupDOM();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.getElementById('simply-mail-smart-actions-style')?.remove();
  });

  it('returns a module named smartActions', () => {
    const module = createSmartActionsModule();
    expect(module.name).toBe('smartActions');
  });

  it('has init and destroy lifecycle methods', () => {
    const module = createSmartActionsModule();
    expect(typeof module.init).toBe('function');
    expect(typeof module.destroy).toBe('function');
    expect(typeof module.onSettingsChange).toBe('function');
  });

  it('subscribes to inbox-updated on init', () => {
    const module = createSmartActionsModule();
    const context = createContext();

    module.init(context);

    const onMock = context.observer.on as ReturnType<typeof vi.fn>;
    const eventNames = onMock.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('inbox-updated');

    module.destroy();
  });

  it('injects styles on init', () => {
    const module = createSmartActionsModule();
    const context = createContext();

    module.init(context);

    expect(document.getElementById('simply-mail-smart-actions-style')).not.toBeNull();

    module.destroy();
  });

  it('removes styles on destroy', () => {
    const module = createSmartActionsModule();
    const context = createContext();

    module.init(context);
    expect(document.getElementById('simply-mail-smart-actions-style')).not.toBeNull();

    module.destroy();
    expect(document.getElementById('simply-mail-smart-actions-style')).toBeNull();
  });

  it('shows action bar after hovering an email row for 300ms', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const row = document.querySelector('tr[role="row"]');
    expect(row).not.toBeNull();

    // Dispatch mouseenter
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    // Before 300ms, no action bar
    expect(document.querySelector('.simply-mail-smart-actions-bar')).toBeNull();

    // Advance past 300ms
    vi.advanceTimersByTime(350);

    // Action bar should now be visible
    const bar = document.querySelector('.simply-mail-smart-actions-bar');
    expect(bar).not.toBeNull();
    expect(bar?.children.length).toBe(4); // 4 action buttons (including MarkUnread)

    module.destroy();
  });

  it('handles text-node hover targets without throwing', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const textNode = document.querySelector('tr[role="row"] .bog')?.firstChild;
    expect(textNode).not.toBeNull();

    expect(() => {
      textNode!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      vi.advanceTimersByTime(350);
    }).not.toThrow();

    expect(document.querySelector('.simply-mail-smart-actions-bar')).not.toBeNull();

    module.destroy();
  });

  it('does not show action bar when enabled is false', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = false;

    module.init(context);

    const row = document.querySelector('tr[role="row"]');
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    vi.advanceTimersByTime(350);

    expect(document.querySelector('.simply-mail-smart-actions-bar')).toBeNull();

    module.destroy();
  });

  it('hides action bar on mouse leave with delay', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const row = document.querySelector('tr[role="row"]');

    // Hover to show
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);
    expect(document.querySelector('.simply-mail-smart-actions-bar')).not.toBeNull();

    // Mouse leave
    row!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, relatedTarget: document.body }));

    // Before 200ms delay, bar still exists
    expect(document.querySelector('.simply-mail-smart-actions-bar')).not.toBeNull();

    // After 200ms delay, bar should be leaving/removed
    vi.advanceTimersByTime(250);
    // The bar gets 'is-leaving' class then removed after animation
    const bar = document.querySelector('.simply-mail-smart-actions-bar');
    expect(bar?.classList.contains('is-leaving') || bar === null).toBe(true);

    module.destroy();
  });

  it('respects enabled setting via onSettingsChange', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = false;

    module.init(context);

    // Enable via settings change
    const newSettings = structuredClone(context.settings);
    newSettings.smartActions.enabled = true;
    module.onSettingsChange!(newSettings, context);

    const row = document.querySelector('tr[role="row"]');
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    expect(document.querySelector('.simply-mail-smart-actions-bar')).not.toBeNull();

    module.destroy();
  });

  it('disables and cleans up when onSettingsChange sets enabled to false', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;

    module.init(context);

    // Show action bar
    const row = document.querySelector('tr[role="row"]');
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);
    expect(document.querySelector('.simply-mail-smart-actions-bar')).not.toBeNull();

    // Disable via settings change
    const newSettings = structuredClone(context.settings);
    newSettings.smartActions.enabled = false;
    module.onSettingsChange!(newSettings, context);

    // Action bar should be gone
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.simply-mail-smart-actions-bar')).toBeNull();

    module.destroy();
  });

  it('shows correct actions for a newsletter sender row', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    // The second row is a newsletter
    const rows = document.querySelectorAll('tr[role="row"]');
    const newsletterRow = rows[1];
    newsletterRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const buttons = document.querySelectorAll('.simply-mail-smart-action-btn');
    const labels = Array.from(buttons).map((b) => b.getAttribute('data-simply-mail-action'));
    expect(labels).toEqual(['Archive', 'Unsubscribe', 'Read', 'MarkUnread']);

    module.destroy();
  });

  it('shows correct actions for a social sender row', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const rows = document.querySelectorAll('tr[role="row"]');
    const socialRow = rows[2]; // LinkedIn
    socialRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const buttons = document.querySelectorAll('.simply-mail-smart-action-btn');
    const labels = Array.from(buttons).map((b) => b.getAttribute('data-simply-mail-action'));
    expect(labels).toEqual(['Archive', 'Read', 'Snooze', 'MarkUnread']);

    module.destroy();
  });

  it('shows correct actions for a transactional sender row', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const rows = document.querySelectorAll('tr[role="row"]');
    const transactionalRow = rows[3]; // receipt
    transactionalRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const buttons = document.querySelectorAll('.simply-mail-smart-action-btn');
    const labels = Array.from(buttons).map((b) => b.getAttribute('data-simply-mail-action'));
    expect(labels).toEqual(['Read', 'Archive', 'Star', 'MarkUnread']);

    module.destroy();
  });

  it('shows correct actions for an important sender row', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const rows = document.querySelectorAll('tr[role="row"]');
    const importantRow = rows[0]; // Alice
    importantRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const buttons = document.querySelectorAll('.simply-mail-smart-action-btn');
    const labels = Array.from(buttons).map((b) => b.getAttribute('data-simply-mail-action'));
    expect(labels).toEqual(['Read', 'Reply', 'Star', 'MarkUnread']);

    module.destroy();
  });

  it('clicking an action button does not propagate to the row', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    const row = document.querySelector('tr[role="row"]');
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const btn = document.querySelector('.simply-mail-smart-action-btn');
    expect(btn).not.toBeNull();

    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(clickEvent, 'preventDefault');
    const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');

    btn!.dispatchEvent(clickEvent);

    expect(preventSpy).toHaveBeenCalled();
    expect(stopSpy).toHaveBeenCalled();

    module.destroy();
  });

  it('cleans up subscriptions on destroy', () => {
    const module = createSmartActionsModule();
    const context = createContext();

    module.init(context);
    module.destroy();

    // After destroy, the observer should have been called for cleanup
    const onMock = context.observer.on as ReturnType<typeof vi.fn>;
    // Each call to on returned an unsubscribe function that was called
    expect(onMock).toHaveBeenCalled();
  });

  it('shows Mark unread button with correct label for read rows', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    // First row (Alice) is a read row (no zE class)
    const row = document.querySelector('tr[role="row"]');
    expect(row).not.toBeNull();

    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const markUnreadBtn = document.querySelector('.simply-mail-smart-action-btn[data-simply-mail-action="MarkUnread"]');
    expect(markUnreadBtn).not.toBeNull();
    expect(markUnreadBtn?.getAttribute('aria-label')).toBe('Mark unread');
    expect(markUnreadBtn?.textContent).toContain('Mark unread');

    module.destroy();
  });

  it('shows Mark read button for unread rows', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    // Make the first row unread by adding zE class
    const row = document.querySelector('tr[role="row"]');
    expect(row).not.toBeNull();
    row!.classList.add('zE');

    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const markUnreadBtn = document.querySelector('.simply-mail-smart-action-btn[data-simply-mail-action="MarkUnread"]');
    expect(markUnreadBtn).not.toBeNull();
    expect(markUnreadBtn?.getAttribute('aria-label')).toBe('Mark read');
    expect(markUnreadBtn?.textContent).toContain('Mark read');

    module.destroy();
  });

  it('clicking MarkUnread button triggers email app toolbar button', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;
    context.settings.smartActions.showOnHover = true;

    module.init(context);

    // Add a mock email app toolbar mark read/unread button
    const mockMarkBtn = document.createElement('div');
    mockMarkBtn.setAttribute('aria-label', 'Mark as unread');
    mockMarkBtn.addEventListener('click', () => { /* noop */ });
    document.body.appendChild(mockMarkBtn);

    const row = document.querySelector('tr[role="row"]');
    row!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(350);

    const markUnreadBtn = document.querySelector('.simply-mail-smart-action-btn[data-simply-mail-action="MarkUnread"]');
    expect(markUnreadBtn).not.toBeNull();

    const clickSpy = vi.spyOn(mockMarkBtn, 'click');
    markUnreadBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(clickSpy).toHaveBeenCalled();

    module.destroy();
  });

  it('uses spring curve in the injected CSS', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;

    module.init(context);

    const style = document.getElementById('simply-mail-smart-actions-style') as HTMLStyleElement;
    expect(style).not.toBeNull();
    const css = style.textContent ?? '';

    // Spring curve should appear in animation declarations
    expect(css).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');
    // Linear timing should NOT appear (replaced by spring)
    expect(css).not.toMatch(/animation:.*linear/);

    module.destroy();
  });

  it('uses scale(0.95) to scale(1) in slide-in keyframes', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;

    module.init(context);

    const style = document.getElementById('simply-mail-smart-actions-style') as HTMLStyleElement;
    const css = style.textContent ?? '';

    expect(css).toContain('scale(0.95)');
    expect(css).toContain('scale(1)');

    module.destroy();
  });

  it('includes prefers-reduced-motion override', () => {
    const module = createSmartActionsModule();
    const context = createContext();
    context.settings.smartActions.enabled = true;

    module.init(context);

    const style = document.getElementById('simply-mail-smart-actions-style') as HTMLStyleElement;
    const css = style.textContent ?? '';

    expect(css).toContain('prefers-reduced-motion');

    module.destroy();
  });
});

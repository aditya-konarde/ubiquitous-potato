import { createInstantReplyModule, parseReplies } from '@/content/modules/instant-reply';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Partial<ModuleContext>): ModuleContext {
  return {
    observer: {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentView: vi.fn<() => MailView>(() => 'thread'),
      on: vi.fn(() => () => undefined),
    },
    settings: structuredClone(DEFAULT_SETTINGS),
    storage: {
      getSettings: vi.fn(async () => structuredClone(DEFAULT_SETTINGS)),
      setSettings: vi.fn(async () => undefined),
      patchSettings: vi.fn(async () => structuredClone(DEFAULT_SETTINGS)),
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

function triggerThreadDetected(context: ModuleContext, node: Element | null): void {
  const onMock = context.observer.on as ReturnType<typeof vi.fn>;
  for (const call of onMock.mock.calls) {
    const [eventName, handler] = call as [string, (p: unknown) => void];
    if (eventName === 'thread-detected') {
      handler({ node });
    }
  }
}

function createThreadNode(withCalendar = false, withUserLast = false): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-message-id', '123');

  // Add account element so getUserEmail() can resolve the current user's address
  if (withUserLast) {
    const accountEl = document.createElement('a');
    accountEl.setAttribute('aria-label', 'Account: me (me@gmail.com)');
    document.body.appendChild(accountEl);
  }

  const sender1 = document.createElement('span');
  sender1.setAttribute('email', 'alice@example.com');
  el.appendChild(sender1);

  const body1 = document.createElement('div');
  body1.className = 'a3s aiL';
  body1.textContent = 'Hey, can we meet tomorrow?';
  el.appendChild(body1);

  if (withCalendar) {
    const cal = document.createElement('div');
    cal.textContent = 'Calendar invite: meeting.ics';
    el.appendChild(cal);
  }

  const sender2 = document.createElement('span');
  sender2.setAttribute('email', withUserLast ? 'me@gmail.com' : 'bob@example.com');
  el.appendChild(sender2);

  const body2 = document.createElement('div');
  body2.className = 'a3s aiL';
  body2.textContent = 'Sure, 2pm works for me.';
  el.appendChild(body2);

  document.body.appendChild(el);
  return el;
}

describe('parseReplies', () => {
  it('parses a JSON array from AI response', () => {
    const raw = 'Here are the suggestions:\n["Sure!", "Let me check.", "Can we do 3pm?"]';
    const result = parseReplies(raw);
    expect(result).toEqual(['Sure!', 'Let me check.', 'Can we do 3pm?']);
  });

  it('truncates to 3 replies', () => {
    const raw = '["a", "b", "c", "d"]';
    const result = parseReplies(raw);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseReplies('no json here')).toThrow('No JSON array found');
  });

  it('throws on non-array JSON', () => {
    expect(() => parseReplies('{"not": "array"}')).toThrow('No JSON array found');
  });
});

describe('createInstantReplyModule', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('has correct module name', () => {
    const mod = createInstantReplyModule();
    expect(mod.name).toBe('instantReply');
  });

  it('skips when AI not configured (no API key)', async () => {
    const ctx = createContext({
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        ai: { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini' },
        instantReply: { enabled: true, skipCalendarInvites: true, skipPromotions: true },
      },
    });
    const mod = createInstantReplyModule();
    await mod.init(ctx);
    const node = createThreadNode();
    triggerThreadDetected(ctx, node);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.simply-mail-instant-reply-panel')).toBeNull();
    await mod.destroy();
  });

  it('skips when user was last sender', async () => {
    const ctx = createContext({
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        ai: { enabled: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
        instantReply: { enabled: true, skipCalendarInvites: true, skipPromotions: true },
      },
    });
    const mod = createInstantReplyModule();
    await mod.init(ctx);
    const node = createThreadNode(false, true);
    triggerThreadDetected(ctx, node);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.simply-mail-instant-reply-panel')).toBeNull();
    await mod.destroy();
  });

  it('skips when calendar invite detected and skipCalendarInvites is true', async () => {
    const ctx = createContext({
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        ai: { enabled: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
        instantReply: { enabled: true, skipCalendarInvites: true, skipPromotions: true },
      },
    });
    const mod = createInstantReplyModule();
    await mod.init(ctx);
    const node = createThreadNode(true);
    triggerThreadDetected(ctx, node);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector('.simply-mail-instant-reply-panel')).toBeNull();
    await mod.destroy();
  });

  it('renders 3 chips on successful AI response', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: '["Sure, sounds good!", "Let me check and get back.", "Can we do 3pm instead?"]',
                },
              },
            ],
          }),
      }),
    );
    try {
      const ctx = createContext({
        settings: {
          ...structuredClone(DEFAULT_SETTINGS),
          ai: { enabled: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
          instantReply: { enabled: true, skipCalendarInvites: true, skipPromotions: true },
        },
      });
      const mod = createInstantReplyModule();
      await mod.init(ctx);
      const node = createThreadNode();
      triggerThreadDetected(ctx, node);
      await new Promise((r) => setTimeout(r, 100));
      const chips = document.querySelectorAll('.simply-mail-instant-reply-chip');
      expect(chips.length).toBe(3);
      expect(chips[0]!.textContent).toBe('Sure, sounds good!');
      await mod.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('removes panel on AI error', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('Server error') }),
    );
    try {
      const ctx = createContext({
        settings: {
          ...structuredClone(DEFAULT_SETTINGS),
          ai: { enabled: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
          instantReply: { enabled: true, skipCalendarInvites: true, skipPromotions: true },
        },
      });
      const mod = createInstantReplyModule();
      await mod.init(ctx);
      const node = createThreadNode();
      triggerThreadDetected(ctx, node);
      await new Promise((r) => setTimeout(r, 100));
      expect(document.querySelector('.simply-mail-instant-reply-panel')).toBeNull();
      await mod.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cleans up panel and styles on destroy', async () => {
    const ctx = createContext({
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        ai: { enabled: true, provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
        instantReply: { enabled: true, skipCalendarInvites: true, skipPromotions: true },
      },
    });
    const mod = createInstantReplyModule();
    await mod.init(ctx);
    const panel = document.createElement('div');
    panel.className = 'simply-mail-instant-reply-panel';
    document.body.appendChild(panel);
    await mod.destroy();
    expect(document.querySelector('.simply-mail-instant-reply-panel')).toBeNull();
    expect(document.getElementById('simply-mail-instant-reply')).toBeNull();
  });
});

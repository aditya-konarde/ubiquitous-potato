import { createAutoCcBccModule } from '@/content/modules/auto-cc-bcc';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(settingsOverrides?: Partial<ModuleContext['settings']>): ModuleContext {
  const settings = { ...structuredClone(DEFAULT_SETTINGS), ...settingsOverrides };
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

/**
 * Build a email app-like compose dialog DOM.
 */
function setupComposeDOM(opts: { subject?: string; hasQuote?: boolean; ccFieldVisible?: boolean; bccFieldVisible?: boolean } = {}) {
  const { subject = '', hasQuote = false, ccFieldVisible = false, bccFieldVisible = false } = opts;

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');

  // Subject
  const subjectInput = document.createElement('input');
  subjectInput.name = 'subjectbox';
  subjectInput.value = subject;
  dialog.appendChild(subjectInput);

  // Optional quoted text
  if (hasQuote) {
    const quote = document.createElement('div');
    quote.className = 'gmail_quote';
    quote.textContent = 'quoted text';
    dialog.appendChild(quote);
  }

  // CC/BCC toggle links (always present in DOM, clicking reveals fields)
  const ccLink = document.createElement('span');
  ccLink.id = 'link-cc';
  ccLink.setAttribute('role', 'link');
  ccLink.textContent = 'Cc';
  dialog.appendChild(ccLink);

  const bccLink = document.createElement('span');
  bccLink.id = 'link-bcc';
  bccLink.setAttribute('role', 'link');
  bccLink.textContent = 'Bcc';
  dialog.appendChild(bccLink);

  // CC field (only in DOM if already visible)
  if (ccFieldVisible) {
    const ccField = document.createElement('textarea');
    ccField.name = 'cc';
    dialog.appendChild(ccField);
  }

  // BCC field (only in DOM if already visible)
  if (bccFieldVisible) {
    const bccField = document.createElement('textarea');
    bccField.name = 'bcc';
    dialog.appendChild(bccField);
  }

  document.body.appendChild(dialog);
  return dialog;
}

describe('createAutoCcBccModule', () => {
  let composeHandler: ((payload: { node: Element | null }) => void) | null = null;

  function captureHandler(context: ModuleContext) {
    const onSpy = context.observer.on as ReturnType<typeof vi.fn>;
    onSpy.mockImplementation((event: string, handler: (payload: { node: Element | null }) => void) => {
      if (event === 'compose-detected') {
        composeHandler = handler;
      }
      return () => undefined;
    });
  }

  function triggerCompose(node: Element | null) {
    if (composeHandler) {
      composeHandler({ node });
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    document.getElementById('simply-mail-auto-cc-bcc-style')?.remove();
    composeHandler = null;
  });

  it('returns a module named autoCcBcc', () => {
    const module = createAutoCcBccModule();
    expect(module.name).toBe('autoCcBcc');
  });

  it('has init and destroy lifecycle methods', () => {
    const module = createAutoCcBccModule();
    expect(typeof module.init).toBe('function');
    expect(typeof module.destroy).toBe('function');
  });

  it('subscribes to compose-detected event on init', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    module.init(context);

    expect(context.observer.on).toHaveBeenCalledWith('compose-detected', expect.any(Function));
    module.destroy();
  });

  it('does nothing when disabled', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = false;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    expect(ccField?.value).toBe('');
    module.destroy();
  });

  it('adds CC recipients on new compose when mode is "new"', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'new';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    expect(ccField?.value).toBe('cc@example.com');
    module.destroy();
  });

  it('adds BCC recipients on new compose', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.bcc = ['bcc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', bccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const bccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="bcc"]');
    expect(bccField?.value).toBe('bcc@example.com');
    module.destroy();
  });

  it('adds both CC and BCC recipients simultaneously', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc1@example.com'];
    context.settings.autoCcBcc.bcc = ['bcc1@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true, bccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    const bccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="bcc"]');
    expect(ccField?.value).toBe('cc1@example.com');
    expect(bccField?.value).toBe('bcc1@example.com');
    module.destroy();
  });

  it('does not add CC on reply when mode is "new"', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'new';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Re: Hello', ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    expect(ccField?.value).toBe('');
    module.destroy();
  });

  it('adds CC on reply when mode is "reply"', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'reply';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Re: Hello', ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    expect(ccField?.value).toBe('cc@example.com');
    module.destroy();
  });

  it('does not add CC on new compose when mode is "reply"', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'reply';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    expect(ccField?.value).toBe('');
    module.destroy();
  });

  it('detects reply by quoted text even without Re: prefix', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'reply';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', hasQuote: true, ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]');
    expect(ccField?.value).toBe('cc@example.com');
    module.destroy();
  });

  it('cleans up style element on destroy', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    // Style should be injected
    expect(document.getElementById('simply-mail-auto-cc-bcc-style')).not.toBeNull();

    module.destroy();

    // Style should be removed
    expect(document.getElementById('simply-mail-auto-cc-bcc-style')).toBeNull();
  });

  it('does not duplicate already-present recipients', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    const ccField = dialog.querySelector<HTMLTextAreaElement>('textarea[name="cc"]')!;
    ccField.value = 'cc@example.com';

    triggerCompose(dialog);
    vi.advanceTimersByTime(100);

    // Should not duplicate
    expect(ccField.value).toBe('cc@example.com');
    module.destroy();
  });

  it('unsubscribes from observer on destroy', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    const unsubscribe = vi.fn();
    (context.observer.on as ReturnType<typeof vi.fn>).mockReturnValue(unsubscribe);

    module.init(context);
    expect(unsubscribe).not.toHaveBeenCalled();

    module.destroy();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('adds (auto) badge next to CC field', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);

    vi.advanceTimersByTime(100);

    const badge = dialog.querySelector('.simply-mail-auto-badge[data-field="cc"]');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('(auto)');
    module.destroy();
  });

  it('removes (auto) badges on destroy', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);
    vi.advanceTimersByTime(100);

    expect(dialog.querySelector('.simply-mail-auto-badge')).not.toBeNull();

    module.destroy();

    expect(dialog.querySelector('.simply-mail-auto-badge')).toBeNull();
  });

  it('shows status badge "Auto CC/BCC active" when recipients are configured', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);
    vi.advanceTimersByTime(100);

    const statusBadge = dialog.querySelector('.simply-mail-auto-status-badge');
    expect(statusBadge).not.toBeNull();
    expect(statusBadge?.getAttribute('data-status')).toBe('active');
    expect(statusBadge?.textContent).toBe('Auto CC/BCC active');
    module.destroy();
  });

  it('shows status badge "Auto CC/BCC: no recipients" when enabled but no recipients', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = [];
    context.settings.autoCcBcc.bcc = [];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello' });
    triggerCompose(dialog);
    vi.advanceTimersByTime(100);

    const statusBadge = dialog.querySelector('.simply-mail-auto-status-badge');
    expect(statusBadge).not.toBeNull();
    expect(statusBadge?.getAttribute('data-status')).toBe('warning');
    expect(statusBadge?.textContent).toBe('Auto CC/BCC: no recipients');
    module.destroy();
  });

  it('does not show status badge when auto-cc-bcc is disabled', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = false;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello' });
    triggerCompose(dialog);
    vi.advanceTimersByTime(100);

    const statusBadge = dialog.querySelector('.simply-mail-auto-status-badge');
    expect(statusBadge).toBeNull();
    module.destroy();
  });

  it('removes status badge on destroy', () => {
    const module = createAutoCcBccModule();
    const context = createContext();
    context.settings.autoCcBcc.enabled = true;
    context.settings.autoCcBcc.cc = ['cc@example.com'];
    context.settings.autoCcBcc.mode = 'both';
    captureHandler(context);

    module.init(context);
    const dialog = setupComposeDOM({ subject: 'Hello', ccFieldVisible: true });
    triggerCompose(dialog);
    vi.advanceTimersByTime(100);

    expect(dialog.querySelector('.simply-mail-auto-status-badge')).not.toBeNull();

    module.destroy();

    expect(dialog.querySelector('.simply-mail-auto-status-badge')).toBeNull();
  });
});

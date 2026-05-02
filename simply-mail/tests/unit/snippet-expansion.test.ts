import { createSnippetExpansionModule, findMatchingTrigger } from '@/content/modules/snippet-expansion';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext, Snippet } from '@/shared/types';

const TEST_SNIPPETS: Snippet[] = [
  { id: 'thanks', trigger: ';thanks', body: 'Thanks so much!' },
  { id: 'br', trigger: ';br', body: 'Best regards,' },
];

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

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('findMatchingTrigger', () => {
  it('expands a known trigger followed by a space', () => {
    expect(findMatchingTrigger(';thanks ', TEST_SNIPPETS)).toEqual(TEST_SNIPPETS[0]);
  });

  it('does not expand an unknown trigger', () => {
    expect(findMatchingTrigger(';unknown ', TEST_SNIPPETS)).toBeNull();
  });

  it('does not expand a trigger in the middle of a word', () => {
    expect(findMatchingTrigger('hello;thanks ', TEST_SNIPPETS)).toBeNull();
  });

  it('expands a trigger at the start of the text', () => {
    expect(findMatchingTrigger(';thanks ', TEST_SNIPPETS)).toEqual(TEST_SNIPPETS[0]);
  });

  it('expands a trigger after a space', () => {
    expect(findMatchingTrigger('Hello ;thanks ', TEST_SNIPPETS)).toEqual(TEST_SNIPPETS[0]);
  });

  it('expands a trigger after a newline', () => {
    expect(findMatchingTrigger('Hello\n;thanks ', TEST_SNIPPETS)).toEqual(TEST_SNIPPETS[0]);
  });

  it('does not match a trigger without the trailing space', () => {
    expect(findMatchingTrigger(';thanks', TEST_SNIPPETS)).toBeNull();
  });

  it('returns null when the snippets array is empty', () => {
    expect(findMatchingTrigger(';thanks ', [])).toBeNull();
  });

  it('matches the first matching snippet when multiple are present', () => {
    const result = findMatchingTrigger(';br ', TEST_SNIPPETS);
    expect(result).toEqual(TEST_SNIPPETS[1]);
  });
});

// ---------------------------------------------------------------------------
// Module lifecycle tests
// ---------------------------------------------------------------------------

describe('createSnippetExpansionModule', () => {
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

  afterEach(() => {
    document.body.innerHTML = '';
    composeHandler = null;
  });

  it('returns a module named snippetExpansion', () => {
    const module = createSnippetExpansionModule();
    expect(module.name).toBe('snippetExpansion');
  });

  it('has init and destroy lifecycle methods', () => {
    const module = createSnippetExpansionModule();
    expect(typeof module.init).toBe('function');
    expect(typeof module.destroy).toBe('function');
  });

  it('subscribes to compose-detected event on init', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    module.init(context);

    expect(context.observer.on).toHaveBeenCalledWith('compose-detected', expect.any(Function));
    module.destroy();
  });

  it('unsubscribes from observer on destroy', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    const unsubscribe = vi.fn();
    (context.observer.on as ReturnType<typeof vi.fn>).mockReturnValue(unsubscribe);

    module.init(context);
    expect(unsubscribe).not.toHaveBeenCalled();

    module.destroy();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('attaches an input listener to the compose body element', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    context.settings.snippets = TEST_SNIPPETS;
    captureHandler(context);

    module.init(context);

    // Build a email app-like compose dialog
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    body.setAttribute('aria-label', 'Message Body');
    body.setAttribute('contenteditable', 'true');
    body.setAttribute('role', 'textbox');
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    const addSpy = vi.spyOn(body, 'addEventListener');
    composeHandler!({ node: dialog });

    expect(addSpy).toHaveBeenCalledWith('input', expect.any(Function));
    module.destroy();
  });

  it('does not attach a listener twice to the same compose body', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    context.settings.snippets = TEST_SNIPPETS;
    captureHandler(context);

    module.init(context);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    body.setAttribute('aria-label', 'Message Body');
    body.setAttribute('contenteditable', 'true');
    body.setAttribute('role', 'textbox');
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    const addSpy = vi.spyOn(body, 'addEventListener');
    composeHandler!({ node: dialog });
    composeHandler!({ node: dialog });

    expect(addSpy).toHaveBeenCalledTimes(1);
    module.destroy();
  });

  it('removes input listeners on destroy', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    context.settings.snippets = TEST_SNIPPETS;
    captureHandler(context);

    module.init(context);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    body.setAttribute('aria-label', 'Message Body');
    body.setAttribute('contenteditable', 'true');
    body.setAttribute('role', 'textbox');
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    composeHandler!({ node: dialog });

    const removeSpy = vi.spyOn(body, 'removeEventListener');
    module.destroy();

    expect(removeSpy).toHaveBeenCalledWith('input', expect.any(Function));
  });

  it('expands a known trigger in a contenteditable div', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    context.settings.snippets = TEST_SNIPPETS;
    captureHandler(context);

    module.init(context);

    // Build compose dialog
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    body.setAttribute('aria-label', 'Message Body');
    body.setAttribute('contenteditable', 'true');
    body.setAttribute('role', 'textbox');
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    composeHandler!({ node: dialog });

    // Simulate user typing ";thanks " — set text and cursor at end
    body.textContent = ';thanks ';
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    const textNode = body.firstChild!;
    range.setStart(textNode, ';thanks '.length);
    range.collapse(true);
    selection?.addRange(range);

    // Dispatch input event as if space was typed
    const inputEvent = new InputEvent('input', {
      inputType: 'insertText',
      data: ' ',
      bubbles: true,
    });
    body.dispatchEvent(inputEvent);

    expect(body.textContent).toBe('Thanks so much!');

    module.destroy();
  });

  it('does not expand an unknown trigger in a contenteditable div', () => {
    const module = createSnippetExpansionModule();
    const context = createContext();
    context.settings.snippets = TEST_SNIPPETS;
    captureHandler(context);

    module.init(context);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const body = document.createElement('div');
    body.setAttribute('aria-label', 'Message Body');
    body.setAttribute('contenteditable', 'true');
    body.setAttribute('role', 'textbox');
    dialog.appendChild(body);
    document.body.appendChild(dialog);

    composeHandler!({ node: dialog });

    body.textContent = ';unknown ';
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const range = document.createRange();
    const textNode = body.firstChild!;
    range.setStart(textNode, ';unknown '.length);
    range.collapse(true);
    selection?.addRange(range);

    const inputEvent = new InputEvent('input', {
      inputType: 'insertText',
      data: ' ',
      bubbles: true,
    });
    body.dispatchEvent(inputEvent);

    expect(body.textContent).toBe(';unknown ');

    module.destroy();
  });
});

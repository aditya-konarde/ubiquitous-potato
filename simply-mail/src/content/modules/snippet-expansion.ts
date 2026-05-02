import type { ModuleContext, SimplyMailModule, SimplyMailSettings, Snippet } from '@/shared/types';

/**
 * Find a matching snippet trigger at the end of the text before the cursor.
 * The trigger must be followed by a space and preceded by start-of-text or whitespace.
 */
export function findMatchingTrigger(
  textBeforeCursor: string,
  snippets: ReadonlyArray<Snippet>,
): Snippet | null {
  for (const snippet of snippets) {
    const suffix = snippet.trigger + ' ';
    if (textBeforeCursor.endsWith(suffix)) {
      const beforeTrigger = textBeforeCursor.slice(0, -suffix.length);
      if (beforeTrigger.length === 0 || /\s$/.test(beforeTrigger)) {
        return snippet;
      }
    }
  }
  return null;
}

/**
 * Get the text content of a contenteditable element before the cursor.
 */
function getTextBeforeCursor(el: HTMLElement): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const preRange = document.createRange();
  preRange.setStart(el, 0);
  preRange.setEnd(range.startContainer, range.startOffset);

  return preRange.toString();
}

/**
 * Replace the last occurrence of `trigger + ' '` in a contenteditable element
 * with the snippet body. Repositions the cursor after the replacement.
 */
function replaceInEditable(el: HTMLElement, trigger: string, body: string): void {
  const text = el.textContent ?? '';
  const searchFor = trigger + ' ';
  const index = text.lastIndexOf(searchFor);
  if (index === -1) return;

  // Verify the trigger is at start-of-text or preceded by whitespace
  if (index > 0 && !/\s/.test(text[index - 1])) return;

  const before = text.substring(0, index);
  const after = text.substring(index + searchFor.length);
  el.textContent = before + body + after;

  // Reposition cursor after the replacement (best-effort)
  try {
    const selection = window.getSelection();
    if (selection && el.firstChild) {
      const targetOffset = before.length + body.length;
      const range = document.createRange();
      let currentOffset = 0;
      let found = false;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const len = node.textContent?.length ?? 0;
        if (currentOffset + len >= targetOffset) {
          range.setStart(node, targetOffset - currentOffset);
          found = true;
          break;
        }
        currentOffset += len;
      }
      if (found) {
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  } catch {
    // Cursor repositioning is best-effort
  }
}

/**
 * Create an input event handler that expands snippet triggers.
 * The handler reads snippets from context.settings at event time
 * so settings updates are reflected immediately.
 */
function createInputHandler(context: ModuleContext): (e: Event) => void {
  return (e: Event) => {
    const inputEvent = e as InputEvent;
    if (inputEvent.inputType !== 'insertText') return;
    if (inputEvent.data !== ' ') return;

    const el = e.currentTarget as HTMLElement;
    const snippets = context.settings.snippets;
    if (snippets.length === 0) return;

    const textBeforeCursor = getTextBeforeCursor(el);
    if (textBeforeCursor === null) return;

    const match = findMatchingTrigger(textBeforeCursor, snippets);
    if (!match) return;

    replaceInEditable(el, match.trigger, match.body);
  };
}

const COMPOSE_BODY_SELECTOR =
  'div[aria-label="Message Body"], div[contenteditable="true"][role="textbox"]';

export function createSnippetExpansionModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];
  const attachedElements = new WeakSet<HTMLElement>();
  const handlers = new WeakMap<HTMLElement, (e: Event) => void>();

  return {
    name: 'snippetExpansion',

    init(context: ModuleContext) {
      unsubscribers = [
        context.observer.on('compose-detected', (payload) => {
          if (!payload.node) return;
          const composeBody = payload.node.querySelector<HTMLElement>(COMPOSE_BODY_SELECTOR);
          if (!composeBody || attachedElements.has(composeBody)) return;

          const handler = createInputHandler(context);
          handlers.set(composeBody, handler);
          attachedElements.add(composeBody);
          composeBody.addEventListener('input', handler);
        }),
      ];
    },

    onSettingsChange(_settings: SimplyMailSettings) {
      // Settings are read from context.settings at event time, so no action needed.
      // New compose windows will automatically use updated settings.
    },

    destroy() {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];

      // Remove input listeners from all tracked compose bodies still in the DOM
      document.querySelectorAll<HTMLElement>(COMPOSE_BODY_SELECTOR).forEach((el) => {
        const handler = handlers.get(el);
        if (handler) {
          el.removeEventListener('input', handler);
          handlers.delete(el);
        }
      });
    },
  };
}

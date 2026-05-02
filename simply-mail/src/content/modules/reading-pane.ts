import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle } from './dom-utils';
import { extractSenderFromRow, extractSubjectFromRow } from './row-utils';
import type { MailView, ModuleContext, SimplyMailModule } from '@/shared/types';

const ROOT_ID = 'simply-mail-reading-pane';
const STYLE_ID = `${ROOT_ID}-style`;
const SUPPORTED_VIEWS = new Set<MailView>(['inbox', 'search', 'label']);

function isSupportedView(view: MailView): boolean {
  return SUPPORTED_VIEWS.has(view);
}

function extractSenderName(row: Element): string {
  const nameEl = row.querySelector('.zF, .yW span[email]');
  if (nameEl) {
    return nameEl.textContent?.trim() ?? '';
  }
  const sender = extractSenderFromRow(row);
  return sender.split('@')[0] || '?';
}

function extractSnippet(row: Element): string {
  const snippetEl = row.querySelector('.y2');
  return snippetEl?.textContent?.trim() ?? '';
}

function extractDate(row: Element): string {
  const timeEl = row.querySelector('time[datetime]');
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime');
    if (dt) {
      const parsed = new Date(dt);
      if (!isNaN(parsed.getTime())) {
        const now = new Date();
        const isToday = parsed.toDateString() === now.toDateString();
        if (isToday) {
          return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    }
  }
  const dateSpan = row.querySelector('.xW span');
  return dateSpan?.textContent?.trim() ?? '';
}

function hasAttachment(row: Element): boolean {
  return Boolean(row.querySelector('[aria-label*="attachment"], [data-tooltip*="attachment"]'));
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

function buildCss(): string {
  return `
    #${ROOT_ID} {
      position: fixed;
      top: 56px;
      right: 0;
      width: 400px;
      height: calc(100vh - 56px);
      background: #ffffff;
      border-left: 1px solid #e4e4e7;
      z-index: 50;
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 200ms ease;
      opacity: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 24px;
      box-sizing: border-box;
    }
    #${ROOT_ID}.is-visible {
      transform: translateX(0);
      opacity: 1;
    }
    #${ROOT_ID}.is-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #a1a1aa;
      font-size: 13px;
    }
    .${ROOT_ID}-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f4f4f5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: #52525b;
      flex-shrink: 0;
    }
    .${ROOT_ID}-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .${ROOT_ID}-sender {
      font-size: 14px;
      font-weight: 600;
      color: #000000;
    }
    .${ROOT_ID}-date {
      font-size: 12px;
      color: #a1a1aa;
      margin-left: auto;
      white-space: nowrap;
    }
    .${ROOT_ID}-subject {
      font-size: 16px;
      font-weight: 600;
      color: #000000;
      margin: 0 0 12px;
      letter-spacing: 0;
      line-height: 1.4;
    }
    .${ROOT_ID}-snippet {
      font-size: 14px;
      color: #52525b;
      line-height: 1.6;
      margin: 0 0 16px;
    }
    .${ROOT_ID}-attachment {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #f4f4f5;
      border: 1px solid #e4e4e7;
      font-size: 12px;
      color: #52525b;
    }
    .${ROOT_ID}-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #a1a1aa;
      font-size: 13px;
      text-align: center;
    }
    .${ROOT_ID}-empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
    /* Dark mode */
    html.simply-mail-dark-mode #${ROOT_ID} {
      background: #0a0a0a;
      border-left-color: #27272a;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-avatar {
      background: #27272a;
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-sender {
      color: #ffffff;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-subject {
      color: #ffffff;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-snippet {
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-attachment {
      background: #171717;
      border-color: #27272a;
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-date {
      color: #52525b;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-empty-state {
      color: #52525b;
    }
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      #${ROOT_ID} {
        transition: none;
      }
    }
  `;
}

export function createReadingPaneModule(): SimplyMailModule {
  let context: ModuleContext;
  let pane: HTMLElement | null = null;
  let selectedRow: Element | null = null;
  const unsubscribers: (() => void)[] = [];

  function ensurePane(): HTMLElement {
    if (pane) return pane;
    pane = document.createElement('div');
    pane.id = ROOT_ID;
    document.documentElement.appendChild(pane);
    return pane;
  }

  function updateContent(row: Element): void {
    const el = ensurePane();
    const senderName = extractSenderName(row);
    const subject = extractSubjectFromRow(row);
    const snippet = extractSnippet(row);
    const date = extractDate(row);
    const attachment = hasAttachment(row);
    const initials = getInitials(senderName);

    el.classList.remove('is-empty');

    el.innerHTML = '';
    const header = document.createElement('div');
    header.className = `${ROOT_ID}-header`;

    const avatar = document.createElement('div');
    avatar.className = `${ROOT_ID}-avatar`;
    avatar.textContent = initials;
    header.appendChild(avatar);

    const senderDiv = document.createElement('div');
    senderDiv.className = `${ROOT_ID}-sender`;
    senderDiv.textContent = senderName;
    header.appendChild(senderDiv);

    const dateDiv = document.createElement('div');
    dateDiv.className = `${ROOT_ID}-date`;
    dateDiv.textContent = date;
    header.appendChild(dateDiv);

    el.appendChild(header);

    if (subject) {
      const subjectEl = document.createElement('div');
      subjectEl.className = `${ROOT_ID}-subject`;
      subjectEl.textContent = subject;
      el.appendChild(subjectEl);
    }

    if (snippet) {
      const snippetEl = document.createElement('div');
      snippetEl.className = `${ROOT_ID}-snippet`;
      snippetEl.textContent = snippet;
      el.appendChild(snippetEl);
    }

    if (attachment) {
      const attEl = document.createElement('div');
      attEl.className = `${ROOT_ID}-attachment`;
      attEl.textContent = '\uD83D\uDCCE Has attachment';
      el.appendChild(attEl);
    }

    requestAnimationFrame(() => {
      el.classList.add('is-visible');
    });
  }

  function hide(): void {
    if (pane) {
      pane.classList.remove('is-visible');
    }
  }

  function checkSelection(): void {
    const view = context.observer.getCurrentView();
    if (!isSupportedView(view)) {
      hide();
      return;
    }

    const selected = document.querySelector(MAIL_SELECTORS.selectedRow);
    if (selected && selected !== selectedRow) {
      selectedRow = selected;
      updateContent(selected);
    } else if (!selected) {
      selectedRow = null;
      hide();
    }
  }

  function onViewChanged(): void {
    const view = context.observer.getCurrentView();
    if (!isSupportedView(view)) {
      hide();
    } else {
      checkSelection();
    }
  }

  return {
    name: 'readingPane',

    async init(ctx: ModuleContext): Promise<void> {
      context = ctx;
      ensureStyle(STYLE_ID, buildCss());
      unsubscribers.push(context.observer.on('view-changed', onViewChanged));
      unsubscribers.push(context.observer.on('inbox-updated', checkSelection));

      const view = context.observer.getCurrentView();
      if (isSupportedView(view)) {
        checkSelection();
      }
    },

    destroy(): void {
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers.length = 0;
      if (pane) {
        pane.remove();
        pane = null;
      }
      removeStyle(STYLE_ID);
      selectedRow = null;
    },

    onSettingsChange(settings): void {
      if (!settings.readingPane.enabled) {
        hide();
      }
    },
  };
}

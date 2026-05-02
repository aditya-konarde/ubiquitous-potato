import { MAIL_SELECTORS } from '../mail-selectors';
import { callAi } from '@/shared/ai-client';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

function getUserEmail(): string {
  const accountEl = document.querySelector(MAIL_SELECTORS.accountElement);
  if (!accountEl) return '';
  const label = accountEl.getAttribute('aria-label') ?? '';
  const match = label.match(/\(([^)]+@[^)]+)\)/);
  return match ? match[1].trim().toLowerCase() : '';
}

const STYLE_ID = 'simply-mail-instant-reply';
const MAX_CHARS = 5000;
const SYSTEM_PROMPT =
  'You are an email assistant. Given the email thread below, generate 3 short, distinct reply options. Each should be 1-3 sentences. Reply ONLY with a JSON array of 3 strings, nothing else.';

const PANEL_CSS = `
.simply-mail-instant-reply-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 8px 0;
  background: var(--simply-mail-surface, #ffffff);
  border: 1px solid var(--simply-mail-border, #e4e4e7);
  border-radius: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  flex-wrap: wrap;
}
.simply-mail-instant-reply-chip {
  padding: 8px 14px;
  border: 1px solid var(--simply-mail-border, #e4e4e7);
  border-radius: 0;
  background: var(--simply-mail-bg-surface-muted, #f4f4f5);
  cursor: pointer;
  font-size: 13px;
  line-height: 1.4;
  color: var(--simply-mail-text-strong, #000000);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: border-color 0.15s, background 0.15s;
}
.simply-mail-instant-reply-chip:hover {
  border-color: var(--simply-mail-text-strong, #000000);
  background: var(--simply-mail-hover, #f8fafc);
}
html.simply-mail-dark-mode .simply-mail-instant-reply-panel {
  background: var(--simply-mail-surface, #0a0a0a);
  border-color: #27272a;
}
html.simply-mail-dark-mode .simply-mail-instant-reply-chip {
  border-color: #27272a;
  background: #171717;
  color: #ffffff;
}
html.simply-mail-dark-mode .simply-mail-instant-reply-chip:hover {
  border-color: #ffffff;
  background: #111111;
}
.simply-mail-instant-reply-loading {
  font-size: 13px;
  color: var(--simply-mail-text-muted, #52525b);
  display: flex;
  align-items: center;
  gap: 6px;
}
html.simply-mail-dark-mode .simply-mail-instant-reply-loading {
  color: #a1a1aa;
}
.simply-mail-instant-reply-loading::before {
  content: '';
  width: 14px;
  height: 14px;
  border: 2px solid var(--simply-mail-border, #e4e4e7);
  border-top-color: var(--simply-mail-text-strong, #000000);
  border-radius: 50%;
  animation: simply-mail-spin 0.6s linear infinite;
}
html.simply-mail-dark-mode .simply-mail-instant-reply-loading::before {
  border-color: #27272a;
  border-top-color: #ffffff;
}
@keyframes simply-mail-spin {
  to { transform: rotate(360deg); }
}
.simply-mail-instant-reply-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: var(--simply-mail-text-muted, #52525b);
  padding: 2px 6px;
  line-height: 1;
  border-radius: 0;
}
html.simply-mail-dark-mode .simply-mail-instant-reply-dismiss {
  color: #a1a1aa;
}
.simply-mail-instant-reply-dismiss:hover {
  background: var(--simply-mail-hover, #f4f4f5);
}
html.simply-mail-dark-mode .simply-mail-instant-reply-dismiss:hover {
  background: #111111;
}
`;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PANEL_CSS;
  document.head.appendChild(style);
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

function getLastMessageContainer(threadNode: Element): Element | null {
  const messages = threadNode.querySelectorAll(MAIL_SELECTORS.messageBodies);
  if (!messages.length) return null;
  return messages[messages.length - 1]!.parentElement ?? messages[messages.length - 1];
}

function extractThreadText(threadNode: Element): string {
  const bodies = threadNode.querySelectorAll(MAIL_SELECTORS.messageBodies);
  const parts: string[] = [];
  for (const body of bodies) {
    const text = body.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join('\n---\n').slice(0, MAX_CHARS);
}

function hasCalendarInvite(threadNode: Element): boolean {
  const hasAttachment = threadNode.querySelector('a[href*=".ics"], a[href*="calendar.google.com"]');
  if (hasAttachment) return true;

  const text = threadNode.textContent ?? '';
  return /\b(invite|calendar|\.ics)\b/i.test(text);
}

function wasUserLastSender(threadNode: Element): boolean {
  const senders = threadNode.querySelectorAll('[email]');
  if (!senders.length) return false;
  const last = senders[senders.length - 1] as HTMLElement;
  const email = (last.getAttribute('email') ?? '').toLowerCase();
  if (!email) return true;
  const userEmail = getUserEmail();
  if (userEmail) return email === userEmail;
  const textContent = last.textContent?.trim().toLowerCase() ?? '';
  return textContent === 'me' || email === '';
}

function removeExistingPanel(): void {
  document.querySelector('.simply-mail-instant-reply-panel')?.remove();
}

function showLoading(container: Element): HTMLElement {
  removeExistingPanel();
  const panel = document.createElement('div');
  panel.className = 'simply-mail-instant-reply-panel';

  const loading = document.createElement('span');
  loading.className = 'simply-mail-instant-reply-loading';
  loading.textContent = 'Simply Mail is thinking\u2026';
  panel.appendChild(loading);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'simply-mail-instant-reply-dismiss';
  dismissBtn.title = 'Dismiss';
  dismissBtn.textContent = '\u00d7';
  dismissBtn.addEventListener('click', () => panel.remove());
  panel.appendChild(dismissBtn);

  container.after(panel);
  return panel;
}

function showChips(container: Element, replies: string[]): void {
  removeExistingPanel();
  const panel = document.createElement('div');
  panel.className = 'simply-mail-instant-reply-panel';
  for (const reply of replies) {
    const chip = document.createElement('div');
    chip.className = 'simply-mail-instant-reply-chip';
    chip.textContent = reply;
    chip.title = reply;
    chip.addEventListener('click', () => insertIntoReplyBox(reply));
    panel.appendChild(chip);
  }
  const dismiss = document.createElement('button');
  dismiss.className = 'simply-mail-instant-reply-dismiss';
  dismiss.title = 'Dismiss';
  dismiss.textContent = '\u00d7';
  dismiss.addEventListener('click', () => panel.remove());
  panel.appendChild(dismiss);
  container.after(panel);
}

function insertIntoReplyBox(text: string): void {
  const editable = document.querySelector<HTMLElement>(
    '[contenteditable="true"].g_editable, [contenteditable="true"][aria-label*="Reply"], [contenteditable="true"][aria-label*="Response"]',
  );
  if (editable) {
    editable.focus();
    editable.textContent = text;
    editable.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // Fallback: click reply button first, then try again after short delay
  const replyBtn = document.querySelector<HTMLElement>(MAIL_SELECTORS.replyButton);
  if (replyBtn) {
    replyBtn.click();
    setTimeout(() => {
      const ed = document.querySelector<HTMLElement>(
        '[contenteditable="true"].g_editable, [contenteditable="true"][aria-label*="Reply"], [contenteditable="true"][aria-label*="Response"]',
      );
      if (ed) {
        ed.focus();
        ed.textContent = text;
        ed.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 500);
  }
}

export function parseReplies(raw: string): string[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in AI response');
  const arr = JSON.parse(match[0]);
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('AI response is not a non-empty array');
  return arr.slice(0, 3).map(String);
}

export function createInstantReplyModule(): SimplyMailModule {
  let unsubscriber: (() => void) | null = null;

  async function handleThreadDetected(payload: { node: Element | null }, context: ModuleContext): Promise<void> {
    if (!payload.node) return;
    const { settings } = context;
    const { instantReply, ai } = settings;

    if (!instantReply.enabled) return;
    if (!ai.enabled || !ai.apiKey) return;

    if (instantReply.skipCalendarInvites && hasCalendarInvite(payload.node!)) {
      return;
    }
    if (wasUserLastSender(payload.node)) {
      return;
    }

    const threadText = extractThreadText(payload.node);
    if (!threadText.trim()) return;

    const lastMsg = getLastMessageContainer(payload.node);
    if (!lastMsg) return;

    const panel = showLoading(lastMsg);

    try {
      const raw = await callAi(ai, SYSTEM_PROMPT, threadText);
      const replies = parseReplies(raw);
      showChips(lastMsg, replies);
    } catch {
      panel.remove();
    }
  }

  return {
    name: 'instantReply',

    init(context) {
      injectStyles();
      unsubscriber = context.observer.on('thread-detected', (payload) => {
        void handleThreadDetected(payload, context);
      });
    },

    onSettingsChange(settings, context) {
      if (settings.instantReply.enabled && settings.ai.enabled && settings.ai.apiKey) {
        const threadNode = document.querySelector(MAIL_SELECTORS.threadContainer);
        if (threadNode) {
          void handleThreadDetected({ node: threadNode }, context);
        }
      }
    },

    destroy() {
      if (unsubscriber) {
        unsubscriber();
        unsubscriber = null;
      }
      removeExistingPanel();
      removeStyles();
    },
  };
}

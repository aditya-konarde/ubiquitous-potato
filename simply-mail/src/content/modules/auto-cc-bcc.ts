import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-auto-cc-bcc-style';
const AUTO_BADGE_CLASS = 'simply-mail-auto-badge';
const STATUS_BADGE_CLASS = 'simply-mail-auto-status-badge';

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${AUTO_BADGE_CLASS} {
        display: inline-block;
        font-size: 10px;
        color: var(--simply-mail-text-muted, #52525b);
        background: var(--simply-mail-bg-surface-muted, #f4f4f5);
        border: 1px solid var(--simply-mail-border, #e4e4e7);
        padding: 0 4px;
        margin-left: 2px;
        vertical-align: middle;
        line-height: 16px;
        border-radius: 0;
      }
      html.simply-mail-dark-mode .${AUTO_BADGE_CLASS} {
        color: #a1a1aa;
        background: #171717;
        border-color: #27272a;
      }
      .${STATUS_BADGE_CLASS} {
        display: inline-block;
        font-size: 11px;
        padding: 1px 6px;
        margin: 4px 0 2px 0;
        line-height: 16px;
        border-radius: 0;
      }
      .${STATUS_BADGE_CLASS}[data-status="active"] {
        color: var(--simply-mail-text-muted, #52525b);
        background: var(--simply-mail-bg-surface-muted, #f4f4f5);
        border: 1px solid var(--simply-mail-border, #e4e4e7);
      }
      .${STATUS_BADGE_CLASS}[data-status="warning"] {
        color: #92400e;
        background: #fef3c7;
        border: 1px solid #fcd34d;
      }
      html.simply-mail-dark-mode .${STATUS_BADGE_CLASS}[data-status="active"] {
        color: #a1a1aa;
        background: #171717;
        border-color: #27272a;
      }
      html.simply-mail-dark-mode .${STATUS_BADGE_CLASS}[data-status="warning"] {
        color: #fbbf24;
        background: #1c1917;
        border-color: #78350f;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

function removeStyle() {
  document.getElementById(STYLE_ID)?.remove();
}

/**
 * Determine whether a compose window represents a new message or a reply/forward.
 */
function isNewCompose(composeNode: Element): boolean {
  // Check subject field for "Re:" or "Fwd:"
  const subjectInput = composeNode.querySelector<HTMLInputElement>(
    'input[name="subjectbox"], input[aria-label*="Subject"]'
  );
  if (subjectInput) {
    const subject = subjectInput.value.trim();
    if (/^(Re|Fwd|Fw)\s*:/i.test(subject)) {
      return false;
    }
  }

  // Check for quoted text area indicating a reply
  const quotedArea = composeNode.querySelector(
    '.gmail_quote, [class*="quoted"], div[style*="border-left"]'
  );
  if (quotedArea) {
    return false;
  }

  return true;
}

/**
 * Click a link to reveal the CC or BCC row if hidden.
 */
function revealFieldRow(composeNode: Element, linkText: string): void {
  const links = Array.from(composeNode.querySelectorAll('span[id][role="link"], a[id]'));
  for (const link of links) {
    const text = link.textContent?.trim().toUpperCase();
    if (text === linkText.toUpperCase()) {
      (link as HTMLElement).click();
      return;
    }
  }
}

/**
 * Fill recipients into a CC or BCC field, adding an "(auto)" badge.
 */
function fillRecipients(
  composeNode: Element,
  fieldName: string,
  recipients: string[]
): void {
  if (recipients.length === 0) return;

  const field = composeNode.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `textarea[name="${fieldName}"], input[name="${fieldName}"]`
  );
  if (!field) return;

  // Build the value string
  const existing = field.value.trim();
  const existingSet = new Set(
    existing
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const toAdd = recipients.filter((r) => !existingSet.has(r.trim().toLowerCase()));
  if (toAdd.length === 0) return;

  const newParts = toAdd.map((r) => r.trim());
  const separator = existing ? ', ' : '';
  field.value = existing + separator + newParts.join(', ');

  // Dispatch input event so email app picks up the change
  field.dispatchEvent(new Event('input', { bubbles: true }));

  // Add "(auto)" badge next to the field
  addAutoBadge(composeNode, fieldName);
}

function addAutoBadge(composeNode: Element, fieldName: string): void {
  const field = composeNode.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `textarea[name="${fieldName}"], input[name="${fieldName}"]`
  );
  if (!field || !field.parentElement) return;

  // Avoid duplicate badges
  const existingBadge = field.parentElement.querySelector(`.${AUTO_BADGE_CLASS}[data-field="${fieldName}"]`);
  if (existingBadge) return;

  const badge = document.createElement('span');
  badge.className = AUTO_BADGE_CLASS;
  badge.dataset.field = fieldName;
  badge.textContent = '(auto)';
  field.parentElement.insertBefore(badge, field.nextSibling);
}

/**
 * Remove all auto badges (per-field and status) from a compose node.
 */
function removeAutoBadges(composeNode: Element): void {
  composeNode.querySelectorAll(`.${AUTO_BADGE_CLASS}`).forEach((el) => el.remove());
  composeNode.querySelectorAll(`.${STATUS_BADGE_CLASS}`).forEach((el) => el.remove());
}

/**
 * Add a status badge at the top of the compose window indicating auto-cc-bcc state.
 */
function addStatusBadge(composeNode: Element, hasRecipients: boolean): void {
  // Remove any existing status badge first
  composeNode.querySelectorAll(`.${STATUS_BADGE_CLASS}`).forEach((el) => el.remove());

  const badge = document.createElement('span');
  badge.className = STATUS_BADGE_CLASS;

  if (hasRecipients) {
    badge.dataset.status = 'active';
    badge.textContent = 'Auto CC/BCC active';
  } else {
    badge.dataset.status = 'warning';
    badge.textContent = 'Auto CC/BCC: no recipients';
  }

  // Insert near the top of the compose dialog, after the subject input if present
  const subjectInput = composeNode.querySelector('input[name="subjectbox"], input[aria-label*="Subject"]');
  if (subjectInput?.parentElement) {
    subjectInput.parentElement.insertBefore(badge, subjectInput.nextSibling);
  } else {
    composeNode.insertBefore(badge, composeNode.firstChild);
  }
}

/**
 * Main handler when a compose window is detected.
 */
function handleCompose(composeNode: Element | null, context: ModuleContext): void {
  if (!composeNode) return;

  const { settings } = context;
  if (!settings.autoCcBcc.enabled) return;

  const { cc, bcc, mode } = settings.autoCcBcc;
  const hasRecipients = cc.length > 0 || bcc.length > 0;

  ensureStyle();

  const isNew = isNewCompose(composeNode);

  // Check mode filter
  if (mode === 'new' && !isNew) return;
  if (mode === 'reply' && isNew) return;

  // Show status badge regardless of whether recipients are configured
  addStatusBadge(composeNode, hasRecipients);

  if (!hasRecipients) return;

  // Reveal CC/BCC rows if needed
  if (cc.length > 0) {
    revealFieldRow(composeNode, 'Cc');
  }
  if (bcc.length > 0) {
    revealFieldRow(composeNode, 'Bcc');
  }

  // Small delay to allow the fields to appear after clicking reveal links
  setTimeout(() => {
    fillRecipients(composeNode, 'cc', cc);
    fillRecipients(composeNode, 'bcc', bcc);
  }, 50);
}

export function createAutoCcBccModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];

  return {
    name: 'autoCcBcc',

    init(context: ModuleContext) {
      unsubscribers = [
        context.observer.on('compose-detected', (payload) => {
          handleCompose(payload.node, context);
        }),
      ];
    },

    onSettingsChange() {
      // Settings are already reflected in context.settings;
      // no action needed — the next compose window will use the updated settings.
    },

    destroy() {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];

      // Remove all auto badges from all compose dialogs
      document.querySelectorAll('[role="dialog"]').forEach((node) => {
        removeAutoBadges(node);
      });

      removeStyle();
    },
  };
}

import { MAIL_SELECTORS } from '../mail-selectors';
import { showToast } from './toast';
import { extractSenderFromRow, extractSubjectFromRow } from './row-utils';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-smart-actions-style';
const HOVER_DELAY = 300;
const HIDE_DELAY = 200;

type SenderClassification = 'newsletter' | 'social' | 'transactional' | 'important' | 'unknown';

type ActionType = 'Read' | 'Archive' | 'Star' | 'Unsubscribe' | 'Reply' | 'Snooze' | 'MarkUnread';

interface ActionButton {
  type: ActionType;
  icon: string;
  label: string;
  color: string;
}

const ACTION_MAP: Record<ActionType, { icon: string; color: string }> = {
  Archive: { icon: '\u2193', color: '#dc2626' },
  Star: { icon: '\u2605', color: '#d97706' },
  Read: { icon: '\u2192', color: '#2563eb' },
  Reply: { icon: '\u21A9', color: '#16a34a' },
  Unsubscribe: { icon: '\u2715', color: '#ea580c' },
  Snooze: { icon: '\u23F0', color: '#7c3aed' },
  MarkUnread: { icon: '\u2709', color: '#0d9488' },
};

const ACTIONS_BY_CLASS: Record<SenderClassification, ActionType[]> = {
  newsletter: ['Archive', 'Unsubscribe', 'Read', 'MarkUnread'],
  social: ['Archive', 'Read', 'Snooze', 'MarkUnread'],
  transactional: ['Read', 'Archive', 'Star', 'MarkUnread'],
  important: ['Read', 'Reply', 'Star', 'MarkUnread'],
  unknown: ['Read', 'Archive', 'Star', 'MarkUnread'],
};

const NEWSLETTER_PREFIXES = ['noreply@', 'newsletter@', 'mail@', 'updates@', 'digest@', 'hello@', 'info@', 'team@'];
const SOCIAL_DOMAINS = ['linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'github.com'];
const TRANSACTIONAL_WORDS = ['receipt', 'order', 'invoice', 'payment', 'shipping'];

// --- Classification logic (exported for testing) ---

export function classifySender(sender: string, subject: string): SenderClassification {
  const email = sender.toLowerCase();
  const sub = subject.toLowerCase();

  // Check social domains
  for (const domain of SOCIAL_DOMAINS) {
    if (email.includes(domain) || email.includes(`notifications@${domain}`)) {
      return 'social';
    }
  }

  // Check newsletter prefixes
  for (const prefix of NEWSLETTER_PREFIXES) {
    if (email.startsWith(prefix)) {
      return 'newsletter';
    }
  }

  // Check transactional words in subject
  for (const word of TRANSACTIONAL_WORDS) {
    if (sub.includes(word)) {
      return 'transactional';
    }
  }

  // If no sender info, unknown
  if (!email || email.length === 0) {
    return 'unknown';
  }

  // Everything else from identifiable humans = important
  return 'important';
}

export function getActionsForClassification(classification: SenderClassification): ActionButton[] {
  const types = ACTIONS_BY_CLASS[classification];
  return types.map((type) => ({
    type,
    icon: ACTION_MAP[type].icon,
    label: type,
    color: ACTION_MAP[type].color,
  }));
}

// --- Row info extraction (imported from row-utils) ---

function findStarElement(row: Element): HTMLElement | null {
  return row.querySelector<HTMLElement>('td.Pu, td.oZ-x3, [aria-label="Star"], [data-tooltip="Star"]');
}

function isRowUnread(row: Element): boolean {
  // email app uses 'zE' class for unread rows, 'yO' for read
  if (row.classList.contains('zE')) return true;
  if (row.classList.contains('yO')) return false;
  return false;
}

// --- Action execution ---

function executeAction(action: ActionType, row: Element): void {
  switch (action) {
    case 'Read': {
      // Click the email row to open the thread
      const subjectLink = row.querySelector('.bog, [role="link"]');
      if (subjectLink) {
        (subjectLink as HTMLElement).click();
      } else {
        (row as HTMLElement).click();
      }
      showToast('Marked as read');
      break;
    }
    case 'Archive': {
      // Try toolbar archive button first, then keyboard shortcut
      const archiveBtn = document.querySelector<HTMLElement>(MAIL_SELECTORS.toolbarArchive);
      if (archiveBtn) {
        archiveBtn.click();
      } else {
        // Simulate 'e' keyboard shortcut
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      }
      showToast('Archived');
      break;
    }
    case 'Star': {
      const star = findStarElement(row);
      if (star) {
        const isStarred = star.getAttribute('aria-checked') === 'true'
          || (star.getAttribute('aria-label')?.includes('Starred') ?? false);
        star.click();
        showToast(isStarred ? 'Unstarred' : 'Starred');
      }
      break;
    }
    case 'Unsubscribe': {
      // Open the thread first
      const subjectLink = row.querySelector('.bog, [role="link"]');
      if (subjectLink) {
        (subjectLink as HTMLElement).click();
        // After opening, look for unsubscribe link
        setTimeout(() => {
          const unsubLink = document.querySelector<HTMLElement>(
            'a[href*="unsubscribe"], a[href*="opt-out"], a[href*="list-manage"], span[id=":unsubscribe"]',
          );
          if (unsubLink) {
            unsubLink.click();
            showToast('Unsubscribe link opened');
          } else {
            showToast('No unsubscribe link found in this email');
          }
        }, 1500);
      }
      break;
    }
    case 'Reply': {
      // Open the thread first
      const subjectLink = row.querySelector('.bog, [role="link"]');
      if (subjectLink) {
        (subjectLink as HTMLElement).click();
        setTimeout(() => {
          const replyBtn = document.querySelector<HTMLElement>(MAIL_SELECTORS.replyButton);
          if (replyBtn) {
            replyBtn.click();
          }
        }, 1500);
      }
      break;
    }
    case 'Snooze': {
      showToast('Snoozed');
      break;
    }
    case 'MarkUnread': {
      const markBtn = document.querySelector<HTMLElement>(MAIL_SELECTORS.toolbarMarkReadUnread);
      const isUnread = isRowUnread(row);
      if (markBtn) {
        markBtn.click();
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: isUnread ? 'I' : 'U',
          shiftKey: true,
          bubbles: true,
        }));
      }
      showToast(isUnread ? 'Marked as read' : 'Marked as unread');
      break;
    }
  }
}

// --- Action bar UI ---

const SPRING_CURVE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function buildCss(): string {
  return `
    .simply-mail-smart-actions-bar {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%) translateX(8px) scale(0.95);
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px 4px;
      background: var(--simply-mail-surface, #ffffff);
      border: 1px solid var(--simply-mail-border, #e4e4e7);
      border-radius: 0;
      box-shadow: none;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      animation: simply-mail-actions-slide-in 200ms ${SPRING_CURVE} forwards;
    }
    .simply-mail-smart-actions-bar.is-leaving {
      animation: simply-mail-actions-slide-out 160ms ${SPRING_CURVE} forwards;
    }
    .simply-mail-smart-actions-bar.simply-mail-floating {
      position: fixed;
      right: 16px;
      transform: scale(0.95);
    }
    .simply-mail-smart-action-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 28px;
      padding: 0 8px;
      margin: 0 4px;
      border: none;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      color: inherit;
      white-space: nowrap;
      transition: background 80ms ${SPRING_CURVE};
    }
    .simply-mail-smart-action-btn:hover {
      background: var(--simply-mail-hover, #f4f4f5);
    }
    .simply-mail-smart-action-btn .simply-mail-action-icon {
      font-size: 13px;
      line-height: 1;
    }
    html.simply-mail-dark-mode .simply-mail-smart-actions-bar {
      background: var(--simply-mail-surface, #0a0a0a);
      border-color: #27272a;
    }
    html.simply-mail-dark-mode .simply-mail-smart-action-btn:hover {
      background: #111111;
    }
    @keyframes simply-mail-actions-slide-in {
      from { opacity: 0; transform: translateY(-50%) translateX(8px) scale(0.95); }
      to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
    }
    @keyframes simply-mail-actions-slide-out {
      from { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
      to { opacity: 0; transform: translateY(-50%) translateX(8px) scale(0.95); }
    }
    @media (prefers-reduced-motion: reduce) {
      .simply-mail-smart-actions-bar,
      .simply-mail-smart-actions-bar.is-leaving {
        animation-duration: 0.01ms !important;
      }
    }
  `;
}

function upsertStyle(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = buildCss();
}

function createActionBar(actions: ActionButton[], position: 'inline' | 'floating', row: Element): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = `simply-mail-smart-actions-bar${position === 'floating' ? ' simply-mail-floating' : ''}`;

  const unread = isRowUnread(row);

  for (const action of actions) {
    let label = action.label;
    if (action.type === 'MarkUnread') {
      label = unread ? 'Mark read' : 'Mark unread';
    }

    const btn = document.createElement('button');
    btn.className = 'simply-mail-smart-action-btn';
    btn.setAttribute('data-simply-mail-action', action.type);
    btn.setAttribute('aria-label', label);

    const icon = document.createElement('span');
    icon.className = 'simply-mail-action-icon';
    icon.style.color = action.color;
    icon.textContent = action.icon;
    btn.append(icon, document.createTextNode(label));

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      executeAction(action.type, row);
    });
    bar.appendChild(btn);
  }

  return bar;
}

// --- Module ---

export function createSmartActionsModule(): SimplyMailModule {
  let context: ModuleContext | null = null;
  let unsubscribeObserver: (() => void) | null = null;
  let eventDelegator: (() => void) | null = null;
  let activeBar: HTMLDivElement | null = null;
  let hoveredRow: Element | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function hideActionBar(immediate = false): void {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }

    if (!activeBar) return;

    const doHide = () => {
      if (!activeBar) return;
      activeBar.classList.add('is-leaving');
      const bar = activeBar;
      activeBar = null;
      bar.addEventListener('animationend', () => bar.remove(), { once: true });
      // Fallback removal if animation doesn't fire
      setTimeout(() => bar.remove(), 200);
    };

    if (immediate) {
      doHide();
    } else {
      hideTimer = setTimeout(doHide, HIDE_DELAY);
    }
  }

  function showActionBar(row: Element): void {
    hideActionBar(true);

    const sender = extractSenderFromRow(row);
    const subject = extractSubjectFromRow(row);
    const classification = classifySender(sender, subject);
    const actions = getActionsForClassification(classification);
    const position = context?.settings.smartActions.position ?? 'inline';

    activeBar = createActionBar(actions, position, row);

    // Ensure the row is positioned
    const computed = getComputedStyle(row);
    if (computed.position === 'static') {
      (row as HTMLElement).style.position = 'relative';
    }

    row.appendChild(activeBar);
  }

  function handleRowEnter(row: Element): void {
    if (!context?.settings.smartActions.showOnHover) return;
    if (!context.settings.smartActions.enabled) return;

    hoveredRow = row;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    hoverTimer = setTimeout(() => {
      if (hoveredRow === row) {
        showActionBar(row);
      }
    }, HOVER_DELAY);
  }

  function handleRowLeave(): void {
    hoveredRow = null;
    hideActionBar(false);
  }

  function getClosestRow(target: EventTarget | null): Element | null {
    if (target instanceof Element) {
      return target.closest(MAIL_SELECTORS.listRows);
    }

    if (target instanceof Node && target.parentElement) {
      return target.parentElement.closest(MAIL_SELECTORS.listRows);
    }

    return null;
  }

  function attachEventDelegation(): void {
    // Use event delegation on document body for email rows
    const handler = (e: Event) => {
      const row = getClosestRow(e.target);
      if (!row) return;

      if (e.type === 'mouseenter') {
        handleRowEnter(row);
      } else if (e.type === 'mouseleave') {
        // Only hide if we're not moving to the action bar
        const related = (e as MouseEvent).relatedTarget;
        if (related instanceof Element && related.closest('.simply-mail-smart-actions-bar')) {
          return;
        }
        handleRowLeave();
      }
    };

    // Attach mouseenter/mouseleave via capturing for delegation
    document.addEventListener('mouseenter', handler, true);
    document.addEventListener('mouseleave', handler, true);

    eventDelegator = () => {
      document.removeEventListener('mouseenter', handler, true);
      document.removeEventListener('mouseleave', handler, true);
    };
  }

  return {
    name: 'smartActions',
    init(ctx: ModuleContext) {
      context = ctx;
      upsertStyle();

      if (!ctx.settings.smartActions.enabled) return;

      // Subscribe to inbox-updated events
      unsubscribeObserver = ctx.observer.on('inbox-updated', () => {
        // Rows refreshed — hide any active bar
        hideActionBar(true);
      });

      attachEventDelegation();
    },
    destroy() {
      hideActionBar(true);
      unsubscribeObserver?.();
      eventDelegator?.();
      document.getElementById(STYLE_ID)?.remove();
      context = null;
    },
    onSettingsChange(settings, ctx) {
      context = ctx;
      ctx.settings = settings;

      // If newly enabled, attach delegation
      if (settings.smartActions.enabled && !eventDelegator) {
        upsertStyle();
        unsubscribeObserver = ctx.observer.on('inbox-updated', () => {
          hideActionBar(true);
        });
        attachEventDelegation();
      }

      // If disabled, clean up
      if (!settings.smartActions.enabled) {
        hideActionBar(true);
        unsubscribeObserver?.();
        eventDelegator?.();
        unsubscribeObserver = null;
        eventDelegator = null;
      }
    },
  };
}

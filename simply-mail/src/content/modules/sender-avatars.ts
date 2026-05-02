import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle } from './dom-utils';
import { extractSenderFromRow } from './row-utils';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-sender-avatars-style';
const AVATAR_CLASS = 'simply-mail-sender-avatar';

// Deterministic color palette (zinc-friendly tones)
const AVATAR_COLORS = [
  '#71717a', '#52525b', '#3f3f46', '#6b7280', '#4b5563',
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#2563eb', '#7c3aed', '#c026d3',
];

function hashEmail(email: string): number {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function getAvatarColor(email: string): string {
  const hash = hashEmail(email);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getInitials(sender: string): string {
  // Try to extract name from "Name <email>" format or just use the email
  let name = sender;
  const ltIndex = sender.indexOf('<');
  if (ltIndex > 0) {
    name = sender.substring(0, ltIndex).trim();
  }

  // If it looks like just an email, use the local part
  if (!name || name.includes('@')) {
    const localPart = sender.split('@')[0] || '';
    // Take first letter uppercase
    return localPart.charAt(0).toUpperCase() || '?';
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function isRowUnread(row: Element): boolean {
  if (row.classList.contains('zE')) return true;
  if (row.classList.contains('yO')) return false;
  return false;
}

function buildCss(): string {
  return `
    .${AVATAR_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 600;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #ffffff;
      flex-shrink: 0;
      line-height: 1;
      letter-spacing: 0.02em;
      transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .${AVATAR_CLASS}:hover {
      transform: scale(1.1);
    }
    html.simply-mail-dark-mode .${AVATAR_CLASS} {
      color: #fafafa;
    }
    @media (prefers-reduced-motion: reduce) {
      .${AVATAR_CLASS} {
        transition: none;
      }
      .${AVATAR_CLASS}:hover {
        transform: none;
      }
    }
  `;
}

function createAvatarElement(email: string, unread: boolean): HTMLSpanElement {
  const avatar = document.createElement('span');
  avatar.className = AVATAR_CLASS;
  avatar.setAttribute('data-simply-mail-avatar', email);
  avatar.setAttribute('aria-hidden', 'true');

  const initials = getInitials(email);
  const color = getAvatarColor(email.toLowerCase());
  avatar.style.background = color;
  avatar.textContent = initials;

  if (unread) {
    avatar.style.boxShadow = `0 0 0 2px var(--simply-mail-surface, #ffffff), 0 0 0 3px ${color}`;
  }

  return avatar;
}

export function createSenderAvatarsModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];

  function processRows(rows: Element[]): void {
    for (const row of rows) {
      if (row.getAttribute('role') !== 'row') continue;

      // Skip if already processed
      if (row.querySelector(`.${AVATAR_CLASS}`)) continue;

      const email = extractSenderFromRow(row);
      if (!email) continue;

      const unread = isRowUnread(row);
      const avatar = createAvatarElement(email, unread);

      // Find the first td to prepend the avatar
      const firstTd = row.querySelector('td');
      if (firstTd) {
        // For unread rows, replace checkbox column space
        if (unread) {
          const checkbox = firstTd.querySelector('[role="checkbox"], .oZ-jc, .T-Jo');
          if (checkbox) {
            // Hide the checkbox and insert avatar after it
            (checkbox as HTMLElement).style.display = 'none';
            checkbox.parentElement?.insertBefore(avatar, checkbox);
          } else {
            firstTd.insertBefore(avatar, firstTd.firstChild);
          }
        } else {
          firstTd.insertBefore(avatar, firstTd.firstChild);
        }
      }
    }
  }

  function cleanupAvatars(): void {
    document.querySelectorAll(`.${AVATAR_CLASS}`).forEach((el) => {
      // Restore any hidden checkboxes
      const td = el.closest('td');
      if (td) {
        const checkbox = td.querySelector('[role="checkbox"], .oZ-jc, .T-Jo');
        if (checkbox) {
          (checkbox as HTMLElement).style.display = '';
        }
      }
      el.remove();
    });
  }

  return {
    name: 'senderAvatars' as const,

    init(ctx: ModuleContext): void {
      ensureStyle(STYLE_ID, buildCss());

      unsubscribers = [
        ctx.observer.on('inbox-updated', (payload) => {
          processRows(payload.rows);
        }),
        ctx.observer.on('view-changed', () => {
          // Re-process rows when view changes
          cleanupAvatars();
          const existingRows = Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows));
          if (existingRows.length > 0) {
            processRows(existingRows);
          }
        }),
      ];

      // Process rows already in DOM
      const existingRows = Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows));
      if (existingRows.length > 0) {
        processRows(existingRows);
      }
    },

    destroy(): void {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];
      cleanupAvatars();
      removeStyle(STYLE_ID);
    },
  };
}

export { STYLE_ID, AVATAR_CLASS };

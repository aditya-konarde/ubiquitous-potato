import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle } from './dom-utils';
import { extractSenderFromRow, extractSubjectFromRow } from './row-utils';
import { classifySender } from './smart-actions';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-priority-badges-style';
const DOT_CLASS = 'simply-mail-priority-dot';

type PriorityLevel = 'important' | 'newsletter' | 'social' | 'transactional' | 'unknown';

const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  important: '#dc2626',
  newsletter: '#ea580c',
  social: '#2563eb',
  transactional: '#16a34a',
  unknown: '',
};

function buildCss(): string {
  return `
    .${DOT_CLASS} {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-right: 4px;
      vertical-align: middle;
      transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .${DOT_CLASS}:hover {
      transform: scale(1.3);
    }
    html.simply-mail-dark-mode .${DOT_CLASS} {
      opacity: 0.9;
    }
    @media (prefers-reduced-motion: reduce) {
      .${DOT_CLASS} {
        transition: none;
      }
      .${DOT_CLASS}:hover {
        transform: none;
      }
    }
  `;
}

function createPriorityDot(level: PriorityLevel): HTMLSpanElement | null {
  const color = PRIORITY_COLORS[level];
  if (!color) return null; // unknown gets no dot

  const dot = document.createElement('span');
  dot.className = DOT_CLASS;
  dot.setAttribute('data-simply-mail-priority', level);
  dot.setAttribute('aria-label', `Priority: ${level}`);
  dot.setAttribute('title', `Priority: ${level}`);
  dot.style.background = color;
  return dot;
}

export function createPriorityBadgesModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];

  function processRows(rows: Element[]): void {
    for (const row of rows) {
      if (row.getAttribute('role') !== 'row') continue;

      // Skip if already processed
      if (row.querySelector(`.${DOT_CLASS}`)) continue;

      const sender = extractSenderFromRow(row);
      const subject = extractSubjectFromRow(row);
      const level = classifySender(sender, subject) as PriorityLevel;

      const dot = createPriorityDot(level);
      if (!dot) continue; // unknown gets no dot

      // Find sender name span and prepend the dot next to it
      const nameSpan = row.querySelector('.yW span, .zF, [email]');
      if (nameSpan) {
        nameSpan.parentElement?.insertBefore(dot, nameSpan);
      } else {
        // Fallback: prepend to the first td
        const firstTd = row.querySelector('td');
        firstTd?.insertBefore(dot, firstTd.firstChild);
      }
    }
  }

  function cleanupDots(): void {
    document.querySelectorAll(`.${DOT_CLASS}`).forEach((el) => el.remove());
  }

  return {
    name: 'priorityBadges' as const,

    init(ctx: ModuleContext): void {
      ensureStyle(STYLE_ID, buildCss());

      unsubscribers = [
        ctx.observer.on('inbox-updated', (payload) => {
          processRows(payload.rows);
        }),
        ctx.observer.on('view-changed', () => {
          cleanupDots();
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
      cleanupDots();
      removeStyle(STYLE_ID);
    },
  };
}

export { STYLE_ID, DOT_CLASS };

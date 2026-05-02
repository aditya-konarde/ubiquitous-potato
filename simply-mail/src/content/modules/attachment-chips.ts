import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle } from './dom-utils';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-attachment-chips-style';
const CHIP_CLASS = 'simply-mail-attachment-chip';

function buildCss(): string {
  return `
    .${CHIP_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      height: 20px;
      padding: 0 6px;
      background: var(--simply-mail-hover, #f4f4f5);
      border: 1px solid var(--simply-mail-border, #e4e4e7);
      border-radius: 0;
      font-size: 11px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--simply-mail-text-secondary, #71717a);
      white-space: nowrap;
      flex-shrink: 0;
      transition: background 120ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
      user-select: none;
    }
    .${CHIP_CLASS}:hover {
      background: var(--simply-mail-hover-strong, #e4e4e7);
      transform: translateY(-1px);
    }
    .${CHIP_CLASS} .simply-mail-clip-icon {
      font-size: 12px;
      line-height: 1;
    }
    .${CHIP_CLASS} .simply-mail-clip-count {
      font-weight: 500;
    }
    html.simply-mail-dark-mode .${CHIP_CLASS} {
      background: #18181b;
      border-color: #27272a;
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode .${CHIP_CLASS}:hover {
      background: #27272a;
    }
    @media (prefers-reduced-motion: reduce) {
      .${CHIP_CLASS} {
        transition: none;
      }
      .${CHIP_CLASS}:hover {
        transform: none;
      }
    }
  `;
}

function hasAttachment(row: Element): { hasAttachment: boolean; count: number } {
  // Check for attachment indicators in the row
  // email app uses aria-label containing 'attachment' on certain elements
  const elements = row.querySelectorAll('[aria-label]');
  for (const el of elements) {
    const label = el.getAttribute('aria-label') ?? '';
    if (/attachment/i.test(label)) {
      // Try to extract count from label like "2 attachments" or "Has attachment"
      const countMatch = label.match(/(\d+)\s*attachment/i);
      const count = countMatch ? parseInt(countMatch[1], 10) : 1;
      return { hasAttachment: true, count };
    }
  }

  // Also check for paperclip icon class used by email app
  const paperclip = row.querySelector('.y5, .y6, [data-tooltip*="attachment" i]');
  if (paperclip) {
    return { hasAttachment: true, count: 1 };
  }

  return { hasAttachment: false, count: 0 };
}

function createAttachmentChip(count: number): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS;
  chip.setAttribute('data-simply-mail-attachment', 'true');
  chip.setAttribute('aria-label', count > 1 ? `${count} attachments` : '1 attachment');

  const clip = document.createElement('span');
  clip.className = 'simply-mail-clip-icon';
  clip.textContent = '\uD83D\uDCCE'; // paperclip emoji

  chip.appendChild(clip);

  if (count > 1) {
    const countEl = document.createElement('span');
    countEl.className = 'simply-mail-clip-count';
    countEl.textContent = String(count);
    chip.appendChild(countEl);
  }

  return chip;
}

export function createAttachmentChipsModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];

  function processRows(rows: Element[]): void {
    for (const row of rows) {
      if (row.getAttribute('role') !== 'row') continue;

      // Skip if already processed
      if (row.querySelector(`.${CHIP_CLASS}`)) continue;

      const { hasAttachment: has, count } = hasAttachment(row);
      if (!has) continue;

      const chip = createAttachmentChip(count);

      // Insert after the subject/snippet area, before the date
      // Try to find the subject cell or a suitable insertion point
      const subjectCell = row.querySelector('.bog, [role="link"]');
      if (subjectCell) {
        const parent = subjectCell.closest('td') ?? subjectCell.parentElement;
        if (parent) {
          parent.appendChild(chip);
        }
      } else {
        // Fallback: append to the last visible td
        const tds = Array.from(row.querySelectorAll('td'));
        const lastTd = tds[tds.length > 1 ? tds.length - 2 : 0];
        lastTd?.appendChild(chip);
      }
    }
  }

  function cleanupChips(): void {
    document.querySelectorAll(`.${CHIP_CLASS}`).forEach((el) => el.remove());
  }

  return {
    name: 'attachmentChips' as const,

    init(ctx: ModuleContext): void {
      ensureStyle(STYLE_ID, buildCss());

      unsubscribers = [
        ctx.observer.on('inbox-updated', (payload) => {
          processRows(payload.rows);
        }),
        ctx.observer.on('view-changed', () => {
          cleanupChips();
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
      cleanupChips();
      removeStyle(STYLE_ID);
    },
  };
}

export { STYLE_ID, CHIP_CLASS };

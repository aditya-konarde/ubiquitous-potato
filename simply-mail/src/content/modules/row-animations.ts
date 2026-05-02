import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle } from './dom-utils';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-row-animations-style';
const ANIMATED_CLASS = 'simply-mail-row-animated';
const VISIBLE_CLASS = 'simply-mail-row-visible';

function buildCss(): string {
  return `
    tr[role="row"].${ANIMATED_CLASS} {
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    tr[role="row"].${ANIMATED_CLASS}.${VISIBLE_CLASS} {
      opacity: 1;
      transform: translateY(0);
    }
    @media (prefers-reduced-motion: reduce) {
      tr[role="row"].${ANIMATED_CLASS} {
        opacity: 1;
        transform: none;
        transition: none;
      }
    }
  `;
}

export function createRowAnimationsModule(): SimplyMailModule {
  let observer: IntersectionObserver | null = null;
  let unsubscribers: Array<() => void> = [];
  let staggerMs = 50;

  function applyStagger(row: Element, index: number): void {
    const el = row as HTMLElement;
    el.style.transitionDelay = `${index * staggerMs}ms`;
  }

  function observeRows(rows: Element[]): void {
    if (!observer) return;

    const newRows = rows.filter(
      (row) => row.getAttribute('role') === 'row' && !row.classList.contains(ANIMATED_CLASS),
    );

    newRows.forEach((row, index) => {
      row.classList.add(ANIMATED_CLASS);
      applyStagger(row, index);
      observer!.observe(row);
    });
  }

  function handleInboxUpdated(payload: { rows: Element[] }): void {
    observeRows(payload.rows);
  }

  return {
    name: 'rowAnimations' as const,

    init(ctx: ModuleContext): void {
      const settings = ctx.settings.rowAnimations;
      staggerMs = settings?.staggerMs ?? 50;

      ensureStyle(STYLE_ID, buildCss());

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add(VISIBLE_CLASS);
              observer!.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.1 },
      );

      unsubscribers = [
        ctx.observer.on('inbox-updated', handleInboxUpdated),
      ];

      // Observe any rows already in the DOM
      const existingRows = Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows));
      if (existingRows.length > 0) {
        observeRows(existingRows);
      }
    },

    destroy(): void {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];

      if (observer) {
        observer.disconnect();
        observer = null;
      }

      // Clean up animation classes from rows
      document.querySelectorAll(`.${ANIMATED_CLASS}`).forEach((row) => {
        row.classList.remove(ANIMATED_CLASS, VISIBLE_CLASS);
        (row as HTMLElement).style.transitionDelay = '';
      });

      removeStyle(STYLE_ID);
    },

    onSettingsChange(settings: import('@/shared/types').SimplyMailSettings): void {
      const s = settings.rowAnimations;
      staggerMs = s?.staggerMs ?? 50;
    },
  };
}

export { ANIMATED_CLASS, VISIBLE_CLASS, STYLE_ID };

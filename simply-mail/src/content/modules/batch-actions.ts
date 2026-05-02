import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle } from './dom-utils';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const ROOT_ID = 'simply-mail-batch-actions';
const STYLE_ID = `${ROOT_ID}-style`;

function getSelectedRows(): Element[] {
  const checkboxes = document.querySelectorAll('tr[role="row"] div[role="checkbox"][aria-checked="true"]');
  return Array.from(checkboxes).map((cb) => cb.closest('tr[role="row"]')).filter(Boolean) as Element[];
}

function buildCss(): string {
  return `
    #${ROOT_ID} {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%) translateY(20px) scale(0.95);
      z-index: 99998;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: #000000;
      border: 1px solid #000000;
      opacity: 0;
      pointer-events: none;
      transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 200ms ease;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #${ROOT_ID}.is-visible {
      transform: translateX(-50%) translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    .${ROOT_ID}-count {
      padding: 2px 8px;
      background: #ffffff;
      color: #000000;
      font-size: 12px;
      font-weight: 600;
      margin-right: 4px;
    }
    .${ROOT_ID}-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: transparent;
      border: 1px solid transparent;
      color: #ffffff;
      font-size: 16px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;
    }
    .${ROOT_ID}-btn:hover {
      background: #27272a;
      border-color: #3f3f46;
    }
    .${ROOT_ID}-btn:active {
      transform: scale(0.92);
    }
    .${ROOT_ID}-btn[aria-label]::after {
      content: attr(aria-label);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      background: #000000;
      color: #ffffff;
      font-size: 11px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 100ms ease;
    }
    .${ROOT_ID}-btn:hover[aria-label]::after {
      opacity: 1;
    }
    /* Dark mode */
    html.simply-mail-dark-mode #${ROOT_ID} {
      background: #ffffff;
      border-color: #ffffff;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-count {
      background: #000000;
      color: #ffffff;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-btn {
      color: #000000;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-btn:hover {
      background: #e4e4e7;
      border-color: #d4d4d8;
    }
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      #${ROOT_ID} {
        transition: opacity 150ms ease;
      }
    }
  `;
}

interface ActionDef {
  icon: string;
  label: string;
  selector: string;
}

const ACTIONS: ActionDef[] = [
  { icon: '\u2193', label: 'Archive', selector: 'div[aria-label*="Archive"], [data-tooltip*="Archive"]' },
  { icon: '\u2715', label: 'Delete', selector: 'div[aria-label*="Delete"], [data-tooltip*="Delete"]' },
  { icon: '\u2192', label: 'Mark read', selector: 'div[aria-label*="Mark as read"], [data-tooltip*="Mark as read"]' },
  { icon: '\u2605', label: 'Star', selector: 'div[aria-label*="Not starred"], [data-tooltip*="Not starred"]' },
  { icon: '\u23F0', label: 'Snooze', selector: 'div[aria-label*="Snooze"], [data-tooltip*="Snooze"]' },
];

export function createBatchActionsModule(): SimplyMailModule {
  let context: ModuleContext;
  let bar: HTMLElement | null = null;
  let mutationObserver: MutationObserver | null = null;
  const unsubscribers: (() => void)[] = [];

  function ensureBar(): HTMLElement {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = ROOT_ID;

    for (const action of ACTIONS) {
      const btn = document.createElement('button');
      btn.className = `${ROOT_ID}-btn`;
      btn.setAttribute('aria-label', action.label);
      btn.textContent = action.icon;
      btn.addEventListener('click', () => {
        const target = document.querySelector<HTMLElement>(action.selector);
        target?.click();
      });
      bar.appendChild(btn);
    }

    document.documentElement.appendChild(bar);
    return bar;
  }

  function updateVisibility(): void {
    const selected = getSelectedRows();
    const el = ensureBar();

    if (selected.length > 0) {
      // Update count badge
      const existingCount = el.querySelector(`.${ROOT_ID}-count`);
      if (existingCount) {
        existingCount.textContent = `${selected.length}`;
      } else {
        const count = document.createElement('span');
        count.className = `${ROOT_ID}-count`;
        count.textContent = `${selected.length}`;
        el.insertBefore(count, el.firstChild);
      }
      el.classList.add('is-visible');
    } else {
      el.classList.remove('is-visible');
    }
  }

  function startObserving(): void {
    if (mutationObserver) return;
    const appRoot = document.querySelector(MAIL_SELECTORS.appRoot);
    if (!appRoot) return;

    mutationObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some(
        (m) =>
          m.type === 'attributes' &&
          m.target instanceof Element &&
          m.target.getAttribute('role') === 'checkbox'
      );
      if (relevant) {
        updateVisibility();
      }
    });

    mutationObserver.observe(appRoot, {
      attributes: true,
      attributeFilter: ['aria-checked'],
      subtree: true,
    });
  }

  return {
    name: 'batchActions',

    async init(ctx: ModuleContext): Promise<void> {
      context = ctx;
      ensureStyle(STYLE_ID, buildCss());
      unsubscribers.push(context.observer.on('inbox-updated', updateVisibility));
      unsubscribers.push(context.observer.on('view-changed', updateVisibility));
      updateVisibility();
      startObserving();
    },

    destroy(): void {
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers.length = 0;
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (bar) {
        bar.remove();
        bar = null;
      }
      removeStyle(STYLE_ID);
    },

    onSettingsChange(): void {
      updateVisibility();
    },
  };
}

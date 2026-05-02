import { MAIL_SELECTORS } from '../mail-selectors';
import { ensureStyle, removeStyle, getMountPoint } from './dom-utils';
import type { MailView, ModuleContext, SimplyMailModule } from '@/shared/types';

const ROOT_ID = 'simply-mail-inbox-summary';
const STYLE_ID = `${ROOT_ID}-style`;
const SUPPORTED_VIEWS = new Set<MailView>(['inbox', 'search', 'label']);

interface StatChip {
  icon: string;
  label: string;
  value: number;
}

function countUnread(rows: Element[]): number {
  return rows.filter((row) => row.classList.contains('zE') || row.querySelector('.zE')).length;
}

function countStarred(rows: Element[]): number {
  return rows.filter((row) => row.querySelector('[aria-label*="Starred"]')).length;
}

function countToday(rows: Element[]): number {
  const today = new Date().toDateString();
  return rows.filter((row) => {
    const timeEl = row.querySelector('time[datetime]');
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime');
      if (dt) return new Date(dt).toDateString() === today;
    }
    return false;
  }).length;
}

function countUp(from: number, to: number, duration: number, el: HTMLElement): void {
  if (from === to) {
    el.textContent = `${to}`;
    return;
  }
  const start = performance.now();
  const diff = to - from;
  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = `${Math.round(from + diff * eased)}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
}

function buildCss(): string {
  return `
    #${ROOT_ID} {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 16px;
      height: 40px;
      background: #ffffff;
      border-bottom: 1px solid #e4e4e7;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      animation: simply-mail-summary-in 200ms ease both;
    }
    .${ROOT_ID}-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: #f4f4f5;
      border: 1px solid #e4e4e7;
      font-size: 12px;
      color: #52525b;
      opacity: 0;
      transform: translateY(4px);
      animation: simply-mail-chip-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    .${ROOT_ID}-chip-icon {
      font-size: 13px;
    }
    .${ROOT_ID}-chip-value {
      font-weight: 600;
      color: #000000;
      min-width: 16px;
      text-align: center;
    }
    html.simply-mail-dark-mode #${ROOT_ID} {
      background: #0a0a0a;
      border-bottom-color: #27272a;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-chip {
      background: #171717;
      border-color: #27272a;
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode .${ROOT_ID}-chip-value {
      color: #ffffff;
    }
    @keyframes simply-mail-summary-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes simply-mail-chip-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      #${ROOT_ID}, .${ROOT_ID}-chip {
        animation: none;
        opacity: 1;
        transform: none;
      }
    }
  `;
}

export function createInboxSummaryModule(): SimplyMailModule {
  let context: ModuleContext;
  let container: HTMLElement | null = null;
  const unsubscribers: (() => void)[] = [];
  let previousValues: Map<string, number> = new Map();

  function getRows(): Element[] {
    return Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows))
      .filter((row) => !row.classList.contains('simply-mail-date-header'));
  }

  function removeContainer(): void {
    if (container) {
      container.remove();
      container = null;
    }
  }

  function render(): void {
    const view = context.observer.getCurrentView();
    if (!SUPPORTED_VIEWS.has(view)) {
      removeContainer();
      return;
    }

    const mount = getMountPoint();
    if (!mount) return;

    const rows = getRows();
    const chips: StatChip[] = [
      { icon: '\u2709\uFE0F', label: 'Unread', value: countUnread(rows) },
      { icon: '\u2B50', label: 'Starred', value: countStarred(rows) },
      { icon: '\uD83D\uDD5A', label: 'Today', value: countToday(rows) },
    ];

    if (context.settings.inboxSummary.showTrackers) {
      chips.push({ icon: '\uD83D\uDEE1\uFE0F', label: 'Blocked', value: 0 });
    }

    // Remove old container
    removeContainer();

    // Create new container
    container = document.createElement('div');
    container.id = ROOT_ID;

    chips.forEach((chip, i) => {
      const el = document.createElement('div');
      el.className = `${ROOT_ID}-chip`;
      el.style.animationDelay = `${i * 60}ms`;

      const icon = document.createElement('span');
      icon.className = `${ROOT_ID}-chip-icon`;
      icon.textContent = chip.icon;
      el.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = chip.label;
      el.appendChild(label);

      const value = document.createElement('span');
      value.className = `${ROOT_ID}-chip-value`;
      const prev = previousValues.get(chip.label) ?? 0;
      countUp(prev, chip.value, 400, value);
      el.appendChild(value);

      container!.appendChild(el);
      previousValues.set(chip.label, chip.value);
    });

    // Insert at top of main area
    mount.insertBefore(container, mount.firstChild);
  }

  return {
    name: 'inboxSummary',

    async init(ctx: ModuleContext): Promise<void> {
      context = ctx;
      ensureStyle(STYLE_ID, buildCss());
      unsubscribers.push(context.observer.on('view-changed', render));
      unsubscribers.push(context.observer.on('inbox-updated', render));
      render();
    },

    destroy(): void {
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers.length = 0;
      removeContainer();
      removeStyle(STYLE_ID);
      previousValues.clear();
    },

    onSettingsChange(): void {
      render();
    },
  };
}

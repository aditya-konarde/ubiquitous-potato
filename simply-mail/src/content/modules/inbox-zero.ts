import type { ModuleContext, SimplyMailModule } from '@/shared/types';
import { getMountPoint } from './dom-utils';

const ROOT_ID = 'simply-mail-inbox-zero';
const STYLE_ID = `${ROOT_ID}-style`;

const MOTIVATIONAL_MESSAGES = [
  'Inbox zero achieved. You are free.',
  'Clean slate. Nice work.',
  'Nothing here. That is the point.',
  'All caught up. Go do something great.',
];

const CONFETTI_COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#16a34a',
  '#2563eb', '#7c3aed', '#db2777', '#0d9488',
  '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
];

function shouldShowCelebration(
  context: ModuleContext,
  rows: Element[],
): boolean {
  const view = context.observer.getCurrentView();

  if (view === 'inbox') {
    return rows.length === 0;
  }

  if (view === 'search') {
    return (
      context.settings.inboxZero.showWhenEmptySearch &&
      rows.length === 0
    );
  }

  return false;
}

function buildParticleKeyframes(): string {
  let css = '';
  for (let i = 0; i < 20; i++) {
    const angle = (360 / 20) * i + (Math.random() * 18 - 9);
    const rad = (angle * Math.PI) / 180;
    const distance = 60 + Math.random() * 40;
    const tx = Math.cos(rad) * distance;
    const ty = Math.sin(rad) * distance;
    css += `
      @keyframes simply-mail-particle-${i} {
        0% {
          opacity: 1;
          transform: translate(0, 0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(0.3);
        }
      }
    `;
  }
  return css;
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ROOT_ID} {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        margin: 24px auto;
        max-width: 480px;
        text-align: center;
        border-radius: 14px;
        background: var(--simply-mail-surface, #ffffff);
        border: 1px solid var(--simply-mail-border, #e4e4e7);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        animation: simply-mail-zero-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1), simply-mail-zero-bounce 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms;
      }
      .${ROOT_ID}-icon {
        width: 52px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #10b981;
        margin-bottom: 16px;
        animation: simply-mail-zero-icon-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 300ms both;
      }
      .${ROOT_ID}-icon svg {
        width: 26px;
        height: 26px;
        stroke: #ffffff;
        stroke-width: 3;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .${ROOT_ID} h2 {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 8px;
        color: var(--simply-mail-text-strong, #000000);
        letter-spacing: 0;
      }
      .${ROOT_ID} p {
        font-size: 14px;
        margin: 0;
        color: var(--simply-mail-text-muted, #52525b);
      }
      .${ROOT_ID}-stats {
        font-size: 12px;
        margin: 8px 0 0;
        color: var(--simply-mail-text-subtle, #71717a);
      }
      .${ROOT_ID}-hint {
        font-size: 11px;
        margin: 16px 0 0;
        color: var(--simply-mail-text-subtle, #a1a1aa);
        letter-spacing: 0.01em;
      }
      .${ROOT_ID}-confetti {
        position: absolute;
        top: 0;
        left: 50%;
        pointer-events: none;
      }
      .${ROOT_ID}-confetti span {
        position: absolute;
        display: block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        top: -4px;
        left: -3px;
      }
      @keyframes simply-mail-zero-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes simply-mail-zero-bounce {
        0%   { transform: translateY(0) scale(1); }
        40%  { transform: translateY(-8px) scale(1.02); }
        70%  { transform: translateY(2px) scale(0.99); }
        100% { transform: translateY(0) scale(1); }
      }
      @keyframes simply-mail-zero-icon-pop {
        from { opacity: 0; transform: scale(0.5); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes simply-mail-confetti-fall {
        0% {
          opacity: 1;
          transform: translateY(0);
        }
        100% {
          opacity: 0;
          transform: translateY(80px);
        }
      }
      html.simply-mail-dark-mode .${ROOT_ID} {
        background: var(--simply-mail-surface-dark, #0a0a0a);
        border-color: #27272a;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      html.simply-mail-dark-mode .${ROOT_ID} h2 {
        color: #ffffff;
      }
      html.simply-mail-dark-mode .${ROOT_ID} p {
        color: #a1a1aa;
      }
      html.simply-mail-dark-mode .${ROOT_ID}-stats {
        color: #71717a;
      }
      html.simply-mail-dark-mode .${ROOT_ID}-hint {
        color: #52525b;
      }
      html.simply-mail-dark-mode .${ROOT_ID}-confetti span {
        background: #ffffff;
      }
      @media (prefers-reduced-motion: reduce) {
        .${ROOT_ID},
        .${ROOT_ID}-confetti span {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
      ${buildParticleKeyframes()}
    `;
    document.documentElement.appendChild(style);
  }
}

function buildConfetti(): HTMLDivElement {
  const container = document.createElement('div');
  container.className = `${ROOT_ID}-confetti`;

  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('span');
    const delay = Math.random() * 0.2;
    const duration = 0.8 + Math.random() * 0.4;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    dot.style.cssText = `
      background: ${color};
      animation: simply-mail-particle-${i} ${duration}s cubic-bezier(0.0, 0.0, 0.2, 1) ${delay}s forwards;
    `;
    container.appendChild(dot);
  }

  return container;
}

function renderCelebration(context: ModuleContext): void {
  const mountPoint = getMountPoint();
  if (!mountPoint) return;

  ensureStyle();

  let root = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.position = 'relative';
  }

  root.replaceChildren();

  const icon = document.createElement('div');
  icon.className = `${ROOT_ID}-icon`;
  icon.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  root.appendChild(icon);

  const heading = document.createElement('h2');
  heading.textContent = 'Inbox Zero';
  root.appendChild(heading);

  const message = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
  const subtitle = document.createElement('p');
  subtitle.textContent = message;
  root.appendChild(subtitle);

  // Trackers blocked stat
  context.storage.getStats().then((stats) => {
    if (stats.trackersBlockedToday > 0 && document.getElementById(ROOT_ID)) {
      const statsEl = document.createElement('div');
      statsEl.className = `${ROOT_ID}-stats`;
      statsEl.textContent = `${stats.trackersBlockedToday} tracker${stats.trackersBlockedToday === 1 ? '' : 's'} blocked today`;
      root!.appendChild(statsEl);
    }
  });

  const hint = document.createElement('div');
  hint.className = `${ROOT_ID}-hint`;
  hint.textContent = 'Press e to archive, ? for shortcuts';
  root.appendChild(hint);

  const confetti = buildConfetti();
  root.appendChild(confetti);

  mountPoint.appendChild(root);
}

function removeCelebration(): void {
  document.getElementById(ROOT_ID)?.remove();
}

export function createInboxZeroModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];
  let currentRows: Element[] = [];
  let contextRef: ModuleContext | null = null;
  let lastCheckTime = 0;
  let waitingForFreshRows = true;
  const CHECK_THROTTLE_MS = 200;

  function evaluate(): void {
    if (!contextRef) return;

    if (waitingForFreshRows) {
      removeCelebration();
      return;
    }

    if (shouldShowCelebration(contextRef, currentRows)) {
      renderCelebration(contextRef);
    } else {
      removeCelebration();
    }
  }

  return {
    name: 'inboxZero',

    init(context) {
      contextRef = context;
      currentRows = [];
      waitingForFreshRows = true;

      unsubscribers = [
        context.observer.on('view-changed', () => {
          currentRows = [];
          waitingForFreshRows = true;
          removeCelebration();
        }),
        context.observer.on('inbox-updated', (payload) => {
          const wasEmpty = currentRows.length === 0;
          currentRows = payload.rows;
          waitingForFreshRows = false;
          const isEmpty = currentRows.length === 0;

          // Always evaluate on empty/non-empty transitions; throttle redundant checks
          if (wasEmpty !== isEmpty) {
            lastCheckTime = Date.now();
            evaluate();
            return;
          }

          const now = Date.now();
          if (now - lastCheckTime < CHECK_THROTTLE_MS) return;
          lastCheckTime = now;
          evaluate();
        }),
      ];

      removeCelebration();
    },

    destroy() {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];
      contextRef = null;
      currentRows = [];
      lastCheckTime = 0;
      waitingForFreshRows = true;
      removeCelebration();
      document.getElementById(STYLE_ID)?.remove();
    },

    onSettingsChange(settings, context) {
      context.settings = settings;
      contextRef = context;
      evaluate();
    },
  };
}

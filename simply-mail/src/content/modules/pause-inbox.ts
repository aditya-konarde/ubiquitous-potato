import type { ModuleContext, SimplyMailModule } from '@/shared/types';
import { getMountPoint } from './dom-utils';

const OVERLAY_ID = 'simply-mail-pause-overlay';
const STYLE_ID = 'simply-mail-pause-overlay-style';
const TIMER_ID = 'simply-mail-pause-timer';
const HIDDEN_CLASS = 'simply-mail-inbox-hidden';

let timerInterval: ReturnType<typeof setInterval> | null = null;
let pauseStartTime: number | null = null;

function isPaused(context: ModuleContext): boolean {
  return context.settings.pauseInbox.enabled && context.settings.paused;
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${OVERLAY_ID} {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        backdrop-filter: none;
        background: #ffffff;
        z-index: 100;
        animation: simply-mail-pause-in 150ms linear;
        border-radius: 0;
      }
      html.simply-mail-dark-mode .${OVERLAY_ID} {
        background: #000000;
        color: #ffffff;
      }
      .${OVERLAY_ID} button {
        padding: 8px 16px;
        border-radius: 0;
        border: none;
        background: #000000;
        color: #ffffff;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
      }
      .${OVERLAY_ID} button:hover {
        background: #27272a;
      }
      html.simply-mail-dark-mode .${OVERLAY_ID} button {
        background: #ffffff;
        color: #000000;
      }
      html.simply-mail-dark-mode .${OVERLAY_ID} button:hover {
        background: #e4e4e7;
      }
      @keyframes simply-mail-pause-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .${HIDDEN_CLASS} {
        visibility: hidden !important;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return 'Focused for 0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `Focused for ${hours}h ${minutes}m` : `Focused for ${hours}h`;
  }
  return `Focused for ${minutes}m`;
}

function updateTimerText() {
  const el = document.getElementById(TIMER_ID);
  if (el && pauseStartTime !== null) {
    el.textContent = formatElapsed(Date.now() - pauseStartTime);
  }
}

function startTimer() {
  clearTimer();
  pauseStartTime = Date.now();
  updateTimerText();
  timerInterval = setInterval(updateTimerText, 60000);
}

function clearTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  pauseStartTime = null;
}

function render(context: ModuleContext) {
  const mountPoint = getMountPoint();
  if (!mountPoint) {
    return;
  }

  const view = context.observer.getCurrentView();
  const shouldShow = isPaused(context) && view === 'inbox';

  if (!shouldShow) {
    removeOverlay(mountPoint);
    clearTimer();
    return;
  }

  ensureStyle();

  mountPoint.style.position = 'relative';

  let overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Inbox paused');

    const icon = document.createElement('div');
    icon.style.fontSize = '48px';
    icon.style.marginBottom = '16px';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u23F8';

    const heading = document.createElement('h2');
    heading.style.fontSize = '24px';
    heading.style.fontWeight = '700';
    heading.style.margin = '0 0 8px';
    heading.textContent = 'Inbox is paused';

    const subtitle = document.createElement('p');
    subtitle.style.fontSize = '14px';
    subtitle.style.color = 'var(--simply-mail-text-muted, #52525b)';
    subtitle.style.margin = '0 0 24px';
    subtitle.textContent = 'Focus mode is active. New messages are waiting for you.';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Unpause';
    button.addEventListener('click', () => {
      void context.storage.patchSettings({ paused: false });
    });

    const timer = document.createElement('div');
    timer.id = TIMER_ID;
    timer.style.fontSize = '12px';
    timer.style.color = 'var(--simply-mail-text-muted, #52525b)';
    timer.style.marginTop = '24px';
    timer.textContent = 'Focused for 0m';

    overlay.appendChild(icon);
    overlay.appendChild(heading);
    overlay.appendChild(subtitle);
    overlay.appendChild(button);
    overlay.appendChild(timer);

    mountPoint.appendChild(overlay);
    startTimer();
  }

  if (context.settings.pauseInbox.hideInboxWhenPaused) {
    const rows = mountPoint.querySelectorAll('tr[role="row"], table[role="grid"]');
    rows.forEach((row) => row.classList.add(HIDDEN_CLASS));
  }
}

function removeOverlay(mountPoint: HTMLElement) {
  document.getElementById(OVERLAY_ID)?.remove();

  const hidden = mountPoint.querySelectorAll(`.${HIDDEN_CLASS}`);
  hidden.forEach((el) => el.classList.remove(HIDDEN_CLASS));
}

export function createPauseInboxModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];

  return {
    name: 'pauseInbox',
    init(context) {
      render(context);
      unsubscribers = [
        context.observer.on('view-changed', () => render(context)),
      ];
    },
    destroy() {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
      clearTimer();
      const mountPoint = getMountPoint();
      if (mountPoint) {
        removeOverlay(mountPoint);
      }
      document.getElementById(OVERLAY_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      render(context);
    },
  };
}

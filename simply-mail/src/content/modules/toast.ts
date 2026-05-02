const TOAST_CONTAINER_ID = 'simply-mail-toast-container';
const TOAST_STYLE_ID = 'simply-mail-toast-styles';
const MAX_VISIBLE_TOASTS = 3;

export type ToastType = 'success' | 'error' | 'info' | 'neutral';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ActiveToast {
  toast: HTMLDivElement;
  message: string;
  timerId: number | null;
  animationHandler: (() => void) | null;
}

const toastPool: HTMLDivElement[] = [];
const activeToasts: ActiveToast[] = [];

function getToastElement(): HTMLDivElement {
  const pooled = toastPool.pop();
  if (pooled) {
    pooled.className = 'simply-mail-toast';
    pooled.textContent = '';
    pooled.removeAttribute('role');
    pooled.removeAttribute('aria-live');
    pooled.removeAttribute('aria-atomic');
    return pooled;
  }

  const el = document.createElement('div');
  el.className = 'simply-mail-toast';
  return el;
}

function returnToPool(toast: HTMLDivElement): void {
  toast.remove();
  toast.textContent = '';
  if (toastPool.length < MAX_VISIBLE_TOASTS) {
    toastPool.push(toast);
  }
}

function injectStyles(): void {
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    #${TOAST_CONTAINER_ID} {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      max-width: min(400px, calc(100vw - 48px));
      pointer-events: none;
    }
    .simply-mail-toast {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      max-width: 100%;
      padding: 12px 16px;
      background: rgba(9, 9, 11, 0.92);
      color: #ffffff;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      border: 1px solid rgba(255, 255, 255, 0.08);
      pointer-events: auto;
      animation: simply-mail-toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both;
      word-break: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border-left: 3px solid transparent;
    }
    .simply-mail-toast.is-leaving {
      animation: simply-mail-toast-out 150ms cubic-bezier(0.7, 0, 0.84, 0) both;
    }
    .simply-mail-toast[data-type="success"] { border-left-color: #10b981; }
    .simply-mail-toast[data-type="error"] { border-left-color: #ef4444; }
    .simply-mail-toast[data-type="info"] { border-left-color: #3b82f6; }
    .simply-mail-toast-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }
    .simply-mail-toast[data-type="success"] .simply-mail-toast-icon { color: #10b981; }
    .simply-mail-toast[data-type="error"] .simply-mail-toast-icon { color: #ef4444; }
    .simply-mail-toast[data-type="info"] .simply-mail-toast-icon { color: #3b82f6; }
    .simply-mail-toast-message { flex: 1; min-width: 0; }
    .simply-mail-toast-action {
      flex-shrink: 0;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.1);
      color: inherit;
      transition: background 120ms ease;
    }
    .simply-mail-toast-action:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    html.simply-mail-dark-mode .simply-mail-toast {
      background: rgba(250, 250, 250, 0.92);
      color: #09090b;
      border-color: rgba(0, 0, 0, 0.06);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    html.simply-mail-dark-mode .simply-mail-toast-action {
      border-color: rgba(0, 0, 0, 0.12);
      background: rgba(0, 0, 0, 0.06);
    }
    html.simply-mail-dark-mode .simply-mail-toast-action:hover {
      background: rgba(0, 0, 0, 0.12);
    }
    @keyframes simply-mail-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes simply-mail-toast-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(4px); }
    }
  `;
  document.documentElement.appendChild(style);
}

function getContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

function detachToast(activeToast: ActiveToast): void {
  const index = activeToasts.indexOf(activeToast);
  if (index !== -1) {
    activeToasts.splice(index, 1);
  }

  if (activeToast.timerId !== null) {
    window.clearTimeout(activeToast.timerId);
    activeToast.timerId = null;
  }

  if (activeToast.animationHandler) {
    activeToast.toast.removeEventListener('animationend', activeToast.animationHandler);
    activeToast.animationHandler = null;
  }

  returnToPool(activeToast.toast);
}

function dismissToast(activeToast: ActiveToast): void {
  if (activeToast.toast.classList.contains('is-leaving')) {
    return;
  }

  if (activeToast.timerId !== null) {
    window.clearTimeout(activeToast.timerId);
    activeToast.timerId = null;
  }

  const handleAnimationEnd = () => {
    detachToast(activeToast);
  };

  activeToast.animationHandler = handleAnimationEnd;
  activeToast.toast.addEventListener('animationend', handleAnimationEnd, { once: true });
  activeToast.toast.classList.add('is-leaving');
}

function scheduleDismiss(activeToast: ActiveToast, duration: number): void {
  if (activeToast.timerId !== null) {
    window.clearTimeout(activeToast.timerId);
  }

  activeToast.timerId = window.setTimeout(() => {
    dismissToast(activeToast);
  }, duration);
}

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  neutral: '',
};

export function showToast(message: string, duration?: number, type?: ToastType, action?: ToastAction): void;
export function showToast(message: string, options?: { duration?: number; type?: ToastType; action?: ToastAction }): void;
export function showToast(
  message: string,
  durationOrOptions?: number | { duration?: number; type?: ToastType; action?: ToastAction },
  typeArg?: ToastType,
  actionArg?: ToastAction,
): void {
  let duration = 2000;
  let type: ToastType = 'neutral';
  let action: ToastAction | undefined;

  if (typeof durationOrOptions === 'object' && durationOrOptions !== null) {
    duration = durationOrOptions.duration ?? 2000;
    type = durationOrOptions.type ?? 'neutral';
    action = durationOrOptions.action;
  } else {
    duration = durationOrOptions ?? 2000;
    type = typeArg ?? 'neutral';
    action = actionArg;
  }

  injectStyles();
  const container = getContainer();

  const existingToast = activeToasts.find((entry) => entry.message === message);
  if (existingToast) {
    existingToast.toast.classList.remove('is-leaving');
    if (existingToast.animationHandler) {
      existingToast.toast.removeEventListener('animationend', existingToast.animationHandler);
      existingToast.animationHandler = null;
    }
    scheduleDismiss(existingToast, duration);
    return;
  }

  while (activeToasts.length >= MAX_VISIBLE_TOASTS) {
    dismissToast(activeToasts[0]);
    const leavingToast = activeToasts[0];
    if (leavingToast?.toast.classList.contains('is-leaving')) {
      leavingToast.toast.dispatchEvent(new Event('animationend'));
    }
  }

  const toast = getToastElement();
  toast.setAttribute('data-type', type);
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');

  // Build toast content
  const icon = TYPE_ICONS[type];
  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'simply-mail-toast-icon';
    iconEl.textContent = icon;
    toast.appendChild(iconEl);
  }

  const msgEl = document.createElement('span');
  msgEl.className = 'simply-mail-toast-message';
  msgEl.textContent = message;
  toast.appendChild(msgEl);

  if (action) {
    const btn = document.createElement('button');
    btn.className = 'simply-mail-toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      action!.onClick();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  const activeToast: ActiveToast = {
    toast,
    message,
    timerId: null,
    animationHandler: null,
  };

  activeToasts.push(activeToast);
  scheduleDismiss(activeToast, duration);
}

export function initToastSystem(): void {
  injectStyles();
}

export function destroyToastSystem(): void {
  while (activeToasts.length > 0) {
    detachToast(activeToasts[0]);
  }
  document.getElementById(TOAST_CONTAINER_ID)?.remove();
  document.getElementById(TOAST_STYLE_ID)?.remove();
  toastPool.length = 0;
}

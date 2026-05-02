import { ensureStyle, removeStyle } from './dom-utils';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const ROOT_ID = 'simply-mail-scroll-progress';
const STYLE_ID = `${ROOT_ID}-style`;

function getScrollContainer(): HTMLElement | null {
  // email app's main scroll container
  const candidates = [
    document.querySelector('.aeF'),
    document.querySelector('[role="main"]'),
  ];
  for (const el of candidates) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  // Fall back to document scrolling element
  return document.documentElement;
}

function computeProgress(): number {
  const container = getScrollContainer();
  if (!container) return 0;

  const scrollTop = container.scrollTop ?? window.scrollY;
  const scrollHeight = container.scrollHeight ?? document.documentElement.scrollHeight;
  const clientHeight = container.clientHeight ?? window.innerHeight;

  if (scrollHeight <= clientHeight) return 0;

  return Math.min(1, Math.max(0, scrollTop / (scrollHeight - clientHeight)));
}

function buildCss(height: number): string {
  return `
    #${ROOT_ID} {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: ${height}px;
      z-index: 999999;
      pointer-events: none;
      background: transparent;
    }
    #${ROOT_ID}-fill {
      height: 100%;
      width: 0%;
      background: #000000;
      transform-origin: left;
      transition: width 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    html.simply-mail-dark-mode #${ROOT_ID}-fill {
      background: #ffffff;
    }
    @media (prefers-reduced-motion: reduce) {
      #${ROOT_ID}-fill {
        transition: none;
      }
    }
  `;
}

export function createScrollProgressModule(): SimplyMailModule {
  let bar: HTMLElement | null = null;
  let fill: HTMLElement | null = null;
  let scrollHandler: (() => void) | null = null;
  let lastHeight = 3;

  function ensureBar(): void {
    if (bar) return;

    bar = document.createElement('div');
    bar.id = ROOT_ID;

    fill = document.createElement('div');
    fill.id = `${ROOT_ID}-fill`;
    bar.appendChild(fill);

    document.documentElement.appendChild(bar);
  }

  function updateProgress(): void {
    if (!fill) return;
    const progress = computeProgress();
    fill.style.width = `${Math.round(progress * 100)}%`;
  }

  function applyHeight(height: number): void {
    if (height === lastHeight && document.getElementById(STYLE_ID)) return;
    lastHeight = height;
    ensureStyle(STYLE_ID, buildCss(height));
  }

  return {
    name: 'scrollProgress' as const,

    init(ctx: ModuleContext): void {
      const settings = ctx.settings.scrollProgress;
      const height = settings?.height ?? 3;

      applyHeight(height);
      ensureBar();

      scrollHandler = () => updateProgress();
      window.addEventListener('scroll', scrollHandler, { passive: true });

      // Also listen on the email app scroll container
      const container = getScrollContainer();
      if (container && container !== document.documentElement) {
        container.addEventListener('scroll', scrollHandler, { passive: true });
      }

      updateProgress();
    },

    destroy(): void {
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
        const container = getScrollContainer();
        if (container && container !== document.documentElement) {
          container.removeEventListener('scroll', scrollHandler);
        }
        scrollHandler = null;
      }
      if (bar) {
        bar.remove();
        bar = null;
        fill = null;
      }
      removeStyle(STYLE_ID);
    },

    onSettingsChange(settings: import('@/shared/types').SimplyMailSettings): void {
      const s = settings.scrollProgress;
      const height = s?.height ?? 3;
      applyHeight(height);
    },
  };
}

export { ROOT_ID, STYLE_ID };

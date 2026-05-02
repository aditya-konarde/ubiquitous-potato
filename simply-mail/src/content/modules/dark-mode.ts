import type { ModuleContext, SimplyMailModule } from '@/shared/types';

const STYLE_ID = 'simply-mail-dark-mode';
const ROOT_CLASS = 'simply-mail-dark-mode';

function shouldEnableDarkMode(context: ModuleContext): boolean {
  const { mode } = context.settings.darkMode;
  if (mode === 'dark') {
    return true;
  }
  if (mode === 'light') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const TRANSITION_CSS = `
  * { transition: background-color 150ms linear, color 150ms linear, border-color 150ms linear; }
`;

function buildCss(invertBodies: boolean): string {
  return `
    html.${ROOT_CLASS}, html.${ROOT_CLASS} body {
      background: #000000 !important;
      color: #ffffff !important;
    }
    html.${ROOT_CLASS} [role="banner"] {
      background: #000000 !important;
      border-bottom: 1px solid #27272a !important;
      box-shadow: none;
    }
    html.${ROOT_CLASS} [role="main"],
    html.${ROOT_CLASS} [role="navigation"],
    html.${ROOT_CLASS} [role="dialog"],
    html.${ROOT_CLASS} table,
    html.${ROOT_CLASS} tr,
    html.${ROOT_CLASS} td,
    html.${ROOT_CLASS} .nH,
    html.${ROOT_CLASS} .aeF,
    html.${ROOT_CLASS} .AO,
    html.${ROOT_CLASS} .aoI,
    html.${ROOT_CLASS} .adn.ads,
    html.${ROOT_CLASS} [data-message-id] {
      background-color: #0a0a0a !important;
      color: #ffffff !important;
      border-color: #27272a !important;
    }
    html.${ROOT_CLASS} .Cp,
    html.${ROOT_CLASS} .nH.if,
    html.${ROOT_CLASS} .aeJ {
      background: #0a0a0a !important;
    }
    html.${ROOT_CLASS} input,
    html.${ROOT_CLASS} textarea,
    html.${ROOT_CLASS} [contenteditable="true"],
    html.${ROOT_CLASS} [role="textbox"] {
      background: #000000 !important;
      color: #ffffff !important;
      border-color: #3f3f46 !important;
      box-shadow: none;
      border-radius: var(--simply-mail-radius, 10px);
    }
    html.${ROOT_CLASS} input:focus,
    html.${ROOT_CLASS} textarea:focus,
    html.${ROOT_CLASS} [contenteditable="true"]:focus,
    html.${ROOT_CLASS} [role="textbox"]:focus {
      border-color: #ffffff !important;
    }
    html.${ROOT_CLASS} a,
    html.${ROOT_CLASS} span,
    html.${ROOT_CLASS} div,
    html.${ROOT_CLASS} td,
    html.${ROOT_CLASS} button {
      border-color: #27272a !important;
    }
    html.${ROOT_CLASS} .TO,
    html.${ROOT_CLASS} .bog,
    html.${ROOT_CLASS} .zF,
    html.${ROOT_CLASS} .hP,
    html.${ROOT_CLASS} .ii.gt,
    html.${ROOT_CLASS} .ii,
    html.${ROOT_CLASS} .a3s,
    html.${ROOT_CLASS} .y6,
    html.${ROOT_CLASS} .xS,
    html.${ROOT_CLASS} .xT,
    html.${ROOT_CLASS} .asa,
    html.${ROOT_CLASS} .yW,
    html.${ROOT_CLASS} .T-I,
    html.${ROOT_CLASS} .J-Ke,
    html.${ROOT_CLASS} .n0,
    html.${ROOT_CLASS} .CJ,
    html.${ROOT_CLASS} .y2 {
      color: #ffffff !important;
    }
    html.${ROOT_CLASS} .y2,
    html.${ROOT_CLASS} .xW span,
    html.${ROOT_CLASS} .gD,
    html.${ROOT_CLASS} .afC,
    html.${ROOT_CLASS} .Dj,
    html.${ROOT_CLASS} .simply-mail-split-inbox-hint {
      color: #a1a1aa !important;
    }
    html.${ROOT_CLASS} .T-I,
    html.${ROOT_CLASS} .simply-mail-command-key {
      border-radius: var(--simply-mail-radius, 10px);
    }
    html.${ROOT_CLASS} *::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    html.${ROOT_CLASS} *::-webkit-scrollbar-track {
      background: #000000;
    }
    html.${ROOT_CLASS} *::-webkit-scrollbar-thumb {
      background: #27272a;
      border-radius: var(--simply-mail-radius, 10px);
      border: 1px solid #000000;
    }
    html.${ROOT_CLASS} *::-webkit-scrollbar-thumb:hover {
      background: #3f3f46;
    }
    ${invertBodies ? `html.${ROOT_CLASS} .a3s { filter: invert(1) hue-rotate(180deg); }` : ''}
  `;
}

function apply(context: ModuleContext) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = buildCss(context.settings.darkMode.invertMessageBodies);
  const shouldEnable = shouldEnableDarkMode(context);
  if (shouldEnable !== document.documentElement.classList.contains(ROOT_CLASS)) {
    let transStyle = document.getElementById(STYLE_ID + '-transitions') as HTMLStyleElement | null;
    if (!transStyle) {
      transStyle = document.createElement('style');
      transStyle.id = STYLE_ID + '-transitions';
      document.documentElement.appendChild(transStyle);
    }
    transStyle.textContent = TRANSITION_CSS;
    setTimeout(() => document.getElementById(STYLE_ID + '-transitions')?.remove(), 350);
  }
  document.documentElement.classList.toggle(ROOT_CLASS, shouldEnable);
}

export function createDarkModeModule(): SimplyMailModule {
  let mediaQuery: MediaQueryList | null = null;
  let mediaHandler: (() => void) | null = null;

  return {
    name: 'darkMode',
    init(context) {
      apply(context);
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaHandler = () => apply(context);
      mediaQuery.addEventListener('change', mediaHandler);
    },
    destroy() {
      mediaQuery?.removeEventListener('change', mediaHandler as EventListener);
      mediaQuery = null;
      mediaHandler = null;
      document.documentElement.classList.remove(ROOT_CLASS);
      document.getElementById(STYLE_ID)?.remove();
      document.getElementById(STYLE_ID + '-transitions')?.remove();
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      apply(context);
    },
  };
}

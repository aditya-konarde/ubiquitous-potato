import { MAIL_SELECTORS } from '../mail-selectors';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';
import { ensureStyle, removeStyle } from './dom-utils';

const STYLE_ID = 'simply-mail-ui-cleanup';

function getOwnDomain(): string {
  const accountEl = document.querySelector(MAIL_SELECTORS.accountElement);
  if (!accountEl) return '';
  const label = accountEl.getAttribute('aria-label') || '';
  const match = label.match(/\(([^)]+@([^)]+))\)/);
  return match ? match[2] : '';
}

function buildCss(context: ModuleContext): string {
  const { uiCleanup } = context.settings;
  const ownDomain = getOwnDomain();

  const recipientCss = ownDomain ? `
    /* Smart Recipient Highlighting */
    .vR, .vR:has([data-hovercard-id]) {
      background-color: rgba(234, 88, 12, 0.08) !important;
      border: 1px solid rgba(234, 88, 12, 0.15) !important;
    }
    .vR .vN { color: #ea580c !important; }
    html.simply-mail-dark-mode .vR, html.simply-mail-dark-mode .vR:has([data-hovercard-id]) {
      background-color: rgba(234, 88, 12, 0.15) !important;
      border-color: rgba(234, 88, 12, 0.25) !important;
    }
    html.simply-mail-dark-mode .vR .vN { color: #fdba74 !important; }

    .vR:has([data-hovercard-id$="@${ownDomain}"]) {
      background-color: #f4f4f5 !important;
      border-color: #e4e4e7 !important;
    }
    .vR:has([data-hovercard-id$="@${ownDomain}"]) .vN { color: var(--simply-mail-text-strong) !important; }
    html.simply-mail-dark-mode .vR:has([data-hovercard-id$="@${ownDomain}"]) {
      background-color: #27272a !important;
      border-color: #3f3f46 !important;
    }
  ` : '';

  const widthRule = uiCleanup.constrainWidth
    ? `
      .simply-mail-shell ${MAIL_SELECTORS.appRoot} {
        max-width: 1480px;
        margin-inline: auto;
      }
    `
    : '';

  const compactDensityRule = uiCleanup.compactDensity
    ? `
      tr[role="row"] {
        height: 36px !important;
        max-height: 36px !important;
        line-height: 1.2 !important;
      }
      tr[role="row"] td {
        padding-top: 2px !important;
        padding-bottom: 2px !important;
      }
      tr[role="row"] .xY {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }
      .zA {
        padding-top: 2px !important;
        padding-bottom: 2px !important;
      }
    `
    : '';

  return `
    :root {
      --simply-mail-font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --simply-mail-surface: #ffffff;
      --simply-mail-surface-strong: #fcfcfd;
      --simply-mail-border: #e4e4e7;
      --simply-mail-shadow: 0 4px 12px rgba(0,0,0,0.05);
      --simply-mail-hover: #f1f5f9;
      --simply-mail-hover-strong: #e2e8f0;
      --simply-mail-text-strong: #09090b;
      --simply-mail-text-muted: #52525b;
      --simply-mail-text-subtle: #a1a1aa;
      --simply-mail-accent: #0f172a;
      --simply-mail-bg-surface: #ffffff;
      --simply-mail-bg-surface-muted: #f8fafc;
      --simply-mail-radius: 10px;
    }
    ${recipientCss}
    ${uiCleanup.hideMeet ? `${MAIL_SELECTORS.meetSection} { display: none !important; }` : ''}
    ${uiCleanup.hideChat ? `${MAIL_SELECTORS.chatSection} { display: none !important; }` : ''}
    ${uiCleanup.hideSpaces ? `${MAIL_SELECTORS.spacesSection} { display: none !important; }` : ''}
    ${MAIL_SELECTORS.googleAppsButton}, ${MAIL_SELECTORS.footer}, ${MAIL_SELECTORS.storageBar} { display: none !important; }
    ${widthRule}
    ${compactDensityRule}
    body, button, input, textarea { font-family: var(--simply-mail-font) !important; }
    body {
      background: var(--simply-mail-surface-strong) !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    ${MAIL_SELECTORS.appRoot}, [role="banner"] {
      backdrop-filter: none !important;
      background: var(--simply-mail-surface) !important;
    }
    /* focused extreme minimalism */
    ${MAIL_SELECTORS.sidebar}, .aeN {
      display: none !important;
    }
    ${MAIL_SELECTORS.sidebar} a,
    ${MAIL_SELECTORS.sidebar} .TO,
    ${MAIL_SELECTORS.sidebar} .TN,
    ${MAIL_SELECTORS.sidebar} [role="link"] {
      border-radius: var(--simply-mail-radius) !important;
      transition: background 150ms ease, color 150ms ease;
      margin: 2px 8px !important;
      padding: 0 8px !important;
    }
    ${MAIL_SELECTORS.sidebar} a:hover,
    ${MAIL_SELECTORS.sidebar} .TO:hover,
    ${MAIL_SELECTORS.sidebar} .TN:hover,
    ${MAIL_SELECTORS.sidebar} [role="link"]:hover {
      background: var(--simply-mail-hover) !important;
      box-shadow: none;
    }
    .TO.nZ { /* Active sidebar item */
      background: var(--simply-mail-hover-strong) !important;
      font-weight: 600 !important;
    }
    /* Email rows */
    tr[role="row"], [role="main"] table[role="grid"] tr, .zA {
      transition: background 100ms ease, transform 100ms ease;
      box-shadow: none !important;
      border: none !important;
    }
    tr[role="row"] td, .zA td {
      border: none !important;
      background: transparent !important;
    }
    /* Hide clutter: checkboxes, stars, priority markers */
    .zA > .PF, .zA > .WA, .zA > .pG, .zA > .bq4 {
      display: none !important;
    }

    tr[role="row"] td:first-child, .zA td:first-child {
      border-top-left-radius: var(--simply-mail-radius);
      border-bottom-left-radius: var(--simply-mail-radius);
    }
    tr[role="row"] td:last-child, .zA td:last-child {
      border-top-right-radius: var(--simply-mail-radius);
      border-bottom-right-radius: var(--simply-mail-radius);
    }
    /* Subtle row spacing via padding instead of borders */
    tr[role="row"], .zA {
      margin-bottom: 2px !important;
    }
    tr[role="row"]:hover td,
    [role="main"] table[role="grid"] tr:hover td,
    tr[role="row"].x7 td,
    .zA:hover td {
      background: var(--simply-mail-hover) !important;
    }
    ${MAIL_SELECTORS.anyDialog}, .aoI, .nH.aoI {
      border-radius: var(--simply-mail-radius);
      border: 1px solid var(--simply-mail-border) !important;
      box-shadow: var(--simply-mail-shadow) !important;
      overflow: hidden;
    }
    .adn.ads, [data-message-id] {
      border-radius: var(--simply-mail-radius);
      border: 1px solid var(--simply-mail-border);
      background: var(--simply-mail-surface) !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important;
      margin-bottom: 24px;
      padding: 24px;
      overflow: visible;
    }
    .TO, .nU .J-Ke.n0 {
      color: var(--simply-mail-text-strong) !important;
    }
    .yW span, .zF {
      font-weight: 700 !important;
      color: var(--simply-mail-text-strong) !important;
      letter-spacing: 0;
    }
    .bog {
      font-size: 14px !important;
      font-weight: 500 !important;
      color: var(--simply-mail-text-muted) !important;
    }
    .y2 {
      color: var(--simply-mail-text-subtle) !important;
    }
    tr[role="row"] td:first-child, .zA td:first-child {
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    }
    tr[role="row"]:hover td:first-child,
    tr[role="row"].simply-mail-row-selected td:first-child,
    .zA:hover td:first-child {
      opacity: 1;
    }
    ${MAIL_SELECTORS.composeDialog}, .nH.Hd[role="dialog"] {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      margin: 0 !important;
      right: auto !important;
      bottom: auto !important;
      width: 760px !important;
      max-width: 90vw !important;
      height: 600px !important;
      max-height: 90vh !important;
      z-index: 1000 !important;
      border-radius: 14px !important;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4), 0 24px 48px -12px rgba(0, 0, 0, 0.3) !important;
      border: 1px solid var(--simply-mail-border) !important;
    }
    html.simply-mail-dark-mode {
      --simply-mail-surface: #0a0a0a;
      --simply-mail-surface-strong: #000000;
      --simply-mail-border: #27272a;
      --simply-mail-shadow: 0 4px 24px rgba(0,0,0,0.5);
      --simply-mail-hover: #171717;
      --simply-mail-hover-strong: #262626;
      --simply-mail-text-strong: #fafafa;
      --simply-mail-text-muted: #a1a1aa;
      --simply-mail-text-subtle: #52525b;
      --simply-mail-accent: #ffffff;
      --simply-mail-bg-surface: #0a0a0a;
      --simply-mail-bg-surface-muted: #111111;
    }
    html.simply-mail-dark-mode body {
      background: var(--simply-mail-surface-strong) !important;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: var(--simply-mail-radius); }
    ::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
    html.simply-mail-dark-mode ::-webkit-scrollbar-thumb { background: #27272a; }
    html.simply-mail-dark-mode ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }

    /* Remove slow animations for speed */
    ${MAIL_SELECTORS.anyDialog}, .aoI, .nH.aoI {
      animation: none !important;
    }
    [data-message-id] {
      position: relative;
    }
    [data-message-id]::before {
      content: '';
      position: absolute;
      left: 20px;
      top: 0;
      bottom: 0;
      width: 1px;
      background: transparent;
    }
    [data-message-id]:first-child::before {
      top: 16px;
    }
  `;
}

export function createUiCleanupModule(): SimplyMailModule {
  return {
    name: 'uiCleanup',
    init(context) {
      document.body.classList.add('simply-mail-shell');
      ensureStyle(STYLE_ID, buildCss(context));
    },
    destroy() {
      document.body.classList.remove('simply-mail-shell');
      removeStyle(STYLE_ID);
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      ensureStyle(STYLE_ID, buildCss(context));
    },
  };
}

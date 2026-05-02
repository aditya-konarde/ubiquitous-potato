import type { ModuleContext } from '@/shared/types';
import { sendRuntimeMessage } from '@/shared/messaging';

declare global {
  interface Navigator {
    userAgentData?: { platform: string };
  }
}

const OVERLAY_ID = 'simply-mail-onboarding-overlay';
const STYLE_ID = 'simply-mail-onboarding-styles';
const HINT_ID = 'simply-mail-onboarding-hint';
const HINT_STYLE_ID = 'simply-mail-onboarding-hint-styles';
const HINT_AUTO_DISMISS_MS = 5000;

const ONBOARDING_CSS = `
  @keyframes simply-mail-onboard-enter {
    from { opacity: 0; transform: scale(0.98) }
    to { opacity: 1; transform: scale(1) }
  }
  @keyframes simply-mail-onboard-fadeout {
    from { opacity: 1 }
    to { opacity: 0 }
  }
  @keyframes simply-mail-hint-enter {
    from { opacity: 0; transform: translateY(8px) }
    to { opacity: 1; transform: translateY(0) }
  }
  @keyframes simply-mail-hint-fadeout {
    from { opacity: 1; transform: translateY(0) }
    to { opacity: 0; transform: translateY(8px) }
  }
  @keyframes simply-mail-highlight-flash {
    0% { outline: 2px solid transparent; outline-offset: 2px; }
    25% { outline: 2px solid #3b82f6; outline-offset: 2px; }
    65% { outline: 2px solid #3b82f6; outline-offset: 2px; }
    100% { outline: 2px solid transparent; outline-offset: 2px; }
  }
  .simply-mail-highlight-active {
    animation: simply-mail-highlight-flash 1.2s ease-out forwards;
  }

  #${OVERLAY_ID} {
    position: fixed;
    inset: 0;
    z-index: 100001;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: simply-mail-onboard-enter 0.2s linear;
  }

  #${OVERLAY_ID}.simply-mail-onboard-leaving {
    animation: simply-mail-onboard-fadeout 0.3s ease-in forwards;
  }

  .simply-mail-onboard-card {
    background: var(--simply-mail-surface, #ffffff);
    border: 1px solid var(--simply-mail-border, #e4e4e7);
    border-radius: 14px;
    max-width: 420px;
    width: 90%;
    padding: 36px 28px 28px;
    text-align: center;
    box-sizing: border-box;
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18);
  }

  html.simply-mail-dark-mode .simply-mail-onboard-card {
    background: #0a0a0a;
    border-color: #27272a;
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5);
  }

  .simply-mail-onboard-title {
    font-size: 36px;
    font-weight: 800;
    letter-spacing: 0;
    margin: 0 0 4px 0;
    color: var(--simply-mail-text-strong, #000000);
    line-height: 1.2;
  }

  html.simply-mail-dark-mode .simply-mail-onboard-title {
    color: #ffffff;
  }

  .simply-mail-onboard-subtitle {
    font-size: 18px;
    font-weight: 500;
    color: var(--simply-mail-text-strong, #000000);
    margin: 0 0 12px 0;
  }

  html.simply-mail-dark-mode .simply-mail-onboard-subtitle {
    color: #ffffff;
  }

  .simply-mail-onboard-desc {
    font-size: 14px;
    color: var(--simply-mail-text-muted, #52525b);
    line-height: 1.5;
  }

  html.simply-mail-dark-mode .simply-mail-onboard-desc {
    color: #a1a1aa;
  }

  .simply-mail-onboard-demo {
    width: 100%;
    height: 136px;
    background: var(--simply-mail-surface-muted, #f8fafc);
    border: 1px solid var(--simply-mail-border, #e4e4e7);
    border-radius: 8px;
    margin: 24px 0;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05) inset;
    text-align: left;
  }

  html.simply-mail-dark-mode .simply-mail-onboard-demo {
    background: #111111;
    border-color: #27272a;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) inset;
  }

  .simply-mail-demo-header {
    display: flex;
    align-items: center;
    padding: 12px 14px;
    border-bottom: 1px solid var(--simply-mail-border, #e4e4e7);
  }

  html.simply-mail-dark-mode .simply-mail-demo-header {
    border-color: #27272a;
  }

  .simply-mail-demo-search {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    color: var(--simply-mail-text-muted, #52525b);
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
  }

  .simply-mail-demo-input {
    font-size: 13px;
    color: var(--simply-mail-text-strong, #000000);
    border-right: 2px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    animation: simply-mail-typing 4s infinite step-end;
  }

  html.simply-mail-dark-mode .simply-mail-demo-input {
    color: #ffffff;
  }

  .simply-mail-demo-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    margin: 6px;
    font-size: 12px;
    border-radius: 6px;
    color: var(--simply-mail-text-subtle, #71717a);
  }

  .simply-mail-demo-item-label {
    font-weight: 500;
  }

  .simply-mail-demo-item-key {
    font-size: 10px;
    opacity: 0.6;
  }

  .simply-mail-demo-item-active {
    background: var(--simply-mail-surface-strong, #f4f4f5);
    color: var(--simply-mail-text-strong, #000000);
    animation: simply-mail-demo-result 4s infinite;
  }

  html.simply-mail-dark-mode .simply-mail-demo-item-active {
    background: #171717;
    color: #ffffff;
  }

  @keyframes simply-mail-typing {
    0%, 15% { width: 0; border-color: currentColor; }
    20% { width: 3ch; border-color: currentColor; }
    25% { width: 6ch; border-color: currentColor; }
    30% { width: 10ch; border-color: currentColor; }
    35%, 85% { width: 14ch; border-color: transparent; }
    90%, 100% { width: 0; border-color: transparent; }
  }

  @keyframes simply-mail-demo-result {
    0%, 34% { opacity: 0; transform: translateY(4px); }
    35%, 85% { opacity: 1; transform: translateY(0); }
    86%, 100% { opacity: 0; transform: translateY(0); }
  }

  .simply-mail-onboard-features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 24px;
  }

  .simply-mail-onboard-feature {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--simply-mail-border, #e4e4e7);
    border-radius: 8px;
    text-align: left;
    box-sizing: border-box;
    background: var(--simply-mail-surface-muted, #f8fafc);
  }

  html.simply-mail-dark-mode .simply-mail-onboard-feature {
    border-color: #27272a;
    background: #111111;
  }

  .simply-mail-onboard-feature-icon {
    font-size: 16px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .simply-mail-onboard-feature-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .simply-mail-onboard-feature-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--simply-mail-text-strong, #000000);
  }

  html.simply-mail-dark-mode .simply-mail-onboard-feature-name {
    color: #ffffff;
  }

  .simply-mail-onboard-feature-desc {
    font-size: 10px;
    color: var(--simply-mail-text-subtle, #a1a1aa);
  }

  .simply-mail-onboard-btn {
    width: 100%;
    height: 44px;
    border: none;
    border-radius: 10px;
    background: var(--simply-mail-text-strong, #000000);
    color: var(--simply-mail-surface, #ffffff);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 100ms linear, transform 100ms ease;
    letter-spacing: 0;
  }

  .simply-mail-onboard-btn:hover {
    opacity: 0.85;
    transform: translateY(-1px);
  }

  html.simply-mail-dark-mode .simply-mail-onboard-btn {
    background: #ffffff;
    color: #000000;
  }

  .simply-mail-onboard-actions {
    display: grid;
    gap: 10px;
  }

  .simply-mail-onboard-hint-link {
    display: inline-block;
    margin-top: 12px;
    font-size: 13px;
    color: var(--simply-mail-text-muted, #52525b);
    cursor: pointer;
    border: none;
    background: none;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .simply-mail-onboard-hint-link:hover {
    color: var(--simply-mail-text-strong, #000000);
  }

  html.simply-mail-dark-mode .simply-mail-onboard-hint-link:hover {
    color: #ffffff;
  }
`;

const HINT_CSS = `
  #${HINT_ID} {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 100002;
    background: var(--simply-mail-surface, #ffffff);
    border: 1px solid var(--simply-mail-border, #e4e4e7);
    border-radius: 12px;
    padding: 16px 20px;
    max-width: 260px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    animation: simply-mail-hint-enter 0.2s linear;
    box-sizing: border-box;
  }

  html.simply-mail-dark-mode #${HINT_ID} {
    background: #0a0a0a;
    border-color: #27272a;
  }

  #${HINT_ID}.simply-mail-hint-leaving {
    animation: simply-mail-hint-fadeout 0.15s linear forwards;
  }

  .simply-mail-hint-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--simply-mail-text-muted, #52525b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 10px 0;
  }

  .simply-mail-hint-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .simply-mail-hint-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--simply-mail-text-strong, #000000);
  }

  html.simply-mail-dark-mode .simply-mail-hint-item {
    color: #a1a1aa;
  }

  .simply-mail-hint-key {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 11px;
    font-weight: 600;
    background: var(--simply-mail-surface-strong, #f4f4f5);
    border: 1px solid var(--simply-mail-border, #e4e4e7);
    border-radius: 6px;
    padding: 2px 6px;
    min-width: 28px;
    text-align: center;
    color: var(--simply-mail-text-strong, #000000);
    flex-shrink: 0;
  }

  html.simply-mail-dark-mode .simply-mail-hint-key {
    background: #171717;
    border-color: #27272a;
    color: #ffffff;
  }

  .simply-mail-hint-tip {
    font-size: 11px;
    color: var(--simply-mail-text-muted, #52525b);
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--simply-mail-border, #e4e4e7);
    line-height: 1.4;
  }

  html.simply-mail-dark-mode .simply-mail-hint-tip {
    color: #71717a;
    border-color: #27272a;
  }
`;

function injectStyles(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.documentElement.appendChild(style);
}

function removeStyles(id: string): void {
  document.getElementById(id)?.remove();
}

function isMac(): boolean {
  if (navigator.userAgentData) {
    return navigator.userAgentData.platform === 'macOS';
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

function showOverlay(storage: ModuleContext['storage']): void {
  injectStyles(STYLE_ID, ONBOARDING_CSS);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  const modKey = isMac() ? 'Cmd' : 'Ctrl';

  overlay.innerHTML = `
    <div class="simply-mail-onboard-card">
      <div class="simply-mail-onboard-title">Simply Mail is ready</div>
      <div class="simply-mail-onboard-subtitle">Your email app just got faster.</div>
      <div class="simply-mail-onboard-desc">
        Jump to anything, toggle features, and navigate your inbox — all from one shortcut.
      </div>

      <div class="simply-mail-onboard-demo">
        <div class="simply-mail-demo-header">
          <svg class="simply-mail-demo-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <div class="simply-mail-demo-input">Compose mail</div>
        </div>
        <div class="simply-mail-demo-item simply-mail-demo-item-active">
          <span class="simply-mail-demo-item-label">Compose action</span>
          <span class="simply-mail-demo-item-key">C</span>
        </div>
      </div>

      <div class="simply-mail-onboard-features">
        <div class="simply-mail-onboard-feature">
          <span class="simply-mail-onboard-feature-icon" aria-hidden="true">⌘</span>
          <span class="simply-mail-onboard-feature-text">
            <span class="simply-mail-onboard-feature-name">Command palette</span>
            <span class="simply-mail-onboard-feature-desc">${modKey}+K actions</span>
          </span>
        </div>
        <div class="simply-mail-onboard-feature">
          <span class="simply-mail-onboard-feature-icon" aria-hidden="true">J</span>
          <span class="simply-mail-onboard-feature-text">
            <span class="simply-mail-onboard-feature-name">Keyboard flow</span>
            <span class="simply-mail-onboard-feature-desc">Move through mail</span>
          </span>
        </div>
        <div class="simply-mail-onboard-feature">
          <span class="simply-mail-onboard-feature-icon" aria-hidden="true">✓</span>
          <span class="simply-mail-onboard-feature-text">
            <span class="simply-mail-onboard-feature-name">Cleaner inbox</span>
            <span class="simply-mail-onboard-feature-desc">Less interface clutter</span>
          </span>
        </div>
        <div class="simply-mail-onboard-feature">
          <span class="simply-mail-onboard-feature-icon" aria-hidden="true">•</span>
          <span class="simply-mail-onboard-feature-text">
            <span class="simply-mail-onboard-feature-name">Privacy guard</span>
            <span class="simply-mail-onboard-feature-desc">Tracker blocking</span>
          </span>
        </div>
      </div>

      <div class="simply-mail-onboard-actions">
        <button class="simply-mail-onboard-btn">Get Started</button>
        <button class="simply-mail-onboard-hint-link" type="button">Open settings</button>
      </div>
    </div>
  `;

  const btn = overlay.querySelector('.simply-mail-onboard-btn') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    dismissOverlay(storage, overlay);
  });

  const settingsBtn = overlay.querySelector('.simply-mail-onboard-hint-link') as HTMLButtonElement;
  settingsBtn.addEventListener('click', () => {
    void sendRuntimeMessage({ type: 'simply-mail/open-options' });
    dismissOverlay(storage, overlay);
  });

  document.body.appendChild(overlay);
}

function dismissOverlay(storage: ModuleContext['storage'], overlay: HTMLElement): void {
  overlay.classList.add('simply-mail-onboard-leaving');
  overlay.addEventListener('animationend', () => {
    overlay.remove();
    removeStyles(STYLE_ID);
    highlightSimplyMailElements();
    showShortcutsHint();
  }, { once: true });

  void storage.patchSettings({ onboarded: true });
  void sendRuntimeMessage({ type: 'simply-mail/onboarded-badge' });
}

function highlightSimplyMailElements(): void {
  const selectors = ['#simply-mail-split-inbox', '#simply-mail-saved-searches', '[role="navigation"]'];
  let delay = 0;
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      setTimeout(() => {
        el.classList.add('simply-mail-highlight-active');
        el.addEventListener('animationend', () => {
          el.classList.remove('simply-mail-highlight-active');
        }, { once: true });
      }, delay);
      delay += 400;
    }
  }
}

function showShortcutsHint(): void {
  const modKey = isMac() ? 'Cmd' : 'Ctrl';

  injectStyles(HINT_STYLE_ID, HINT_CSS);

  const hint = document.createElement('div');
  hint.id = HINT_ID;

  const shortcuts = [
    { key: 'j / k', desc: 'Navigate' },
    { key: 'e', desc: 'Archive' },
    { key: 'r', desc: 'Reply' },
    { key: '/', desc: 'Search' },
    { key: `${modKey}+K`, desc: 'Command palette' },
    { key: 'Esc', desc: 'Close' },
  ];

  hint.innerHTML = `
    <div class="simply-mail-hint-title">Keyboard Shortcuts</div>
    <ul class="simply-mail-hint-list">
      ${shortcuts.map(s => `
        <li class="simply-mail-hint-item">
          <span class="simply-mail-hint-key">${s.key}</span>
          <span>${s.desc}</span>
        </li>
      `).join('')}
    </ul>
    <div class="simply-mail-hint-tip">Tip: Press ? anytime to see all shortcuts</div>
  `;

  // Auto-dismiss after the user has had enough time to scan the shortcuts.
  const timer = setTimeout(() => dismissHint(hint), HINT_AUTO_DISMISS_MS);

  // Dismiss on click
  hint.addEventListener('click', () => {
    clearTimeout(timer);
    dismissHint(hint);
  }, { once: true });

  // Dismiss on Esc
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearTimeout(timer);
      dismissHint(hint);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(hint);
}

function dismissHint(hint: HTMLElement): void {
  hint.classList.add('simply-mail-hint-leaving');
  hint.addEventListener('animationend', () => {
    hint.remove();
    removeStyles(HINT_STYLE_ID);
  }, { once: true });
}

/**
 * Initialize the onboarding overlay. Shows the welcome screen on first run.
 * Returns a cleanup function to remove all onboarding DOM.
 */
export async function initOnboarding(storage: ModuleContext['storage']): Promise<() => void> {
  const settings = await storage.getSettings();
  if (settings.onboarded) {
    return () => {};
  }

  showOverlay(storage);

  return () => {
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(HINT_ID)?.remove();
    removeStyles(STYLE_ID);
    removeStyles(HINT_STYLE_ID);
  };
}

export { OVERLAY_ID, STYLE_ID, HINT_ID, HINT_STYLE_ID };

import { MAIL_SELECTORS } from '../mail-selectors';
import type { ModuleContext, SimplyMailModule } from '@/shared/types';
import { showToast } from './toast';
import { hashForQuery } from './dom-utils';

const ROW_SELECTED_CLASS = 'simply-mail-row-selected';
const HELP_OVERLAY_ID = 'simply-mail-keyboard-help';

const HELP_SHORTCUTS: readonly { keys: string; description: string }[] = [
  { keys: 'j / k', description: 'Navigate up / down' },
  { keys: 'Enter', description: 'Open thread' },
  { keys: 'x', description: 'Toggle selection (checkbox)' },
  { keys: 'e', description: 'Archive' },
  { keys: 'r', description: 'Reply' },
  { keys: '/', description: 'Focus search' },
  { keys: 'Cmd/Ctrl+K', description: 'Command palette' },
  { keys: '?', description: 'Show / hide this help' },
  { keys: '1–9', description: 'Jump to saved search (1st–9th)' },
  { keys: 'Escape', description: 'Close overlay / palette' },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest('input, textarea, [contenteditable="true"], [role="textbox"]'));
}

function isHelpVisible(): boolean {
  const el = document.getElementById(HELP_OVERLAY_ID);
  return el !== null && !el.hidden;
}

function showHelpOverlay(): void {
  let overlay = document.getElementById(HELP_OVERLAY_ID);
  if (overlay) {
    overlay.hidden = false;
    return;
  }

  overlay = document.createElement('div');
  overlay.id = HELP_OVERLAY_ID;

  const backdrop = document.createElement('div');
  backdrop.className = 'simply-mail-help-backdrop';

  const panel = document.createElement('div');
  panel.className = 'simply-mail-help-panel';

  const heading = document.createElement('div');
  heading.className = 'simply-mail-help-heading';
  heading.textContent = 'Keyboard shortcuts';
  panel.appendChild(heading);

  const table = document.createElement('table');
  table.className = 'simply-mail-help-table';
  for (const shortcut of HELP_SHORTCUTS) {
    const tr = document.createElement('tr');
    const tdKeys = document.createElement('td');
    tdKeys.className = 'simply-mail-help-keys';
    tdKeys.textContent = shortcut.keys;
    const tdDesc = document.createElement('td');
    tdDesc.className = 'simply-mail-help-desc';
    tdDesc.textContent = shortcut.description;
    tr.appendChild(tdKeys);
    tr.appendChild(tdDesc);
    table.appendChild(tr);
  }
  panel.appendChild(table);

  backdrop.addEventListener('click', hideHelpOverlay);
  overlay.appendChild(backdrop);
  overlay.appendChild(panel);
  document.documentElement.appendChild(overlay);
}

function hideHelpOverlay(): void {
  const overlay = document.getElementById(HELP_OVERLAY_ID);
  if (overlay) {
    overlay.hidden = true;
  }
}

function removeHelpOverlay(): void {
  document.getElementById(HELP_OVERLAY_ID)?.remove();
}

function injectHelpStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.id = 'simply-mail-keyboard-help-style';
  style.textContent = `
    #${HELP_OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #${HELP_OVERLAY_ID}[hidden] {
      display: none;
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-panel {
      position: relative;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 0;
      box-shadow: none;
      padding: 16px 24px;
      min-width: 320px;
      max-width: min(480px, calc(100vw - 32px));
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-heading {
      font-size: 14px;
      font-weight: 600;
      color: #18181b;
      margin-bottom: 12px;
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-table {
      border-collapse: collapse;
      width: 100%;
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-table tr + tr {
      border-top: 1px solid #f4f4f5;
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-keys {
      padding: 6px 12px 6px 0;
      font-family: monospace;
      font-size: 13px;
      color: #52525b;
      white-space: nowrap;
    }
    #${HELP_OVERLAY_ID} .simply-mail-help-desc {
      padding: 6px 0;
      font-size: 13px;
      color: #71717a;
    }
    html.simply-mail-dark-mode #${HELP_OVERLAY_ID} .simply-mail-help-backdrop {
      background: rgba(0, 0, 0, 0.6);
    }
    html.simply-mail-dark-mode #${HELP_OVERLAY_ID} .simply-mail-help-panel {
      background: #27272a;
      border-color: #3f3f46;
    }
    html.simply-mail-dark-mode #${HELP_OVERLAY_ID} .simply-mail-help-heading {
      color: #fafafa;
    }
    html.simply-mail-dark-mode #${HELP_OVERLAY_ID} .simply-mail-help-table tr + tr {
      border-top-color: #3f3f46;
    }
    html.simply-mail-dark-mode #${HELP_OVERLAY_ID} .simply-mail-help-keys {
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode #${HELP_OVERLAY_ID} .simply-mail-help-desc {
      color: #a1a1aa;
    }
  `;
  document.documentElement.appendChild(style);
  return style;
}

function getRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows)).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
}

function getSelectedIndex(rows: HTMLElement[]): number {
  return rows.findIndex((row) => row.classList.contains(ROW_SELECTED_CLASS));
}

function selectRow(rows: HTMLElement[], index: number): void {
  rows.forEach((row) => row.classList.remove(ROW_SELECTED_CLASS));
  const row = rows[index];
  if (!row) {
    return;
  }
  row.classList.add(ROW_SELECTED_CLASS);
  row.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}

function clickSelector(selector: string): void {
  (document.querySelector(selector) as HTMLElement | null)?.click();
}

export function createKeyboardNavigationModule(): SimplyMailModule {
  let keyHandler: ((event: KeyboardEvent) => void) | null = null;
  let observerUnsubscribe: (() => void) | null = null;
  let cachedRows: HTMLElement[] = [];
  let rowsValid = false;

  return {
    name: 'keyboardNavigation',
    init(context: ModuleContext) {
      const seedSelection = () => {
        rowsValid = false;
        const rows = getRows();
        if (rows.length > 0 && getSelectedIndex(rows) === -1) {
          selectRow(rows, 0);
        }
      };

      observerUnsubscribe = context.observer.on('inbox-updated', () => seedSelection());
      seedSelection();

      keyHandler = (event) => {
        if (isTypingTarget(event.target)) {
          return;
        }

        if (!rowsValid) {
          cachedRows = getRows();
          rowsValid = true;
        }
        const rows = cachedRows;
        const index = Math.max(getSelectedIndex(rows), 0);
        const usesVimMotion = context.settings.keyboardNavigation.vimMode;

        if ((event.key === 'ArrowDown' || (usesVimMotion && event.key === 'j')) && rows.length > 0) {
          event.preventDefault();
          selectRow(rows, Math.min(index + 1, rows.length - 1));
          return;
        }

        if ((event.key === 'ArrowUp' || (usesVimMotion && event.key === 'k')) && rows.length > 0) {
          event.preventDefault();
          selectRow(rows, Math.max(index - 1, 0));
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          if (context.observer.getCurrentView() === 'thread') {
            clickSelector(MAIL_SELECTORS.replyButton);
          } else {
            rows[index]?.click();
          }
          return;
        }

        if (event.key === 'x') {
          event.preventDefault();
          const row = rows[index];
          if (row) {
            const checkbox = row.querySelector(
              'div[role="checkbox"], input[type="checkbox"]',
            ) as HTMLElement | null;
            checkbox?.click();
          }
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          if (isHelpVisible()) {
            hideHelpOverlay();
          } else {
            clickSelector(MAIL_SELECTORS.backButton);
          }
          return;
        }

        if (event.key === '?') {
          event.preventDefault();
          if (isHelpVisible()) {
            hideHelpOverlay();
          } else {
            showHelpOverlay();
          }
          return;
        }

        if (event.key === 'r') {
          event.preventDefault();
          clickSelector(MAIL_SELECTORS.replyButton);
          return;
        }

        if (event.key === 'e') {
          event.preventDefault();
          clickSelector(MAIL_SELECTORS.toolbarArchive);
          showToast('Archived');
          return;
        }

        if (event.key === '#') {
          event.preventDefault();
          clickSelector(MAIL_SELECTORS.toolbarDelete);
          showToast('Moved to trash');
          return;
        }

        if (event.key === 'u') {
          event.preventDefault();
          const btn = document.querySelector(MAIL_SELECTORS.toolbarMarkReadUnread) as HTMLElement | null;
          if (btn) {
            const label = btn.getAttribute('aria-label') ?? btn.getAttribute('data-tooltip') ?? '';
            const markingUnread = /unread/i.test(label);
            btn.click();
            showToast(markingUnread ? 'Marked as unread' : 'Marked as read');
          }
          return;
        }

        if (event.key === '/') {
          event.preventDefault();
          (document.querySelector(MAIL_SELECTORS.searchInput) as HTMLInputElement | null)?.focus();
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          clickSelector(MAIL_SELECTORS.selectAllCheckbox);
        }

        // Number keys 1-9: jump to saved search
        if (event.key >= '1' && event.key <= '9' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const savedSearches = context.settings.savedSearchesList;
          const index = Number(event.key) - 1;
          const search = savedSearches[index];
          if (search) {
            event.preventDefault();
            window.location.hash = hashForQuery(search.query);
            showToast(`Saved search: ${search.label}`);
          }
        }
      };

      document.addEventListener('keydown', keyHandler, true);
      injectHelpStyles();
      const style = document.createElement('style');
      style.id = 'simply-mail-keyboard-navigation';
      style.textContent = `
        .${ROW_SELECTED_CLASS} {
          position: relative;
          background: rgba(0, 0, 0, 0.05) !important;
          box-shadow: none;
          border-left: 4px solid #3b82f6 !important;
        }
        .${ROW_SELECTED_CLASS} td {
          border-top-color: #d4d4d8 !important;
          border-bottom-color: #d4d4d8 !important;
        }
        html.simply-mail-dark-mode .${ROW_SELECTED_CLASS} {
          background: rgba(255, 255, 255, 0.05) !important;
          box-shadow: none;
          border-left: 4px solid #60a5fa !important;
        }
        html.simply-mail-dark-mode .${ROW_SELECTED_CLASS} td {
          border-top-color: #3f3f46 !important;
          border-bottom-color: #3f3f46 !important;
        }
      `;
      document.documentElement.appendChild(style);
    },
    destroy() {
      if (keyHandler) {
        document.removeEventListener('keydown', keyHandler, true);
      }
      observerUnsubscribe?.();
      observerUnsubscribe = null;
      keyHandler = null;
      cachedRows = [];
      rowsValid = false;
      document.querySelectorAll(`.${ROW_SELECTED_CLASS}`).forEach((row) => row.classList.remove(ROW_SELECTED_CLASS));
      document.getElementById('simply-mail-keyboard-navigation')?.remove();
      removeHelpOverlay();
      document.getElementById('simply-mail-keyboard-help-style')?.remove();
    },
  };
}

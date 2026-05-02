import { CommandPaletteRegistry } from '../command-registry';
import { MAIL_SELECTORS } from '../mail-selectors';
import { sendRuntimeMessage } from '@/shared/messaging';
import type { CommandDefinition, ModuleContext, SimplyMailModule } from '@/shared/types';

const ROOT_ID = 'simply-mail-command-palette';
const STYLE_ID = `${ROOT_ID}-style`;
const TITLE_ID = `${ROOT_ID}-title`;
const DESCRIPTION_ID = `${ROOT_ID}-description`;
const LIST_ID = `${ROOT_ID}-list`;
const GROUP_ORDER = ['Navigation', 'Actions', 'Settings', 'Split Inbox', 'Saved Searches'];

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

function fuzzyMatch(query: string, command: CommandDefinition): boolean {
  const haystack = [command.title, ...(command.keywords ?? []), command.group ?? ''].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function highlightText(text: string, query: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!query) {
    const textNode = document.createTextNode(text);
    fragment.appendChild(textNode);
    return fragment;
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) {
    const textNode = document.createTextNode(text);
    fragment.appendChild(textNode);
    return fragment;
  }

  // Build a regex from all terms to find matches
  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  for (const part of parts) {
    if (!part) continue;
    const isMatch = terms.some((term) => part.toLowerCase() === term);
    if (isMatch) {
      const span = document.createElement('span');
      span.className = 'simply-mail-palette-highlight';
      span.textContent = part;
      fragment.appendChild(span);
    } else {
      fragment.appendChild(document.createTextNode(part));
    }
  }

  return fragment;
}

function navigateTo(hash: string) {
  window.location.hash = hash;
}

function clickFirst(selector: string) {
  document.querySelector<HTMLElement>(selector)?.click();
}

function hasRuntimeMessages(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.onMessage);
}

function getBaseCommands(context: ModuleContext): CommandDefinition[] {
  return [
    { id: 'go-inbox', title: 'Go to Inbox', group: 'Navigation', keywords: ['inbox'], run: () => navigateTo('#inbox') },
    { id: 'go-sent', title: 'Go to Sent', group: 'Navigation', keywords: ['sent'], run: () => navigateTo('#sent') },
    { id: 'go-drafts', title: 'Go to Drafts', group: 'Navigation', keywords: ['drafts'], run: () => navigateTo('#drafts') },
    { id: 'go-starred', title: 'Go to Starred', group: 'Navigation', keywords: ['starred'], run: () => navigateTo('#starred') },
    { id: 'compose', title: 'Compose', group: 'Actions', keywords: ['new message'], run: () => clickFirst(MAIL_SELECTORS.composeButton) },
    { id: 'refresh', title: 'Refresh email app', group: 'Actions', run: () => window.location.reload() },
    { id: 'focus-search', title: 'Focus Search', group: 'Actions', keywords: ['find', 'query'], run: () => document.querySelector<HTMLInputElement>(MAIL_SELECTORS.searchInput)?.focus() },
    { id: 'select-all', title: 'Select All', group: 'Actions', keywords: ['bulk select'], run: () => clickFirst(MAIL_SELECTORS.selectAllCheckbox) },
    {
      id: 'toggle-dark',
      title: 'Toggle Dark Mode',
      group: 'Settings',
      keywords: ['theme'],
      run: () => void context.storage.patchSettings({ darkMode: { ...context.settings.darkMode, enabled: !context.settings.darkMode.enabled } }),
    },
    {
      id: 'toggle-tracker-blocking',
      title: 'Toggle Tracker Blocking',
      group: 'Settings',
      keywords: ['tracker', 'blocker', 'privacy'],
      run: () => void context.storage.patchSettings({ trackerBlocker: { ...context.settings.trackerBlocker, enabled: !context.settings.trackerBlocker.enabled } }),
    },
    {
      id: 'toggle-split-inbox',
      title: 'Toggle Split Inbox',
      group: 'Settings',
      keywords: ['split', 'inbox', 'tabs'],
      run: () => void context.storage.patchSettings({ splitInboxSettings: { ...context.settings.splitInboxSettings, enabled: !context.settings.splitInboxSettings.enabled } }),
    },
    {
      id: 'toggle-keyboard-navigation',
      title: 'Toggle Keyboard Navigation',
      group: 'Settings',
      keywords: ['keyboard', 'navigation', 'shortcuts'],
      run: () => void context.storage.patchSettings({ keyboardNavigation: { ...context.settings.keyboardNavigation, enabled: !context.settings.keyboardNavigation.enabled } }),
    },
    {
      id: 'toggle-saved-searches',
      title: 'Toggle Saved Searches',
      group: 'Settings',
      keywords: ['saved', 'searches', 'bookmarks'],
      run: () => void context.storage.patchSettings({ savedSearches: { ...context.settings.savedSearches, enabled: !context.settings.savedSearches.enabled } }),
    },
    {
      id: 'toggle-pause-inbox',
      title: 'Toggle Pause Inbox',
      group: 'Settings',
      keywords: ['pause', 'inbox', 'break'],
      run: () => void context.storage.patchSettings({ paused: !context.settings.paused }),
    },
    {
      id: 'toggle-group-by-date',
      title: 'Toggle Group by Date',
      group: 'Settings',
      keywords: ['group', 'date', 'bundle'],
      run: () => void context.storage.patchSettings({ groupByDate: { ...context.settings.groupByDate, enabled: !context.settings.groupByDate.enabled } }),
    },
    { id: 'open-settings', title: 'Open Settings', group: 'Settings', keywords: ['preferences'], run: () => void sendRuntimeMessage({ type: 'simply-mail/open-options' }) },
  ];
}

function buildSavedSearchCommands(context: ModuleContext): CommandDefinition[] {
  if (!context.settings.commandPalette.includeSavedSearches) {
    return [];
  }

  return context.settings.savedSearchesList.map((search) => ({
    id: `saved-${search.id}`,
    title: `Search: ${search.label}`,
    group: 'Saved Searches',
    keywords: [search.query, search.label.toLowerCase()],
    run: () => navigateTo(`#search/${encodeURIComponent(search.query)}`),
  }));
}

function ensureRoot(): HTMLDivElement {
  let root = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(root);
  }
  return root;
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 15vh;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), visibility 200ms;
      }
      #${ROOT_ID}.is-open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      #${ROOT_ID} .simply-mail-command-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: -1;
      }
      #${ROOT_ID} .simply-mail-command-panel {
        width: min(680px, calc(100vw - 32px));
        background: var(--bg-surface);
        border: 1px solid var(--border-soft);
        border-radius: var(--radius-lg);
        box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        transform: scale(0.96) translateY(-8px);
        transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      #${ROOT_ID}.is-open .simply-mail-command-panel {
        transform: scale(1) translateY(0);
      }
      #${ROOT_ID} .simply-mail-command-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-soft);
      }
      #${ROOT_ID} .simply-mail-command-search-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        flex-shrink: 0;
      }
      #${ROOT_ID} .simply-mail-command-search-icon svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #${ROOT_ID} .simply-mail-command-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: var(--text-strong);
        font-size: 18px;
        font-weight: 500;
        font-family: inherit;
        padding: 0;
      }
      #${ROOT_ID} .simply-mail-command-input::placeholder {
        color: var(--text-subtle);
        opacity: 0.6;
      }
      #${ROOT_ID} .simply-mail-command-header-hint {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-subtle);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--bg-surface-strong);
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
      #${ROOT_ID} .simply-mail-command-list {
        max-height: 480px;
        overflow-y: auto;
        padding: 12px;
      }
      #${ROOT_ID} .simply-mail-command-group {
        padding: 12px 12px 8px;
        color: var(--text-subtle);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      #${ROOT_ID} .simply-mail-command {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 16px;
        width: 100%;
        padding: 12px 16px;
        border-radius: var(--radius-md);
        transition: var(--transition-base);
        border: none;
        text-align: left;
        cursor: pointer;
        background: transparent;
      }
      #${ROOT_ID} .simply-mail-command:hover,
      #${ROOT_ID} .simply-mail-command.is-active {
        background: var(--bg-surface-strong);
      }
      #${ROOT_ID} .simply-mail-command-badge {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-surface-muted);
        border: 1px solid var(--border-soft);
        color: var(--text-muted);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
      }
      #${ROOT_ID} .simply-mail-command-badge svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #${ROOT_ID} .simply-mail-command.is-active .simply-mail-command-badge {
        border-color: var(--border-strong);
        color: var(--text-strong);
        background: var(--bg-surface);
      }
      #${ROOT_ID} .simply-mail-command-title {
        color: var(--text-strong);
        font-size: 15px;
        font-weight: 600;
        display: block;
      }
      #${ROOT_ID} .simply-mail-command-subtitle {
        color: var(--text-muted);
        font-size: 13px;
        display: block;
        margin-top: 2px;
        opacity: 0.8;
      }
      #${ROOT_ID} .simply-mail-command-meta {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-subtle);
        background: var(--bg-surface-muted);
        padding: 2px 8px;
        border-radius: var(--radius-sm);
      }
      #${ROOT_ID} .simply-mail-command-footer {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 16px 24px;
        background: var(--bg-surface-muted);
        border-top: 1px solid var(--border-soft);
        color: var(--text-subtle);
        font-size: 12px;
        font-weight: 500;
      }
      #${ROOT_ID} .simply-mail-command-footer span {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${ROOT_ID} .simply-mail-command-key {
        background: var(--bg-surface);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-soft);
        font-size: 10px;
        font-weight: 700;
        color: var(--text-strong);
      }
      #${ROOT_ID} .simply-mail-command-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 24px;
        color: var(--text-muted);
      }
      #${ROOT_ID} .simply-mail-command-empty svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.3;
        stroke: currentColor;
        stroke-width: 1.5;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #${ROOT_ID} .simply-mail-command-empty-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-strong);
        margin-bottom: 4px;
      }
      #${ROOT_ID} .simply-mail-command-empty-subtitle {
        font-size: 14px;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-command-backdrop {
        background: rgba(0, 0, 0, 0.6);
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-command-panel {
        background: #18181b;
        border-color: #27272a;
        box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      }
    `;
    document.documentElement.appendChild(style);
  }
}

function getGroupIcon(group: string | undefined): string {
  switch (group) {
    case 'Recent':
      return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
    case 'Navigation':
      return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>';
    case 'Actions':
      return '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
    case 'Settings':
      return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    case 'Saved Searches':
      return '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';
    case 'Split Inbox':
      return '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>';
    default:
      return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }
}

function groupCommands(commands: CommandDefinition[]) {
  const grouped = new Map<string, CommandDefinition[]>();

  for (const command of commands) {
    const key = command.group ?? 'Other';
    const existing = grouped.get(key) ?? [];
    existing.push(command);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries()).sort(([left], [right]) => {
    const leftIndex = GROUP_ORDER.indexOf(left);
    const rightIndex = GROUP_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

export function createCommandPaletteModule(): SimplyMailModule {
  let keyHandler: ((event: KeyboardEvent) => void) | null = null;
  let commandsChangedHandler: (() => void) | null = null;
  let messageHandler: ((message: unknown) => void) | null = null;
  let root: HTMLDivElement | null = null;
  let selectedIndex = 0;
  let registry: CommandPaletteRegistry | null = null;
  let previousFocusedElement: HTMLElement | null = null;
  let closeTimer: number | null = null;
  let panelBuilt = false;
  // Cached DOM references for incremental updates
  let inputRef: HTMLInputElement | null = null;
  let listRef: HTMLDivElement | null = null;
  let headerHintRef: HTMLDivElement | null = null;
  let currentFiltered: CommandDefinition[] = [];

  const close = () => {
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');

    if (closeTimer !== null) {
      window.clearTimeout(closeTimer);
    }

    closeTimer = window.setTimeout(() => {
      if (root && !root.classList.contains('is-open')) {
        root.replaceChildren();
        panelBuilt = false;
        inputRef = null;
        listRef = null;
        headerHintRef = null;
      }
      closeTimer = null;
    }, 160);

    previousFocusedElement?.focus();
    previousFocusedElement = null;
  };

  const getCommands = (context: ModuleContext) => {
    const registryCommands = registry?.getCommands() ?? [];
    return [...getBaseCommands(context), ...buildSavedSearchCommands(context), ...registryCommands];
  };

  const updateList = (context: ModuleContext, query: string): void => {
    if (!listRef || !inputRef || !headerHintRef) return;

    const commands = getCommands(context);
    const filtered = query ? commands.filter((command) => fuzzyMatch(query, command)) : commands;
    currentFiltered = filtered;
    selectedIndex = Math.min(selectedIndex, Math.max(filtered.length - 1, 0));

    // Update hint
    headerHintRef.textContent = `${filtered.length} commands`;

    // Rebuild only the list content
    listRef.replaceChildren();

    const execute = (index: number) => {
      const command = filtered[index];
      if (!command) return;

      try {
        const recents = JSON.parse(sessionStorage.getItem('simply-mail:recent-commands') || '[]');
        const newRecents = [command.id, ...recents.filter((id: string) => id !== command.id)].slice(0, 3);
        sessionStorage.setItem('simply-mail:recent-commands', JSON.stringify(newRecents));
      } catch (e) {
        // Ignore storage errors
      }

      close();
      command.run();
    };

    if (filtered.length === 0) {
      listRef.innerHTML = `
        <div class="simply-mail-command-empty">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <div class="simply-mail-command-empty-title">No matching commands</div>
          <div class="simply-mail-command-empty-subtitle">Try a different search term</div>
        </div>
      `;
    } else {
      let globalIndex = 0;
      let finalGroups = Array.from(groupCommands(filtered));

      // If empty search query, inject "Recent" group at the top
      if (!query) {
        try {
          const recentsIds = JSON.parse(sessionStorage.getItem('simply-mail:recent-commands') || '[]');
          if (Array.isArray(recentsIds) && recentsIds.length > 0) {
            const recentCmds = recentsIds
              .map((id: string) => commands.find((c) => c.id === id))
              .filter(Boolean) as CommandDefinition[];

            if (recentCmds.length > 0) {
              const recentCmdsWithLabel = recentCmds.map(cmd => ({ ...cmd, group: 'Recent' }));
              finalGroups = [['Recent', recentCmdsWithLabel], ...finalGroups];

              // Remove these from other groups to avoid duplicates in empty state
              for (const [groupName, groupList] of finalGroups) {
                if (groupName !== 'Recent') {
                  const filteredGroup = groupList.filter(c => !recentsIds.includes(c.id));
                  finalGroups.find(g => g[0] === groupName)![1] = filteredGroup;
                }
              }
              // Cleanup empty groups
              finalGroups = finalGroups.filter(([, cmds]) => cmds.length > 0);
            }
          }
        } catch (e) {
          // Ignore parse errors from session storage
        }
      }

      for (const [groupName, groupCommandsList] of finalGroups) {
        const group = document.createElement('div');
        group.className = 'simply-mail-command-group';
        group.textContent = groupName;
        listRef.appendChild(group);

        for (const command of groupCommandsList) {
          const index = globalIndex;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `simply-mail-command${index === selectedIndex ? ' is-active' : ''}`;
          button.dataset.commandId = command.id;
          button.setAttribute('role', 'option');
          button.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');

          const badge = document.createElement('span');
          badge.className = 'simply-mail-command-badge';
          badge.innerHTML = getGroupIcon(command.group);

          const copy = document.createElement('span');
          copy.className = 'simply-mail-command-copy';

          const titleEl = document.createElement('span');
          titleEl.className = 'simply-mail-command-title';
          titleEl.appendChild(highlightText(command.title, query));

          const subtitle = document.createElement('span');
          subtitle.className = 'simply-mail-command-subtitle';
          subtitle.textContent = (command.keywords ?? []).slice(0, 3).join(' · ') || 'Run this action instantly';

          copy.append(titleEl, subtitle);

          const meta = document.createElement('small');
          meta.className = 'simply-mail-command-meta';
          meta.textContent = command.group ?? '';

          button.append(badge, copy, meta);
          button.addEventListener('click', () => execute(index));
          listRef.appendChild(button);
          globalIndex += 1;
        }
      }
    }

    // Update ARIA
    const activeButton = listRef.querySelector<HTMLButtonElement>('.simply-mail-command.is-active');
    if (activeButton) {
      activeButton.id = `simply-mail-command-option-${activeButton.dataset.commandId}`;
      inputRef.setAttribute('aria-activedescendant', activeButton.id);
    } else {
      inputRef.removeAttribute('aria-activedescendant');
    }

    if (activeButton && typeof activeButton.scrollIntoView === 'function') {
      activeButton.scrollIntoView({ block: 'nearest' });
    }
  };

  const buildPanel = (context: ModuleContext, query = ''): void => {
    if (!root) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'simply-mail-command-backdrop';
    backdrop.addEventListener('click', close);

    const panel = document.createElement('div');
    panel.className = 'simply-mail-command-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', TITLE_ID);
    panel.setAttribute('aria-describedby', DESCRIPTION_ID);

    const title = document.createElement('h2');
    title.id = TITLE_ID;
    title.className = 'simply-mail-command-sr-only';
    title.textContent = 'Simply Mail command palette';

    const description = document.createElement('p');
    description.id = DESCRIPTION_ID;
    description.className = 'simply-mail-command-sr-only';
    description.textContent = 'Search commands, use arrow keys to move, press Enter to run, or Escape to close.';

    const header = document.createElement('div');
    header.className = 'simply-mail-command-header';

    const searchIcon = document.createElement('div');
    searchIcon.className = 'simply-mail-command-search-icon';
    searchIcon.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

    const input = document.createElement('input');
    input.className = 'simply-mail-command-input';
    input.type = 'text';
    input.placeholder = 'Jump to anything in email app\u2026';
    input.value = query;
    input.autofocus = true;
    input.setAttribute('aria-label', 'Search commands');
    input.setAttribute('aria-controls', LIST_ID);
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-autocomplete', 'list');

    const headerHint = document.createElement('div');
    headerHint.className = 'simply-mail-command-header-hint';

    header.append(searchIcon, input, headerHint);

    const list = document.createElement('div');
    list.className = 'simply-mail-command-list';
    list.id = LIST_ID;
    list.setAttribute('role', 'listbox');

    const footer = document.createElement('div');
    footer.className = 'simply-mail-command-footer';

    const footerItems: Array<[string, string]> = [['\u2191\u2193', 'Navigate'], ['Enter', 'Run'], ['Esc', 'Close']];
    footerItems.forEach(([key, label]) => {
      const item = document.createElement('span');
      const keyEl = document.createElement('span');
      keyEl.className = 'simply-mail-command-key';
      keyEl.textContent = key;
      item.append(keyEl, document.createTextNode(label));
      footer.appendChild(item);
    });

    panel.append(title, description, header, list, footer);
    root.replaceChildren(backdrop, panel);

    // Cache references
    inputRef = input;
    listRef = list;
    headerHintRef = headerHint;
    panelBuilt = true;

    // Input handlers (bound once)
    input.addEventListener('input', (event) => {
      selectedIndex = 0;
      updateList(context, (event.target as HTMLInputElement).value);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, Math.max(currentFiltered.length - 1, 0));
        updateList(context, input.value);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateList(context, input.value);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const command = currentFiltered[selectedIndex];
        if (command) {
          close();
          command.run();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    });

    // Initial list render
    updateList(context, query);

    // Auto-focus with short delay for transition
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(query.length, query.length);
    }, 50);
  };

  const render = (context: ModuleContext, query = '') => {
    if (!root) return;
    if (panelBuilt && inputRef && listRef && headerHintRef) {
      // Incremental update: just update the list
      inputRef.value = query;
      updateList(context, query);
      return;
    }
    buildPanel(context, query);
  };

  const open = (context: ModuleContext) => {
    if (root?.classList.contains('is-open')) {
      close();
      return;
    }

    ensureStyle();
    root = ensureRoot();
    if (closeTimer !== null) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }

    previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.setAttribute('aria-hidden', 'false');
    selectedIndex = 0;
    render(context);

    // Force reflow then add class to trigger transitions
    void root.offsetHeight;
    root.classList.add('is-open');
  };

  const handleCommandChanges = (context: ModuleContext) => {
    if (root?.classList.contains('is-open')) {
      const query = inputRef?.value ?? '';
      updateList(context, query);
    }
  };

  return {
    name: 'commandPalette',
    init(context) {
      registry = context.commandPalette as CommandPaletteRegistry;
      keyHandler = (event) => {
        if (event.isComposing) {
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
          if (isEditableElement(event.target) && !root?.classList.contains('is-open')) {
            return;
          }
          event.preventDefault();
          open(context);
          return;
        }
        if (event.key === 'Escape' && root?.classList.contains('is-open')) {
          event.preventDefault();
          close();
        }
      };
      commandsChangedHandler = () => handleCommandChanges(context);
      document.addEventListener('keydown', keyHandler, true);
      window.addEventListener('simply-mail:commands-changed', commandsChangedHandler);
      messageHandler = (message: unknown) => {
        if (typeof message === 'object' && message !== null && (message as { type?: unknown }).type === 'simply-mail/toggle-palette') {
          open(context);
        }
      };
      if (hasRuntimeMessages()) {
        chrome.runtime.onMessage.addListener(messageHandler);
      }
    },
    destroy() {
      if (keyHandler) {
        document.removeEventListener('keydown', keyHandler, true);
      }
      if (commandsChangedHandler) {
        window.removeEventListener('simply-mail:commands-changed', commandsChangedHandler);
      }
      if (messageHandler) {
        if (hasRuntimeMessages()) {
          chrome.runtime.onMessage.removeListener(messageHandler);
        }
      }
      if (closeTimer !== null) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
      root?.remove();
      root = null;
      previousFocusedElement = null;
      document.getElementById(STYLE_ID)?.remove();
      keyHandler = null;
      commandsChangedHandler = null;
      messageHandler = null;
      registry = null;
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      handleCommandChanges(context);
    },
  };
}

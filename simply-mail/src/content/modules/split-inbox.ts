import type { CommandDefinition, ModuleContext, SimplyMailModule } from '@/shared/types';
import { hashForQuery, getMountPoint } from './dom-utils';

const ROOT_ID = 'simply-mail-split-inbox';
const STYLE_ID = `${ROOT_ID}-style`;

function shouldShow(context: ModuleContext): boolean {
  const view = context.observer.getCurrentView();
  return view === 'inbox' || view === 'search' || view === 'label';
}

function getVisibleCount(): number {
  return document.querySelectorAll('tr[role="row"], [role="main"] table[role="grid"] tr').length;
}

function getActiveTab(context: ModuleContext) {
  const activeFromHash = context.settings.splitTabs.find((tab) => window.location.hash === hashForQuery(tab.query));
  if (activeFromHash) {
    return activeFromHash;
  }

  if (window.location.hash === '#inbox') {
    return context.settings.splitTabs[0] ?? null;
  }

  return null;
}

function formatConversationCount(count: number): string {
  return `${count} ${count === 1 ? 'conversation' : 'conversations'}`;
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: sticky;
        top: 12px;
        z-index: 6;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 0 0 16px;
        padding: 12px;
        border: 1px solid #e4e4e7;
        background: #ffffff;
        backdrop-filter: none;
      }
      #${ROOT_ID} .simply-mail-split-inbox-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid transparent;
        background: transparent;
        color: #52525b;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
      #${ROOT_ID} .simply-mail-split-inbox-button:hover {
        background: #f4f4f5;
        color: #000000;
      }
      #${ROOT_ID} .simply-mail-split-inbox-button.is-active {
        background: #000000;
        color: #ffffff;
      }
      #${ROOT_ID} .simply-mail-split-inbox-count {
        min-width: 20px;
        padding: 2px 6px;
        background: #e4e4e7;
        color: #000000;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
      }
      #${ROOT_ID} .simply-mail-split-inbox-button.is-active .simply-mail-split-inbox-count {
        background: #ffffff;
        color: #000000;
      }
      #${ROOT_ID} .simply-mail-split-inbox-count.is-estimate {
        color: #71717a;
      }
      #${ROOT_ID} .simply-mail-split-inbox-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        width: 100%;
        padding-top: 4px;
        border-top: 1px solid #e4e4e7;
        color: #71717a;
        font-size: 12px;
      }
      #${ROOT_ID} .simply-mail-split-inbox-summary strong {
        color: #000000;
      }
      #${ROOT_ID} .simply-mail-split-inbox-hint {
        margin-left: auto;
        color: #a1a1aa;
      }
      #${ROOT_ID} .simply-mail-split-inbox-empty {
        padding: 24px 0;
        color: #71717a;
        font-size: 13px;
        text-align: center;
        width: 100%;
      }
      html.simply-mail-dark-mode #${ROOT_ID} {
        border-color: #27272a;
        background: #0a0a0a;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-button {
        color: #a1a1aa;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-button:hover {
        background: #111111;
        color: #ffffff;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-button.is-active {
        background: #ffffff;
        color: #000000;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-count {
        background: #27272a;
        color: #ffffff;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-button.is-active .simply-mail-split-inbox-count {
        background: #000000;
        color: #ffffff;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-count.is-estimate,
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-summary {
        color: #a1a1aa;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-summary {
        border-top-color: #27272a;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-summary strong {
        color: #ffffff;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-hint {
        color: #71717a;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-split-inbox-empty {
        color: #a1a1aa;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

function registerCommands(context: ModuleContext) {
  const commands: CommandDefinition[] = context.settings.splitTabs.map((tab) => ({
    id: `split-tab-${tab.id}`,
    title: `Open tab: ${tab.label}`,
    group: 'Split Inbox',
    keywords: [tab.query, tab.label.toLowerCase()],
    run: () => {
      window.location.hash = hashForQuery(tab.query);
    },
  }));

  context.commandPalette.registerCommands('splitInbox', commands);
}

function render(context: ModuleContext) {
  if (!shouldShow(context)) {
    document.getElementById(ROOT_ID)?.remove();
    return;
  }

  const mountPoint = getMountPoint();
  if (!mountPoint) {
    return;
  }

  ensureStyle();
  registerCommands(context);

  let root = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
  }

  root.replaceChildren();

  const visibleCount = getVisibleCount();
  const activeTab = getActiveTab(context);
  const fragment = document.createDocumentFragment();

  for (const tab of context.settings.splitTabs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'simply-mail-split-inbox-button';

    const active = activeTab?.id === tab.id;
    if (active) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }

    button.title = `Open mail search: ${tab.query}`;

    const label = document.createElement('span');
    label.textContent = tab.label;
    button.appendChild(label);

    if (context.settings.splitInboxSettings.showCounts) {
      const count = document.createElement('span');
      count.className = 'simply-mail-split-inbox-count';
      if (active) {
        count.textContent = String(visibleCount);
        count.title = `Current view shows ${formatConversationCount(visibleCount)}`;
      } else {
        count.classList.add('is-estimate');
        count.textContent = '—';
        count.title = 'Count appears after you open this tab';
      }
      button.appendChild(count);
    }

    button.setAttribute(
      'aria-label',
      active
        ? `${tab.label}, current tab, ${formatConversationCount(visibleCount)} visible`
        : `${tab.label}, opens mail search ${tab.query}`,
    );

    button.addEventListener('click', () => {
      window.location.hash = hashForQuery(tab.query);
    });
    fragment.appendChild(button);
  }

  const summary = document.createElement('div');
  summary.className = 'simply-mail-split-inbox-summary';

  const summaryLead = document.createElement('span');
  const summaryStrong = document.createElement('strong');
  summaryStrong.textContent = activeTab?.label ?? 'Split Inbox';
  summaryLead.appendChild(summaryStrong);
  summaryLead.appendChild(
    document.createTextNode(
      activeTab
        ? ` shows ${formatConversationCount(visibleCount)} in the current email app list.`
        : ' opens focused mail searches.',
    ),
  );
  summary.appendChild(summaryLead);

  const hint = document.createElement('span');
  hint.className = 'simply-mail-split-inbox-hint';
  hint.textContent = 'Only the active tab shows a real count. Open another tab to load and count it.';
  summary.appendChild(hint);

  fragment.appendChild(summary);

  // Show empty state when active tab has zero results
  if (activeTab && visibleCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'simply-mail-split-inbox-empty';
    empty.textContent = 'No messages match this view';
    fragment.appendChild(empty);
  }

  root.appendChild(fragment);

  mountPoint.prepend(root);
}

export function createSplitInboxModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];

  return {
    name: 'splitInbox',
    init(context) {
      render(context);
      unsubscribers = [
        context.observer.on('view-changed', () => render(context)),
        context.observer.on('inbox-updated', () => render(context)),
      ];
    },
    destroy() {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      render(context);
    },
  };
}

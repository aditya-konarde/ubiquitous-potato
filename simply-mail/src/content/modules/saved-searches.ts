import type { ModuleContext, SimplyMailModule } from '@/shared/types';
import { hashForQuery } from './dom-utils';

const ROOT_ID = 'simply-mail-saved-searches';
const STYLE_ID = `${ROOT_ID}-style`;

function getSidebar(): HTMLElement | null {
  const sidebar = document.querySelector('[role="navigation"]');
  return sidebar instanceof HTMLElement ? sidebar : null;
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        margin: 16px 8px 0;
        padding: 12px;
        border-radius: 0;
        border: 1px solid #e4e4e7;
        background: #ffffff;
        box-shadow: none;
      }
      #${ROOT_ID} .simply-mail-saved-searches-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      #${ROOT_ID} .simply-mail-saved-searches-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #52525b;
      }
      #${ROOT_ID} .simply-mail-saved-searches-caption {
        font-size: 11px;
        color: #a1a1aa;
      }
      #${ROOT_ID} .simply-mail-saved-searches-list {
        display: grid;
        gap: 4px;
      }
      #${ROOT_ID} .simply-mail-saved-search {
        display: grid;
        gap: 2px;
        width: 100%;
        padding: 8px;
        border-radius: 0;
        border: 1px solid transparent;
        background: transparent;
        color: #000000;
        text-align: left;
        cursor: pointer;
      }
      #${ROOT_ID} .simply-mail-saved-search:hover {
        background: #f4f4f5;
      }
      #${ROOT_ID} .simply-mail-saved-search.is-active {
        background: #000000;
        color: #ffffff;
      }
      #${ROOT_ID} .simply-mail-saved-search-label {
        font-size: 13px;
        font-weight: 500;
      }
      #${ROOT_ID} .simply-mail-saved-search-query {
        font-size: 11px;
        color: #52525b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${ROOT_ID} .simply-mail-saved-search.is-active .simply-mail-saved-search-query {
        color: #a1a1aa;
      }
      #${ROOT_ID} .simply-mail-saved-searches-empty {
        padding: 8px 0;
        font-size: 12px;
        color: #a1a1aa;
        text-align: center;
      }
      html.simply-mail-dark-mode #${ROOT_ID} {
        border-color: #27272a;
        background: #0a0a0a;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-searches-title {
        color: #a1a1aa;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-searches-caption,
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-search-query {
        color: #52525b;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-search {
        color: #ffffff;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-search:hover {
        background: #111111;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-search.is-active {
        background: #ffffff;
        color: #000000;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-search.is-active .simply-mail-saved-search-query {
        color: #52525b;
      }
      html.simply-mail-dark-mode #${ROOT_ID} .simply-mail-saved-searches-empty {
        color: #52525b;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

function render(context: ModuleContext) {
  if (!context.settings.savedSearches.showInSidebar) {
    document.getElementById(ROOT_ID)?.remove();
    return;
  }

  const sidebar = getSidebar();
  if (!sidebar) {
    return;
  }

  ensureStyle();

  let root = document.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
  }

  root.replaceChildren();

  const header = document.createElement('div');
  header.className = 'simply-mail-saved-searches-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'simply-mail-saved-searches-title';
  title.textContent = 'Saved searches';
  const caption = document.createElement('div');
  caption.className = 'simply-mail-saved-searches-caption';
  caption.textContent = 'One-click focus views';
  titleWrap.append(title, caption);
  header.append(titleWrap);

  const list = document.createElement('div');
  list.className = 'simply-mail-saved-searches-list';

  for (const search of context.settings.savedSearchesList) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'simply-mail-saved-search';
    button.setAttribute('aria-label', `Search: ${search.label}`);
    const targetHash = hashForQuery(search.query);
    if (window.location.hash === targetHash) {
      button.classList.add('is-active');
    }

    const label = document.createElement('span');
    label.className = 'simply-mail-saved-search-label';
    label.textContent = search.label;

    const query = document.createElement('span');
    query.className = 'simply-mail-saved-search-query';
    query.textContent = search.query;

    button.append(label, query);
    button.addEventListener('click', () => {
      window.location.hash = targetHash;
    });
    list.appendChild(button);
  }

  // Show empty state when no saved searches are configured
  if (context.settings.savedSearchesList.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'simply-mail-saved-searches-empty';
    empty.textContent = 'No results';
    list.appendChild(empty);
  }

  root.append(header, list);
  sidebar.appendChild(root);
}

export function createSavedSearchesModule(): SimplyMailModule {
  let unsubscribe: (() => void) | null = null;

  return {
    name: 'savedSearches',
    init(context) {
      render(context);
      unsubscribe = context.observer.on('view-changed', () => render(context));
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = null;
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(STYLE_ID)?.remove();
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      render(context);
    },
  };
}

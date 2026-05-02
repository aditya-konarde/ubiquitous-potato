import type { MailView, ModuleContext, SimplyMailModule } from '@/shared/types';

const HEADER_CLASS = 'simply-mail-date-header';
const HEADER_CELL_CLASS = 'simply-mail-date-header-cell';
const HEADER_FLUSH_CLASS = 'simply-mail-date-header-flush';
const GROUP_START_ROW_CLASS = 'simply-mail-date-group-start';
const STYLE_ID = 'simply-mail-group-by-date-style';
const DATE_ATTR = 'data-sm-date-group';
const SUPPORTED_VIEWS = new Set<MailView>(['inbox', 'search', 'label']);

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Earlier';

const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier'];

function extractRowDate(row: Element): Date | null {
  const timeEl = row.querySelector('time[datetime]');
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime');
    if (dt) {
      const parsed = new Date(dt);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  const spansWithTitle = Array.from(row.querySelectorAll('span[title]'));
  for (const span of spansWithTitle) {
    const title = span.getAttribute('title') ?? '';
    const parsed = new Date(title);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function getDateGroup(date: Date, now: Date): DateGroup {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const emailDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (emailDay.getTime() >= today.getTime()) return 'Today';
  if (emailDay.getTime() >= yesterday.getTime()) return 'Yesterday';
  if (emailDay.getTime() >= weekAgo.getTime()) return 'This Week';
  return 'Earlier';
}

function ensureStyle() {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style) return;

  style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${HEADER_CLASS} {
      background: transparent !important;
    }
    .${HEADER_CELL_CLASS} {
      position: sticky;
      top: 0;
      z-index: 5;
      padding: 8px 16px !important;
      background: #f4f4f5 !important;
      border-top: 1px solid #e4e4e7 !important;
      border-bottom: none !important;
      color: #52525b !important;
    }
    .${HEADER_CLASS}.${HEADER_FLUSH_CLASS} .${HEADER_CELL_CLASS} {
      border-top: none !important;
    }
    tr[role="row"].${GROUP_START_ROW_CLASS} td {
      border-top: none !important;
    }
    .${HEADER_CELL_CLASS} > div {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      user-select: none;
    }
    .${HEADER_CLASS} .simply-mail-date-label {
      flex: 1;
    }
    .${HEADER_CLASS} .simply-mail-date-note {
      padding: 4px 8px;
      border: 1px solid #e4e4e7;
      color: #71717a;
      font-size: 11px;
      font-weight: 600;
      text-transform: none;
      background: #ffffff;
    }
    html.simply-mail-dark-mode .${HEADER_CELL_CLASS} {
      background: #111111 !important;
      border-top-color: #27272a !important;
      color: #a1a1aa !important;
    }
    html.simply-mail-dark-mode .${HEADER_CLASS} .simply-mail-date-note {
      border-color: #27272a;
      color: #a1a1aa;
      background: #0a0a0a;
    }
  `;
  document.documentElement.appendChild(style);
}

function removeStyle() {
  document.getElementById(STYLE_ID)?.remove();
}

function removeAllHeaders() {
  document.querySelectorAll(`.${HEADER_CLASS}`).forEach((el) => el.remove());
}

function removeGroupStartMarkers() {
  document.querySelectorAll(`tr[role="row"].${GROUP_START_ROW_CLASS}`).forEach((row) => row.classList.remove(GROUP_START_ROW_CLASS));
}

function getColSpanForRow(row: Element): number {
  if (!(row instanceof HTMLTableRowElement)) {
    return 1;
  }
  return Math.max(row.cells.length, row.children.length, 1);
}

function getLiveRows(): Element[] {
  return Array.from(document.querySelectorAll('tr[role="row"], [role="main"] table[role="grid"] tr')).filter((row) => {
    if (!(row instanceof Element)) {
      return false;
    }
    if (row.classList.contains(HEADER_CLASS)) {
      return false;
    }
    return row.getAttribute('role') === 'row';
  });
}

function hasLiveRowBefore(row: Element): boolean {
  let previous = row.previousElementSibling;

  while (previous) {
    if (previous.classList.contains(HEADER_CLASS)) {
      previous = previous.previousElementSibling;
      continue;
    }

    return previous.getAttribute('role') === 'row';
  }

  return false;
}

function createHeader(group: DateGroup, referenceRow: Element, flushTop = false): HTMLElement {
  const isTableRow = referenceRow instanceof HTMLTableRowElement;

  if (isTableRow) {
    const headerRow = document.createElement('tr');
    headerRow.className = HEADER_CLASS;
    if (flushTop) {
      headerRow.classList.add(HEADER_FLUSH_CLASS);
    }
    headerRow.setAttribute(DATE_ATTR, group);
    headerRow.setAttribute('role', 'presentation');

    const cell = document.createElement('td');
    cell.className = HEADER_CELL_CLASS;
    cell.colSpan = getColSpanForRow(referenceRow);

    const content = document.createElement('div');

    const label = document.createElement('span');
    label.className = 'simply-mail-date-label';
    label.textContent = group;
    content.appendChild(label);

    cell.appendChild(content);
    headerRow.appendChild(cell);
    return headerRow;
  }

  const header = document.createElement('div');
  header.className = HEADER_CLASS;
  if (flushTop) {
    header.classList.add(HEADER_FLUSH_CLASS);
  }
  header.setAttribute(DATE_ATTR, group);

  const label = document.createElement('span');
  label.className = 'simply-mail-date-label';
  label.textContent = group;
  header.appendChild(label);

  return header;
}

export function createGroupByDateModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];
  let currentContext: ModuleContext | null = null;
  let lastRenderKey = '';

  const dateGroupCache = new Map<string, DateGroup>();

  function isSupportedView(): boolean {
    return currentContext ? SUPPORTED_VIEWS.has(currentContext.observer.getCurrentView()) : false;
  }

  function getCachedDateGroup(dateStr: string, now: Date): DateGroup {
    const cached = dateGroupCache.get(dateStr);
    if (cached !== undefined) return cached;

    const date = new Date(dateStr);
    const group: DateGroup = isNaN(date.getTime()) ? 'Earlier' : getDateGroup(date, now);
    dateGroupCache.set(dateStr, group);
    return group;
  }

  function extractDateString(row: Element): string | null {
    const timeEl = row.querySelector('time[datetime]');
    if (timeEl) {
      const dt = timeEl.getAttribute('datetime');
      if (dt) return dt;
    }
    const span = row.querySelector('span[title]');
    if (span) {
      return span.getAttribute('title');
    }
    return null;
  }

  function buildRenderKey(rows: Element[]): string {
    const view = currentContext?.observer.getCurrentView() ?? 'unknown';
    const signature = rows
      .map((row) => {
        const id = row.getAttribute('data-legacy-thread-id') ?? row.getAttribute('data-thread-id') ?? row.getAttribute('aria-label') ?? row.textContent?.slice(0, 80) ?? '';
        return `${id}:${extractDateString(row) ?? 'nodate'}`;
      })
      .join('|');
    return `${view}|${signature}`;
  }

  function groupRows(rows: Element[]) {
    if (!currentContext) return;

    const liveRows = rows.filter((row) => row instanceof Element && row.getAttribute('role') === 'row' && !row.classList.contains(HEADER_CLASS));

    if (!isSupportedView()) {
      lastRenderKey = '';
      removeAllHeaders();
      removeGroupStartMarkers();
      return;
    }

    if (liveRows.length === 0) {
      lastRenderKey = '';
      removeAllHeaders();
      removeGroupStartMarkers();
      return;
    }

    const renderKey = buildRenderKey(liveRows);
    if (renderKey === lastRenderKey) {
      return;
    }

    removeAllHeaders();
    removeGroupStartMarkers();

    const now = new Date();
    const groups = new Map<DateGroup, Element[]>();

    for (const g of GROUP_ORDER) {
      groups.set(g, []);
    }

    for (const row of liveRows) {
      const dateStr = extractDateString(row);
      const group: DateGroup = dateStr ? getCachedDateGroup(dateStr, now) : 'Earlier';
      const groupRows = groups.get(group);
      if (groupRows) groupRows.push(row);
    }

    for (const group of GROUP_ORDER) {
      const groupedRows = groups.get(group);
      if (!groupedRows || groupedRows.length === 0) continue;

      const firstRow = groupedRows[0];
      if (firstRow instanceof HTMLTableRowElement) {
        firstRow.classList.add(GROUP_START_ROW_CLASS);
      }
      const header = createHeader(group, firstRow, !hasLiveRowBefore(firstRow));
      firstRow.parentNode?.insertBefore(header, firstRow);
    }

    lastRenderKey = renderKey;
  }

  function refreshFromDom() {
    groupRows(getLiveRows());
  }

  function handleInboxUpdated(payload: { rows: Element[] }) {
    groupRows(payload.rows);
  }

  function handleViewChanged() {
    lastRenderKey = '';
    removeAllHeaders();
    removeGroupStartMarkers();
    refreshFromDom();
  }

  return {
    name: 'groupByDate',

    init(context: ModuleContext) {
      currentContext = context;
      ensureStyle();

      unsubscribers = [
        context.observer.on('inbox-updated', handleInboxUpdated),
        context.observer.on('view-changed', handleViewChanged),
      ];
    },

    destroy() {
      unsubscribers.forEach((unsub) => unsub());
      unsubscribers = [];
      dateGroupCache.clear();
      lastRenderKey = '';
      removeAllHeaders();
      removeGroupStartMarkers();
      removeStyle();
      currentContext = null;
    },

    onSettingsChange(settings, context) {
      currentContext = context;
      context.settings = settings;
      lastRenderKey = '';
      refreshFromDom();
    },
  };
}

export {
  extractRowDate,
  getDateGroup,
  DATE_ATTR,
  HEADER_CLASS,
  HEADER_CELL_CLASS,
  HEADER_FLUSH_CLASS,
  GROUP_ORDER,
  GROUP_START_ROW_CLASS,
};

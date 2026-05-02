import {
  createGroupByDateModule,
  extractRowDate,
  getDateGroup,
  DATE_ATTR,
  HEADER_CLASS,
  HEADER_CELL_CLASS,
  HEADER_FLUSH_CLASS,
  GROUP_START_ROW_CLASS,
} from '@/content/modules/group-by-date';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Partial<ModuleContext['settings']>): ModuleContext {
  const settings = structuredClone(DEFAULT_SETTINGS);
  if (overrides) {
    Object.assign(settings, overrides);
  }
  return {
    observer: {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentView: vi.fn<() => MailView>(() => 'inbox'),
      on: vi.fn(() => () => undefined),
    },
    settings,
    storage: {
      getSettings: vi.fn(async () => DEFAULT_SETTINGS),
      setSettings: vi.fn(async () => undefined),
      patchSettings: vi.fn(async () => DEFAULT_SETTINGS),
      getSnoozedItems: vi.fn(async () => []),
      setSnoozedItems: vi.fn(async () => undefined),
      getReminderItems: vi.fn(async () => []),
      setReminderItems: vi.fn(async () => undefined),
      getStats: vi.fn(async () => ({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 })),
      setStats: vi.fn(async () => undefined),
      onSettingsChanged: vi.fn(() => () => undefined),
    },
    commandPalette: {
      registerCommands: vi.fn(),
      unregisterCommands: vi.fn(),
    },
  };
}

function setupInboxTable(): HTMLTableSectionElement {
  document.body.innerHTML = `
    <main role="main">
      <table role="grid">
        <tbody></tbody>
      </table>
    </main>
  `;
  return document.querySelector('tbody')!;
}

function createRow(dateString: string, id: string, columns = 3): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.setAttribute('role', 'row');
  row.setAttribute('data-thread-id', id);

  for (let index = 0; index < columns - 1; index += 1) {
    const cell = document.createElement('td');
    cell.textContent = `Cell ${index + 1}`;
    row.appendChild(cell);
  }

  const dateCell = document.createElement('td');
  const dateSpan = document.createElement('span');
  dateSpan.setAttribute('title', dateString);
  dateSpan.textContent = dateString.split(',')[0];
  dateCell.appendChild(dateSpan);
  row.appendChild(dateCell);

  return row;
}

describe('createGroupByDateModule', () => {
  let tbody: HTMLTableSectionElement;

  beforeEach(() => {
    tbody = setupInboxTable();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.getElementById('simply-mail-group-by-date-style')?.remove();
    document.getElementById('simply-mail-ui-cleanup')?.remove();
  });

  it('has the correct module name', () => {
    const module = createGroupByDateModule();
    expect(module.name).toBe('groupByDate');
  });

  it('registers inbox-updated and view-changed listeners on init', () => {
    const module = createGroupByDateModule();
    const context = createContext();

    module.init(context);

    expect(context.observer.on).toHaveBeenCalledWith('inbox-updated', expect.any(Function));
    expect(context.observer.on).toHaveBeenCalledWith('view-changed', expect.any(Function));

    module.destroy();
  });

  it('cleans up headers and style on destroy', () => {
    const module = createGroupByDateModule();
    const context = createContext();
    module.init(context);

    const header = document.createElement('tr');
    header.className = HEADER_CLASS;
    tbody.appendChild(header);

    expect(document.querySelector(`.${HEADER_CLASS}`)).not.toBeNull();

    module.destroy();

    expect(document.querySelector(`.${HEADER_CLASS}`)).toBeNull();
    expect(document.getElementById('simply-mail-group-by-date-style')).toBeNull();
  });

  it('groups rows and injects date headers into the table body', () => {
    const module = createGroupByDateModule();
    const context = createContext();
    module.init(context);

    const now = new Date();
    const todayStr = now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const yesterdayStr = new Date(now.getTime() - 86400000).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const olderStr = new Date(now.getTime() - 14 * 86400000).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    const row1 = createRow(todayStr, 'thread-1');
    const row2 = createRow(todayStr, 'thread-2');
    const row3 = createRow(yesterdayStr, 'thread-3');
    const row4 = createRow(olderStr, 'thread-4');

    tbody.append(row1, row2, row3, row4);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [row1, row2, row3, row4] });

    const headers = document.querySelectorAll(`.${HEADER_CLASS}`);
    const headerLabels = Array.from(headers).map((h) => h.getAttribute(DATE_ATTR));

    expect(headerLabels).toContain('Today');
    expect(headerLabels).toContain('Yesterday');
    expect(headerLabels).toContain('Earlier');

    const todayHeader = document.querySelector(`.${HEADER_CLASS}[${DATE_ATTR}="Today"]`);
    expect(todayHeader?.nextElementSibling).toBe(row1);
    expect(todayHeader?.parentElement).toBe(tbody);

    module.destroy();
  });

  it('creates table-safe header rows with a spanning cell', () => {
    const module = createGroupByDateModule();
    const context = createContext({ groupByDate: { enabled: true } });
    module.init(context);

    const row = createRow(new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-1', 4);
    tbody.appendChild(row);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [row] });

    const header = document.querySelector(`.${HEADER_CLASS}[${DATE_ATTR}="Today"]`) as HTMLTableRowElement | null;
    expect(header?.tagName).toBe('TR');
    const cell = header?.querySelector(`.${HEADER_CELL_CLASS}`) as HTMLTableCellElement | null;
    expect(cell).not.toBeNull();
    expect(cell?.colSpan).toBe(4);
    expect(header?.querySelector('.simply-mail-date-note')).toBeNull();
    expect(header?.querySelector('button')).toBeNull();

    module.destroy();
  });

  it('omits the extra top divider only for the first date header', () => {
    const module = createGroupByDateModule();
    const context = createContext({ groupByDate: { enabled: true } });
    module.init(context);

    const now = new Date();
    const todayRow = createRow(
      now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      'thread-today',
    );
    const yesterdayRow = createRow(
      new Date(now.getTime() - 86400000).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      'thread-yesterday',
    );

    tbody.append(todayRow, yesterdayRow);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [todayRow, yesterdayRow] });

    const todayHeader = document.querySelector(`.${HEADER_CLASS}[${DATE_ATTR}="Today"]`);
    const yesterdayHeader = document.querySelector(`.${HEADER_CLASS}[${DATE_ATTR}="Yesterday"]`);

    expect(todayHeader?.classList.contains(HEADER_FLUSH_CLASS)).toBe(true);
    expect(yesterdayHeader?.classList.contains(HEADER_FLUSH_CLASS)).toBe(false);

    module.destroy();
  });

  it('marks the first row in each date group so its top border can be suppressed', () => {
    const module = createGroupByDateModule();
    const context = createContext({ groupByDate: { enabled: true } });
    module.init(context);

    const now = new Date();
    const todayRow = createRow(
      now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      'thread-today-1',
    );
    const todayRow2 = createRow(
      now.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      'thread-today-2',
    );
    const yesterdayRow = createRow(
      new Date(now.getTime() - 86400000).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      'thread-yesterday-1',
    );

    tbody.append(todayRow, todayRow2, yesterdayRow);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [todayRow, todayRow2, yesterdayRow] });

    expect(todayRow.classList.contains(GROUP_START_ROW_CLASS)).toBe(true);
    expect(todayRow2.classList.contains(GROUP_START_ROW_CLASS)).toBe(false);
    expect(yesterdayRow.classList.contains(GROUP_START_ROW_CLASS)).toBe(true);

    module.destroy();
    expect(todayRow.classList.contains(GROUP_START_ROW_CLASS)).toBe(false);
    expect(yesterdayRow.classList.contains(GROUP_START_ROW_CLASS)).toBe(false);
  });

  it('re-renders headers cleanly when settings change', () => {
    const module = createGroupByDateModule();
    const context = createContext({ groupByDate: { enabled: true } });
    module.init(context);

    const row = createRow(new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-1');
    tbody.appendChild(row);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [row] });
    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);

    const newSettings = structuredClone(context.settings);
    newSettings.groupByDate.enabled = true;
    module.onSettingsChange!(newSettings, context);

    expect(document.querySelector('.simply-mail-date-note')).toBeNull();
    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);

    module.destroy();
  });

  it('survives UI cleanup styling and keeps header rows inside the grid', () => {
    const module = createGroupByDateModule();
    const context = createContext({
      uiCleanup: { ...DEFAULT_SETTINGS.uiCleanup, enabled: true },
      groupByDate: { enabled: true },
    });
    module.init(context);

    const cleanupStyle = document.createElement('style');
    cleanupStyle.id = 'simply-mail-ui-cleanup';
    cleanupStyle.textContent = `
      tr[role="row"] td {
        border-top: 1px solid #e4e4e7 !important;
        border-bottom: none !important;
      }
      tr[role="row"]:hover {
        background: #f8fafc !important;
      }
    `;
    document.head.appendChild(cleanupStyle);

    const row1 = createRow(new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-1');
    const row2 = createRow(new Date(Date.now() - 86400000).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-2');
    tbody.append(row1, row2);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [row1, row2] });

    const headers = Array.from(document.querySelectorAll(`.${HEADER_CLASS}`));
    expect(headers.length).toBeGreaterThan(0);
    expect(headers.every((header) => header.tagName === 'TR')).toBe(true);
    expect(headers.every((header) => header.parentElement === tbody)).toBe(true);

    module.destroy();
  });

  it('cleans up headers on unsupported view changes and restores them when inbox rows return', () => {
    const module = createGroupByDateModule();
    const context = createContext();
    module.init(context);

    const row = createRow(new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-1');
    tbody.appendChild(row);

    const onCalls = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls;
    const inboxUpdatedHandler = onCalls.find((call) => call[0] === 'inbox-updated')?.[1] as ((payload: { rows: Element[] }) => void);
    const viewChangedHandler = onCalls.find((call) => call[0] === 'view-changed')?.[1] as ((payload: { view: MailView; hash: string }) => void);

    inboxUpdatedHandler({ rows: [row] });
    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);

    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('thread');
    viewChangedHandler({ view: 'thread', hash: '#inbox/thread-1' });
    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(0);

    (context.observer.getCurrentView as ReturnType<typeof vi.fn>).mockReturnValue('inbox');
    viewChangedHandler({ view: 'inbox', hash: '#inbox' });
    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);

    module.destroy();
  });

  it('ignores previously injected header rows during settings refresh', () => {
    const module = createGroupByDateModule();
    const context = createContext({ groupByDate: { enabled: true } });
    module.init(context);

    const row = createRow(new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-1');
    tbody.appendChild(row);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls.find((call) => call[0] === 'inbox-updated')?.[1] as ((payload: { rows: Element[] }) => void);
    inboxUpdatedHandler({ rows: [row] });
    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);

    module.onSettingsChange?.({
      ...context.settings,
      groupByDate: { ...context.settings.groupByDate },
    }, context);

    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);
    expect(document.querySelector(`.${HEADER_CLASS}`)?.nextElementSibling).toBe(row);

    module.destroy();
  });

  it('removes stale headers before re-rendering', () => {
    const module = createGroupByDateModule();
    const context = createContext();
    module.init(context);

    const row = createRow(new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), 'thread-1');
    tbody.appendChild(row);

    const inboxUpdatedHandler = (context.observer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    inboxUpdatedHandler({ rows: [row] });
    inboxUpdatedHandler({ rows: [row] });

    expect(document.querySelectorAll(`.${HEADER_CLASS}`)).toHaveLength(1);

    module.destroy();
  });
});

describe('getDateGroup', () => {
  it('classifies today as Today', () => {
    const now = new Date();
    expect(getDateGroup(now, now)).toBe('Today');
  });

  it('classifies yesterday as Yesterday', () => {
    const now = new Date();
    expect(getDateGroup(new Date(now.getTime() - 86400000), now)).toBe('Yesterday');
  });

  it('classifies 3 days ago as This Week', () => {
    const now = new Date();
    expect(getDateGroup(new Date(now.getTime() - 3 * 86400000), now)).toBe('This Week');
  });

  it('classifies older dates as Earlier', () => {
    const now = new Date();
    expect(getDateGroup(new Date(now.getTime() - 10 * 86400000), now)).toBe('Earlier');
  });
});

describe('extractRowDate', () => {
  it('extracts date from a time[datetime] element', () => {
    const row = document.createElement('tr');
    const time = document.createElement('time');
    time.setAttribute('datetime', '2026-04-08T22:19:00');
    row.appendChild(time);

    expect(extractRowDate(row)?.getFullYear()).toBe(2026);
  });

  it('extracts date from a span[title] element', () => {
    const row = document.createElement('tr');
    const span = document.createElement('span');
    span.setAttribute('title', 'Apr 8, 2026, 10:19 PM');
    row.appendChild(span);

    expect(extractRowDate(row)?.getFullYear()).toBe(2026);
  });

  it('returns null when no date is found', () => {
    const row = document.createElement('tr');
    row.textContent = 'No date info here';
    expect(extractRowDate(row)).toBeNull();
  });
});

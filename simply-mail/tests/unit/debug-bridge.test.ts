import { DEFAULT_SETTINGS } from '@/shared/constants';
import {
  collectDateGroupDebugSnapshot,
  DEBUG_REQUEST_EVENT,
  DEBUG_RESPONSE_EVENT,
  installDebugBridge,
} from '@/content/debug-bridge';

function setupDebugDom(): void {
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <main role="main">
      <table role="grid">
        <tbody>
          <tr class="simply-mail-date-header simply-mail-date-header-flush" data-sm-date-group="Today" role="presentation">
            <td class="simply-mail-date-header-cell" style="border-top: none; border-bottom: none; background: rgb(244, 244, 245);">
              <div><span class="simply-mail-date-label">Today</span></div>
            </td>
          </tr>
          <tr role="row" class="simply-mail-date-group-start" data-thread-id="thread-1">
            <td style="border-top: none; box-shadow: inset 0 1px 0 rgb(0, 0, 0);">First row</td>
          </tr>
          <tr class="simply-mail-date-header" data-sm-date-group="Yesterday" role="presentation">
            <td class="simply-mail-date-header-cell"><div><span class="simply-mail-date-label">Yesterday</span></div></td>
          </tr>
          <tr role="row" data-thread-id="thread-2">
            <td>Second row</td>
          </tr>
        </tbody>
      </table>
    </main>
  `;

  const groupStyle = document.createElement('style');
  groupStyle.id = 'simply-mail-group-by-date-style';
  document.head.appendChild(groupStyle);

  const cleanupStyle = document.createElement('style');
  cleanupStyle.id = 'simply-mail-ui-cleanup';
  document.head.appendChild(cleanupStyle);
}

describe('debug bridge', () => {
  beforeEach(() => {
    setupDebugDom();
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('collects date-group debug details from the live DOM', () => {
    const testSettings = { ...DEFAULT_SETTINGS, groupByDate: { ...DEFAULT_SETTINGS.groupByDate, enabled: true } };
    const snapshot = collectDateGroupDebugSnapshot({
      currentView: 'inbox',
      settings: testSettings,
      activeModules: ['groupByDate', 'uiCleanup'],
    });

    expect(snapshot.currentView).toBe('inbox');
    expect(snapshot.activeModules).toEqual(['groupByDate', 'uiCleanup']);
    expect(snapshot.settings.groupByDateEnabled).toBe(true);
    expect(snapshot.counts.headers).toBe(2);
    expect(snapshot.counts.liveRows).toBe(2);
    expect(snapshot.counts.groupStartRows).toBe(1);
    expect(snapshot.stylesPresent.groupByDateStyle).toBe(true);
    expect(snapshot.stylesPresent.uiCleanupStyle).toBe(true);
    expect(snapshot.headers.map((header) => header.dateGroup)).toEqual(['Today', 'Yesterday']);
    expect(snapshot.firstHeader?.dateGroup).toBe('Today');
    expect(snapshot.firstRowAfterHeader?.className).toContain('simply-mail-date-group-start');
  });

  it('responds to page debug requests with a snapshot payload', async () => {
    const cleanup = installDebugBridge(() => ({
      currentView: 'inbox',
      settings: DEFAULT_SETTINGS,
      activeModules: ['groupByDate'],
    }));

    const response = await new Promise<CustomEvent>((resolve) => {
      const requestId = 'req-1';
      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.requestId !== requestId) return;
        document.removeEventListener(DEBUG_RESPONSE_EVENT, handler);
        resolve(customEvent);
      };

      document.addEventListener(DEBUG_RESPONSE_EVENT, handler);
      document.dispatchEvent(new CustomEvent(DEBUG_REQUEST_EVENT, {
        detail: {
          requestId,
          type: 'inspect-date-groups',
        },
      }));
    });

    cleanup();

    expect(response.detail.ok).toBe(true);
    expect(response.detail.payload.counts.headers).toBe(2);
    expect(response.detail.payload.firstHeader.dateGroup).toBe('Today');
  });
});

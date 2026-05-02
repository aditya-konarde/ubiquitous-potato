import type { MailView, SimplyMailSettings } from '@/shared/types';
import { MAIL_SELECTORS } from './mail-selectors';
import { DATE_ATTR, GROUP_START_ROW_CLASS, HEADER_CLASS, HEADER_CELL_CLASS } from './modules/group-by-date';

export const DEBUG_REQUEST_EVENT = 'simply-mail:debug-request';
export const DEBUG_RESPONSE_EVENT = 'simply-mail:debug-response';

const MAX_HTML_LENGTH = 1600;
const MAX_TEXT_LENGTH = 240;

export interface DebugStyleSnapshot {
  borderTop: string;
  borderBottom: string;
  boxShadow: string;
  outline: string;
  backgroundColor: string;
  display: string;
  position: string;
  beforeContent: string;
  afterContent: string;
}

export interface DebugElementSnapshot {
  tagName: string;
  className: string;
  text: string;
  html: string;
  dateGroup: string | null;
  styles: DebugStyleSnapshot;
}

export interface DateGroupDebugSnapshot {
  requestedAt: string;
  locationHref: string;
  locationHash: string;
  currentView: MailView;
  activeModules: string[];
  settings: {
    groupByDateEnabled: boolean;
    smartActionsEnabled: boolean;
    uiCleanupEnabled: boolean;
  };
  counts: {
    liveRows: number;
    headers: number;
    groupStartRows: number;
  };
  stylesPresent: {
    groupByDateStyle: boolean;
    uiCleanupStyle: boolean;
    smartActionsStyle: boolean;
  };
  headers: DebugElementSnapshot[];
  firstHeader: DebugElementSnapshot | null;
  firstHeaderCell: DebugElementSnapshot | null;
  firstRowAfterHeader: DebugElementSnapshot | null;
  firstCellAfterHeader: DebugElementSnapshot | null;
}

interface DebugState {
  currentView: MailView;
  settings: SimplyMailSettings;
  activeModules: string[];
}

interface DebugRequest {
  requestId: string;
  type: 'inspect-date-groups';
}

interface DebugSuccessResponse {
  requestId: string;
  type: 'inspect-date-groups';
  ok: true;
  payload: DateGroupDebugSnapshot;
}

interface DebugErrorResponse {
  requestId: string;
  type: 'inspect-date-groups';
  ok: false;
  error: string;
}

type DebugResponse = DebugSuccessResponse | DebugErrorResponse;

function trimText(value: string | null | undefined, limit: number): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1)}…`;
}

function trimHtml(element: Element | null): string {
  if (!element) return '';

  const html = element.outerHTML.replace(/\s+/g, ' ').trim();
  if (html.length <= MAX_HTML_LENGTH) {
    return html;
  }

  return `${html.slice(0, MAX_HTML_LENGTH - 1)}…`;
}

function getStyleSnapshot(element: Element | null): DebugStyleSnapshot {
  if (!element) {
    return {
      borderTop: '',
      borderBottom: '',
      boxShadow: '',
      outline: '',
      backgroundColor: '',
      display: '',
      position: '',
      beforeContent: '',
      afterContent: '',
    };
  }

  const computed = getComputedStyle(element);
  const supportsPseudoComputedStyle = typeof navigator === 'undefined' || !/jsdom/i.test(navigator.userAgent);
  const beforeContent = supportsPseudoComputedStyle ? getComputedStyle(element, '::before').content : '';
  const afterContent = supportsPseudoComputedStyle ? getComputedStyle(element, '::after').content : '';

  return {
    borderTop: computed.borderTop,
    borderBottom: computed.borderBottom,
    boxShadow: computed.boxShadow,
    outline: computed.outline,
    backgroundColor: computed.backgroundColor,
    display: computed.display,
    position: computed.position,
    beforeContent,
    afterContent,
  };
}

function describeElement(element: Element | null): DebugElementSnapshot | null {
  if (!element) return null;

  return {
    tagName: element.tagName,
    className: trimText(element.getAttribute('class'), MAX_TEXT_LENGTH),
    text: trimText(element.textContent, MAX_TEXT_LENGTH),
    html: trimHtml(element),
    dateGroup: element.getAttribute(DATE_ATTR),
    styles: getStyleSnapshot(element),
  };
}

function getFirstCell(row: Element | null): Element | null {
  if (!row) return null;
  return row.querySelector('td');
}

function isDebugRequest(value: unknown): value is DebugRequest {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<DebugRequest>;
  return candidate.type === 'inspect-date-groups' && typeof candidate.requestId === 'string' && candidate.requestId.length > 0;
}

export function collectDateGroupDebugSnapshot(state: DebugState): DateGroupDebugSnapshot {
  const liveRows = Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows)).filter((row) => row.getAttribute('role') === 'row');
  const headers = Array.from(document.querySelectorAll(`.${HEADER_CLASS}, [${DATE_ATTR}]`)).filter((element, index, list) => list.indexOf(element) === index);
  const groupStartRows = liveRows.filter((row) => row.classList.contains(GROUP_START_ROW_CLASS));

  const firstHeader = headers[0] ?? null;
  const firstHeaderCell = firstHeader?.querySelector(`.${HEADER_CELL_CLASS}`) ?? getFirstCell(firstHeader);
  const firstRowAfterHeader = firstHeader?.nextElementSibling ?? null;
  const firstCellAfterHeader = getFirstCell(firstRowAfterHeader);

  return {
    requestedAt: new Date().toISOString(),
    locationHref: window.location.href,
    locationHash: window.location.hash,
    currentView: state.currentView,
    activeModules: [...state.activeModules],
    settings: {
      groupByDateEnabled: state.settings.groupByDate.enabled,
      smartActionsEnabled: state.settings.smartActions.enabled,
      uiCleanupEnabled: state.settings.uiCleanup.enabled,
    },
    counts: {
      liveRows: liveRows.length,
      headers: headers.length,
      groupStartRows: groupStartRows.length,
    },
    stylesPresent: {
      groupByDateStyle: document.getElementById('simply-mail-group-by-date-style') !== null,
      uiCleanupStyle: document.getElementById('simply-mail-ui-cleanup') !== null,
      smartActionsStyle: document.getElementById('simply-mail-smart-actions-style') !== null,
    },
    headers: headers.slice(0, 4).map((header) => describeElement(header)).filter((header): header is DebugElementSnapshot => header !== null),
    firstHeader: describeElement(firstHeader),
    firstHeaderCell: describeElement(firstHeaderCell),
    firstRowAfterHeader: describeElement(firstRowAfterHeader),
    firstCellAfterHeader: describeElement(firstCellAfterHeader),
  };
}

function dispatchDebugResponse(response: DebugResponse): void {
  document.dispatchEvent(new CustomEvent<DebugResponse>(DEBUG_RESPONSE_EVENT, { detail: response }));
}

export function installDebugBridge(getState: () => DebugState): () => void {
  const handleRequest = (event: Event): void => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (!isDebugRequest(detail)) return;

    try {
      dispatchDebugResponse({
        requestId: detail.requestId,
        type: detail.type,
        ok: true,
        payload: collectDateGroupDebugSnapshot(getState()),
      });
    } catch (error) {
      dispatchDebugResponse({
        requestId: detail.requestId,
        type: detail.type,
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown Simply Mail debug bridge error.',
      });
    }
  };

  document.addEventListener(DEBUG_REQUEST_EVENT, handleRequest as EventListener);

  return () => {
    document.removeEventListener(DEBUG_REQUEST_EVENT, handleRequest as EventListener);
  };
}

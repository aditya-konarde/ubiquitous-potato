import { MAIL_SELECTORS } from './mail-selectors';
import { getCurrentView } from './view';
import type { MailObserverEventMap, MailObserverLike } from '@/shared/types';

const DEBOUNCE_MS = 80;

type EventHandler<TEvent extends keyof MailObserverEventMap> = (payload: MailObserverEventMap[TEvent]) => void;

export class MailObserver implements MailObserverLike {
  private mutationObserver: MutationObserver | null = null;
  private timeoutId: number | null = null;
  private currentView = getCurrentView();
  private knownComposeNodes = new Set<Element>();
  private lastThreadNode: Element | null = null;
  private lastRowSignature = '';
  private handlers: { [K in keyof MailObserverEventMap]: Set<EventHandler<K>> } = {
    'view-changed': new Set(),
    'compose-detected': new Set(),
    'thread-detected': new Set(),
    'inbox-updated': new Set(),
  };

  start(): void {
    this.stop();
    this.currentView = getCurrentView();
    this.knownComposeNodes.clear();
    this.lastThreadNode = null;
    this.lastRowSignature = '';
    this.emit('view-changed', { view: this.currentView, hash: window.location.hash });
    this.process();

    this.mutationObserver = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.type === 'childList')) {
        return;
      }

      // Skip mutations outside the mail app root
      const appRoot = document.querySelector(MAIL_SELECTORS.appRoot);
      if (appRoot && !mutations.some((m) => appRoot.contains(m.target))) {
        return;
      }

      if (this.timeoutId !== null) {
        window.clearTimeout(this.timeoutId);
      }
      this.timeoutId = window.setTimeout(() => this.process(), DEBOUNCE_MS);
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener('hashchange', this.handleHashChange);
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;

    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    window.removeEventListener('hashchange', this.handleHashChange);
  }

  getCurrentView() {
    return this.currentView;
  }

  on<TEvent extends keyof MailObserverEventMap>(event: TEvent, handler: EventHandler<TEvent>) {
    const typedHandler = handler as EventHandler<typeof event>;
    this.handlers[event].add(typedHandler);
    return () => {
      this.handlers[event].delete(typedHandler);
    };
  }

  private handleHashChange = () => {
    this.process();
  };

  private process() {
    const view = getCurrentView();
    if (view !== this.currentView) {
      this.currentView = view;
      this.emit('view-changed', { view, hash: window.location.hash });
    }

    const composeNodes = document.querySelectorAll(MAIL_SELECTORS.composeDialog);
    for (const node of composeNodes) {
      if (!this.knownComposeNodes.has(node)) {
        this.knownComposeNodes.add(node);
        this.emit('compose-detected', { node });
      }
    }
    // Prune nodes no longer in the DOM
    for (const node of this.knownComposeNodes) {
      if (!node.isConnected) {
        this.knownComposeNodes.delete(node);
      }
    }

    const threadNode = document.querySelector(MAIL_SELECTORS.threadContainer);
    if (threadNode && threadNode !== this.lastThreadNode) {
      this.lastThreadNode = threadNode;
      this.emit('thread-detected', { node: threadNode });
    } else if (!threadNode) {
      this.lastThreadNode = null;
    }

    const rows = Array.from(document.querySelectorAll(MAIL_SELECTORS.listRows));

    // Build signature from thread IDs only — avoid textContent which forces reflow
    const rowSignature = rows
      .map((row) => row.getAttribute('data-legacy-thread-id') ?? row.getAttribute('data-thread-id') ?? row.getAttribute('aria-label') ?? '')
      .join('|');

    if (rows.length > 0 && rowSignature !== this.lastRowSignature) {
      this.lastRowSignature = rowSignature;
      this.emit('inbox-updated', { rows });
    } else if (rows.length === 0) {
      this.lastRowSignature = '';
    }
  }

  private emit<TEvent extends keyof MailObserverEventMap>(event: TEvent, payload: MailObserverEventMap[TEvent]) {
    for (const handler of this.handlers[event]) {
      handler(payload as never);
    }
  }
}

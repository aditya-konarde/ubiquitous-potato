import type { ModuleContext, SimplyMailModule } from '@/shared/types';
import { analyticsStore } from '@/shared/analytics-store';
import type { WeeklyDigest } from '@/shared/analytics-store';
import { extractSenderFromRow, extractSubjectFromRow } from './row-utils';

const STYLE_ID = 'simply-mail-analytics-style';
const BANNER_ID = 'simply-mail-analytics-banner';

// Session flag — not persisted, resets when the extension context reloads
let bannerDismissed = false;

// --- Banner (exported for testing) ---

export function shouldShowBanner(dismissed: boolean): boolean {
  return !dismissed;
}

export function buildBannerHtml(digest: WeeklyDigest): string {
  return `
    <span class="simply-mail-analytics-title">This week in your inbox</span>
    <span class="simply-mail-analytics-stats">${digest.received} received, ${digest.sent} sent, ${digest.replied} replied</span>
    <button class="simply-mail-analytics-dismiss" aria-label="Dismiss">&times;</button>
  `;
}

// --- CSS ---

function buildCss(): string {
  return `
    .simply-mail-analytics-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--simply-mail-surface, #ffffff);
      border-bottom: 1px solid var(--simply-mail-border, #e4e4e7);
      border-radius: 0;
      padding: 0 16px;
      height: 40px;
      box-sizing: border-box;
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: var(--simply-mail-text-strong, #000000);
      animation: simply-mail-analytics-slide-down 200ms linear forwards;
    }
    html.simply-mail-dark-mode .simply-mail-analytics-banner {
      background: var(--simply-mail-surface, #0a0a0a);
      border-color: #27272a;
      color: #ffffff;
    }
    .simply-mail-analytics-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--simply-mail-text-strong, #000000);
      white-space: nowrap;
    }
    html.simply-mail-dark-mode .simply-mail-analytics-title {
      color: #ffffff;
    }
    .simply-mail-analytics-stats {
      flex: 1;
      font-size: 13px;
      color: var(--simply-mail-text-muted, #52525b);
    }
    html.simply-mail-dark-mode .simply-mail-analytics-stats {
      color: #a1a1aa;
    }
    .simply-mail-analytics-dismiss {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: var(--simply-mail-text-muted, #52525b);
      padding: 4px 6px;
      line-height: 1;
      border-radius: 0;
      flex-shrink: 0;
    }
    .simply-mail-analytics-dismiss:hover {
      background: var(--simply-mail-hover, #f4f4f5);
    }
    html.simply-mail-dark-mode .simply-mail-analytics-dismiss {
      color: #a1a1aa;
    }
    html.simply-mail-dark-mode .simply-mail-analytics-dismiss:hover {
      background: #111111;
    }
    @keyframes simply-mail-analytics-slide-down {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
}

function upsertStyle(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.documentElement.appendChild(style);
  }
  style.textContent = buildCss();
}

// --- Module ---

export function createEmailAnalyticsModule(): SimplyMailModule {
  let context: ModuleContext | null = null;
  let unsubscribeInbox: (() => void) | null = null;
  let unsubscribeCompose: (() => void) | null = null;
  let unsubscribeThread: (() => void) | null = null;
  let unsubscribeViewChange: (() => void) | null = null;
  let isThreadOpen = false;

  // Track recently seen rows to avoid duplicate recording
  const seenRowIds = new WeakSet<Element>();

  async function checkAndShowBanner(): Promise<void> {
    if (!context) return;
    if (bannerDismissed) return;

    try {
      const digest = await analyticsStore.getWeeklyDigest();

      // Only show if there's some activity
      if (digest.received + digest.sent + digest.replied === 0) return;

      showBanner(digest);
    } catch {
      // IndexedDB may not be available; silently skip
    }
  }

  function showBanner(digest: WeeklyDigest): void {
    // Remove any existing banner
    removeBanner();

    upsertStyle();

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'simply-mail-analytics-banner';
    banner.innerHTML = buildBannerHtml(digest);

    // Insert at top of email app main content
    const main = document.querySelector('[role="main"]');
    if (main?.firstElementChild) {
      main.insertBefore(banner, main.firstElementChild);
    } else {
      document.body.prepend(banner);
    }

    // Dismiss button — hides for the rest of the session
    const dismissBtn = banner.querySelector('.simply-mail-analytics-dismiss');
    dismissBtn?.addEventListener('click', () => {
      bannerDismissed = true;
      removeBanner();
    });
  }

  function removeBanner(): void {
    document.getElementById(BANNER_ID)?.remove();
  }

  async function handleInboxUpdated(rows: Element[]): Promise<void> {
    for (const row of rows) {
      if (seenRowIds.has(row)) continue;
      seenRowIds.add(row);

      const sender = extractSenderFromRow(row);
      const subject = extractSubjectFromRow(row);
      if (!sender && !subject) continue;

      try {
        await analyticsStore.recordEvent({
          type: 'received',
          sender,
          subject,
          timestamp: Date.now(),
        });
      } catch {
        // Silently skip on IndexedDB errors
      }
    }
  }

  async function handleComposeDetected(): Promise<void> {
    const eventType = isThreadOpen ? 'replied' : 'sent';
    try {
      await analyticsStore.recordEvent({
        type: eventType,
        sender: 'me',
        subject: '',
        timestamp: Date.now(),
      });
    } catch {
      // Silently skip
    }
  }

  function handleThreadDetected(): void {
    isThreadOpen = true;
  }

  return {
    name: 'emailAnalytics',
    async init(ctx: ModuleContext) {
      context = ctx;

      if (!ctx.settings.emailAnalytics.enabled) return;

      // Initialize the IndexedDB store
      try {
        await analyticsStore.init();
      } catch {
        return;
      }

      // Subscribe to observer events
      unsubscribeInbox = ctx.observer.on('inbox-updated', (payload) => {
        void handleInboxUpdated(payload.rows);
      });

      unsubscribeCompose = ctx.observer.on('compose-detected', () => {
        void handleComposeDetected();
      });

      unsubscribeThread = ctx.observer.on('thread-detected', () => {
        handleThreadDetected();
      });

      // Reset thread state when view changes
      unsubscribeViewChange = ctx.observer.on('view-changed', () => {
        isThreadOpen = false;
      });

      // Check if we should show the weekly digest banner
      void checkAndShowBanner();

      // Run cleanup in background
      void analyticsStore.cleanup(ctx.settings.emailAnalytics.retentionDays);
    },
    destroy() {
      unsubscribeInbox?.();
      unsubscribeCompose?.();
      unsubscribeThread?.();
      unsubscribeViewChange?.();
      removeBanner();
      document.getElementById(STYLE_ID)?.remove();
      isThreadOpen = false;
      context = null;
    },
    onSettingsChange(settings, ctx) {
      if (!settings.emailAnalytics.enabled) {
        this.destroy();
      } else if (!context) {
        // Re-enable after being disabled
        void this.init(ctx);
      }
    },
  };
}

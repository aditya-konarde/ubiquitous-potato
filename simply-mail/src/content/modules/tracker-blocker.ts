import type { ModuleContext, SimplyMailModule, RuntimeStats } from '@/shared/types';

const ROOT_ID = 'simply-mail-tracker-shield';
const STYLE_ID = `${ROOT_ID}-style`;
const TRACKER_ATTR = 'data-simply-mail-tracker';

const FAB_ID = 'simply-mail-tracker-fab';
const FAB_STYLE_ID = `${FAB_ID}-style`;

const KNOWN_TRACKING_DOMAINS = [
  'mailchimp.com',
  'mcsv.net',
  'list-manage.com',
  'campaign-archive.com',
  'hubspot.com',
  'hs-analytics.net',
  'hsleadflows.com',
  'sendgrid.net',
  'sendgrid.com',
  'mixmax.com',
  'streak.com',
  'bananatag.com',
  'yesware.com',
  'mailtrack.io',
  'pixel.mailtracker.io',
  'ci5.googleusercontent.com',
  'sptracking.github.com',
  'mandrillapp.com',
  'postmarkapp.com',
  'mailgun.org',
  'mailgun.com',
  'sparkpostmail.com',
  'sparkpost.com',
  'elasticemail.com',
  'campaignmonitor.com',
  'createsend.com',
  'cmail19.com',
  'cmail20.com',
  'convertkit.com',
  'kit.com',
  'drip.com',
  'getdrip.com',
  'activecampaign.com',
  'ac-email.com',
  'aweber.com',
  'getresponse.com',
  'loopemail.com',
  'customer.io',
  'e.customer.io',
  'intercom.com',
  'intercom-mail.com',
  'amplitude.com',
  'segment.io',
  'segment.com',
  'mixpanel.com',
  'heap-api.com',
  'fullstory.com',
  'log.optimizely.com',
  'pixel.wp.com',
  'stats.wordpress.com',
  'trk.email.example.com',
  'click.email.example.com',
];

const TRACKING_DOMAIN_SET = new Set(KNOWN_TRACKING_DOMAINS);

function ensureStyle(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (style) return;

  style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${ROOT_ID} {
      background: #f0fdf4;
      border-left: 2px solid #16a34a;
      border-radius: 0;
      padding: 6px 12px;
      font-size: 12px;
      color: #15803d;
      margin-bottom: 8px;
      animation: simply-mail-shield-in 150ms linear;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    html.simply-mail-dark-mode .${ROOT_ID} {
      background: #052e16;
      color: #4ade80;
      border-left-color: #22c55e;
    }
    @keyframes simply-mail-shield-in {
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
  document.documentElement.appendChild(style);
}

function ensureFabStyle(): void {
  let style = document.getElementById(FAB_STYLE_ID) as HTMLStyleElement | null;
  if (style) return;

  style = document.createElement('style');
  style.id = FAB_STYLE_ID;
  style.textContent = `
    #${FAB_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #f0fdf4;
      border: 1px solid #16a34a;
      padding: 8px 12px;
      font-size: 12px;
      color: #15803d;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      gap: 6px;
      z-index: 9999;
      cursor: default;
      animation: simply-mail-fab-in 150ms linear;
    }
    html.simply-mail-dark-mode #${FAB_ID} {
      background: #052e16;
      color: #4ade80;
      border-color: #22c55e;
    }
    @keyframes simply-mail-fab-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes simply-mail-fab-pulse {
      0% { background: #f0fdf4; }
      50% { background: #bbf7d0; }
      100% { background: #f0fdf4; }
    }
    html.simply-mail-dark-mode @keyframes simply-mail-fab-pulse {
      0% { background: #052e16; }
      50% { background: #14532d; }
      100% { background: #052e16; }
    }
    .${FAB_ID}-pulse {
      animation: simply-mail-fab-pulse 400ms ease;
    }
  `;
  document.documentElement.appendChild(style);
}

function renderFabBadge(count: number): void {
  if (count === 0) {
    removeFabBadge();
    return;
  }

  ensureFabStyle();

  let fab = document.getElementById(FAB_ID);
  if (!fab) {
    fab = document.createElement('div');
    fab.id = FAB_ID;
    fab.setAttribute('role', 'status');
    fab.setAttribute('aria-live', 'polite');
    document.body.appendChild(fab);
  }

  const label = count === 1 ? 'tracker' : 'trackers';
  fab.textContent = `\u{1F6E1} ${count} ${label}`;

  // Trigger pulse animation on update
  fab.classList.remove(`${FAB_ID}-pulse`);
  // Force reflow to restart animation
  void fab.offsetWidth;
  fab.classList.add(`${FAB_ID}-pulse`);
}

function removeFabBadge(): void {
  document.getElementById(FAB_ID)?.remove();
  document.getElementById(FAB_STYLE_ID)?.remove();
}

function isTinyImage(img: HTMLImageElement): boolean {
  const w = img.getAttribute('width');
  const h = img.getAttribute('height');
  if (w === '1' || w === '0' || h === '1' || h === '0') return true;

  if (img.naturalWidth === 1 && img.naturalHeight === 1) return true;

  const style = img.style;
  if (style.width === '1px' || style.height === '1px') return true;

  return false;
}

function isKnownTrackingDomain(src: string): boolean {
  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();
    if (TRACKING_DOMAIN_SET.has(hostname)) return true;
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (TRACKING_DOMAIN_SET.has(parts.slice(i).join('.'))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function hasSuspiciousQueryParams(src: string): boolean {
  try {
    const url = new URL(src);
    const params = url.searchParams;
    const suspiciousKeys = [
      'open',
      'pixel',
      'beacon',
      'track',
      'trk',
      'click',
      'opn',
      'read',
      'seen',
      'view',
      'notify',
    ];
    let found = false;
    params.forEach((_value, key) => {
      if (suspiciousKeys.includes(key.toLowerCase())) found = true;
    });
    return found;
  } catch {
    return false;
  }
}

function isTrackerImage(
  img: HTMLImageElement,
  blockKnownDomains: boolean,
  blockTinyImages: boolean,
): boolean {
  const src = img.src || img.getAttribute('src') || '';
  if (!src) return false;

  if (blockKnownDomains && isKnownTrackingDomain(src)) return true;
  if (blockTinyImages && isTinyImage(img)) return true;
  if (blockKnownDomains && hasSuspiciousQueryParams(src)) return true;

  return false;
}

function scanAndBlockTrackers(
  threadNode: Element,
  context: ModuleContext,
): number {
  const { trackerBlocker } = context.settings;
  const images = Array.from(threadNode.querySelectorAll('img'));
  let count = 0;

  for (const img of images) {
    const htmlImg = img as HTMLImageElement;
    if (htmlImg.getAttribute(TRACKER_ATTR)) continue;

    if (isTrackerImage(htmlImg, trackerBlocker.blockKnownDomains, trackerBlocker.blockTinyImages)) {
      htmlImg.setAttribute(TRACKER_ATTR, 'true');
      htmlImg.style.display = 'none';
      count++;
    }
  }

  return count;
}

function renderShieldIndicator(threadNode: Element, count: number): void {
  removeShieldIndicator(threadNode);

  if (count === 0) return;

  ensureStyle();

  const banner = document.createElement('div');
  banner.id = ROOT_ID;
  banner.className = ROOT_ID;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  const label = count === 1 ? 'tracker blocked' : 'trackers blocked';
  banner.textContent = `\u{1F6E1} ${count} ${label}`;

  const firstMessage = threadNode.querySelector('[data-message-id]');
  const insertBefore = firstMessage || threadNode.firstChild;
  if (insertBefore && insertBefore.parentNode === threadNode) {
    threadNode.insertBefore(banner, insertBefore);
  } else {
    threadNode.prepend(banner);
  }
}

function removeShieldIndicator(threadNode?: Element): void {
  if (threadNode) {
    const existing = threadNode.querySelector(`#${ROOT_ID}`);
    if (existing) existing.remove();
  } else {
    document.getElementById(ROOT_ID)?.remove();
  }
}

async function updateStats(context: ModuleContext, additional: number): Promise<void> {
  if (additional === 0) return;
  try {
    const stats = await context.storage.getStats();
    const updated: RuntimeStats = {
      ...stats,
      trackersBlockedToday: stats.trackersBlockedToday + additional,
    };
    await context.storage.setStats(updated);
  } catch {
    // Swallow storage errors silently
  }
}

export function createTrackerBlockerModule(): SimplyMailModule {
  let unsubscriber: (() => void) | null = null;
  let contextRef: ModuleContext | null = null;
  let lastThreadNode: Element | null = null;

  function handleThreadDetected(payload: { node: Element | null }): void {
    if (!contextRef || !payload.node) return;

    lastThreadNode = payload.node;
    const count = scanAndBlockTrackers(payload.node, contextRef);
    renderShieldIndicator(payload.node, count);
    if (contextRef.settings.trackerBlocker.enabled) {
      renderFabBadge(count);
    }
    void updateStats(contextRef, count);
  }

  return {
    name: 'trackerBlocker',

    init(context) {
      contextRef = context;
      lastThreadNode = null;
      unsubscriber = context.observer.on('thread-detected', handleThreadDetected);
    },

    onSettingsChange(settings, context) {
      // Re-scan the current thread with updated settings
      if (settings.trackerBlocker.enabled && lastThreadNode) {
        contextRef = context;
        const count = scanAndBlockTrackers(lastThreadNode, contextRef);
        renderShieldIndicator(lastThreadNode, count);
        renderFabBadge(count);
        void updateStats(contextRef, count);
      }
      if (!settings.trackerBlocker.enabled) {
        removeFabBadge();
      }
    },

    destroy() {
      if (unsubscriber) {
        unsubscriber();
        unsubscriber = null;
      }

      // Unblock tracker images we hid
      if (lastThreadNode) {
        const blocked = Array.from(lastThreadNode.querySelectorAll(`[${TRACKER_ATTR}]`));
        for (const img of blocked) {
          img.removeAttribute(TRACKER_ATTR);
          (img as HTMLElement).style.display = '';
        }
        removeShieldIndicator(lastThreadNode);
      }

      removeFabBadge();
      document.getElementById(STYLE_ID)?.remove();
      contextRef = null;
      lastThreadNode = null;
    },
  };
}

// Exported for testing
export { isTinyImage, isKnownTrackingDomain, hasSuspiciousQueryParams, KNOWN_TRACKING_DOMAINS };

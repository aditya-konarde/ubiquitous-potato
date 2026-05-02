import type { ModuleContext, SimplyMailModule, MailView } from '@/shared/types';
import { injectAnimationCSS, ANIM_TOKENS } from './animation-system';
import { ensureStyle, removeStyle, getMountPoint } from './dom-utils';

const STYLE_ID = 'simply-mail-skeleton-loading-style';
const CONTAINER_ID = 'simply-mail-skeleton-container';

const INBOX_VIEWS: MailView[] = ['inbox', 'starred', 'sent', 'drafts', 'allMail', 'label', 'search'];

function isInboxView(view: MailView): boolean {
  return INBOX_VIEWS.includes(view);
}

function buildCSS(): string {
  return /* css */ `
    .${CONTAINER_ID} {
      padding: 8px 16px;
    }
    .simply-mail-skeleton-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--simply-mail-border, #e4e4e7);
      animation: simply-mail-slide-up ${ANIM_TOKENS.durationNormal}ms ${ANIM_TOKENS.springCurve} both;
    }
    .simply-mail-skeleton-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      flex-shrink: 0;
      background: linear-gradient(90deg, #e4e4e7 25%, #d4d4d8 50%, #e4e4e7 75%);
      background-size: 200% 100%;
      animation: simply-mail-shimmer 1.5s infinite linear;
    }
    .simply-mail-skeleton-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .simply-mail-skeleton-line {
      height: 12px;
      border-radius: 0;
      background: linear-gradient(90deg, #e4e4e7 25%, #d4d4d8 50%, #e4e4e7 75%);
      background-size: 200% 100%;
      animation: simply-mail-shimmer 1.5s infinite linear;
    }
    .simply-mail-skeleton-sender {
      width: 120px;
    }
    .simply-mail-skeleton-subject {
      width: 70%;
    }
    .simply-mail-skeleton-snippet {
      width: 45%;
    }
    html.simply-mail-dark-mode .simply-mail-skeleton-avatar,
    html.simply-mail-dark-mode .simply-mail-skeleton-line {
      background: linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%);
      background-size: 200% 100%;
    }

    @media (prefers-reduced-motion: reduce) {
      .simply-mail-skeleton-row {
        animation: none !important;
      }
      .simply-mail-skeleton-avatar,
      .simply-mail-skeleton-line {
        animation: none !important;
      }
    }
  `;
}

function createSkeletonRow(index: number, staggerMs: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'simply-mail-skeleton-row';
  row.style.animationDelay = `${index * staggerMs}ms`;

  const avatar = document.createElement('div');
  avatar.className = 'simply-mail-skeleton-avatar';
  // Stagger shimmer start so they don't all pulse in sync
  avatar.style.animationDelay = `${index * 80}ms`;

  const content = document.createElement('div');
  content.className = 'simply-mail-skeleton-content';

  const sender = document.createElement('div');
  sender.className = 'simply-mail-skeleton-line simply-mail-skeleton-sender';
  sender.style.animationDelay = `${index * 80 + 40}ms`;

  const subject = document.createElement('div');
  subject.className = 'simply-mail-skeleton-line simply-mail-skeleton-subject';
  subject.style.animationDelay = `${index * 80 + 80}ms`;

  const snippet = document.createElement('div');
  snippet.className = 'simply-mail-skeleton-line simply-mail-skeleton-snippet';
  snippet.style.animationDelay = `${index * 80 + 120}ms`;

  content.appendChild(sender);
  content.appendChild(subject);
  content.appendChild(snippet);

  row.appendChild(avatar);
  row.appendChild(content);

  return row;
}

function showSkeletons(rowCount: number): void {
  const mountPoint = getMountPoint();
  if (!mountPoint) return;

  removeSkeletons();

  injectAnimationCSS();
  ensureStyle(STYLE_ID, buildCSS());

  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.className = CONTAINER_ID;

  const staggerMs = ANIM_TOKENS.staggerDelay;
  for (let i = 0; i < rowCount; i++) {
    container.appendChild(createSkeletonRow(i, staggerMs));
  }

  mountPoint.appendChild(container);
}

function removeSkeletons(): void {
  document.getElementById(CONTAINER_ID)?.remove();
  removeStyle(STYLE_ID);
}

export function createSkeletonLoadingModule(): SimplyMailModule {
  let unsubscribers: Array<() => void> = [];
  let currentContext: ModuleContext | null = null;

  function handleInboxUpdated(payload: { rows: Element[] }): void {
    if (!currentContext) return;

    const view = currentContext.observer.getCurrentView();
    const rowCount = currentContext.settings.skeletonLoading.rowCount;

    if (payload.rows.length === 0 && isInboxView(view)) {
      showSkeletons(rowCount);
    } else {
      removeSkeletons();
    }
  }

  return {
    name: 'skeletonLoading',
    init(context) {
      currentContext = context;
      unsubscribers = [
        context.observer.on('inbox-updated', handleInboxUpdated),
      ];

      // If we're already on an inbox view with no rows, show skeletons immediately
      const view = context.observer.getCurrentView();
      if (isInboxView(view)) {
        const mountPoint = getMountPoint();
        const existingRows = mountPoint?.querySelectorAll('tr[role="row"]');
        if (!existingRows || existingRows.length === 0) {
          showSkeletons(context.settings.skeletonLoading.rowCount);
        }
      }
    },
    destroy() {
      unsubscribers.forEach((fn) => fn());
      unsubscribers = [];
      removeSkeletons();
      currentContext = null;
    },
    onSettingsChange(settings, context) {
      context.settings = settings;
      currentContext = context;
    },
  };
}

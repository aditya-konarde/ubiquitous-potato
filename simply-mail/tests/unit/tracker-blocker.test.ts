import { createTrackerBlockerModule, isTinyImage, isKnownTrackingDomain, hasSuspiciousQueryParams } from '@/content/modules/tracker-blocker';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { MailView, ModuleContext } from '@/shared/types';

function createContext(overrides?: Partial<ModuleContext>): ModuleContext {
  return {
    observer: {
      start: vi.fn(),
      stop: vi.fn(),
      getCurrentView: vi.fn<() => MailView>(() => 'thread'),
      on: vi.fn(() => () => undefined),
    },
    settings: structuredClone(DEFAULT_SETTINGS),
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
    ...overrides,
  };
}

function triggerThreadDetected(context: ModuleContext, node: Element | null): void {
  const onMock = context.observer.on as ReturnType<typeof vi.fn>;
  for (const call of onMock.mock.calls) {
    const [eventName, handler] = call as [string, (p: unknown) => void];
    if (eventName === 'thread-detected') {
      handler({ node });
    }
  }
}

function createThreadContainer(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'thread-container';
  document.body.appendChild(el);
  return el;
}

function addImage(
  parent: HTMLElement,
  src: string,
  attrs?: { width?: string; height?: string },
): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  if (attrs?.width) img.setAttribute('width', attrs.width);
  if (attrs?.height) img.setAttribute('height', attrs.height);
  parent.appendChild(img);
  return img;
}

describe('createTrackerBlockerModule', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('has the correct module name', () => {
    const module = createTrackerBlockerModule();
    expect(module.name).toBe('trackerBlocker');
  });

  it('subscribes to thread-detected on init', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const onMock = context.observer.on as ReturnType<typeof vi.fn>;
    const eventNames = onMock.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain('thread-detected');

    module.destroy();
  });

  it('cleans up subscription on destroy', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);
    module.destroy();

    // After destroy, triggering thread-detected should not create shield
    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/track.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-shield')).toBeNull();
  });

  it('blocks 1x1 pixel images when blockTinyImages is enabled', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();
    context.settings.trackerBlocker.blockTinyImages = true;
    context.settings.trackerBlocker.blockKnownDomains = false;

    module.init(context);

    const thread = createThreadContainer();
    const trackerImg = addImage(thread, 'https://example.com/img.png', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(trackerImg.style.display).toBe('none');
    expect(trackerImg.getAttribute('data-simply-mail-tracker')).toBe('true');

    module.destroy();
  });

  it('blocks images from known tracking domains when blockKnownDomains is enabled', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();
    context.settings.trackerBlocker.blockKnownDomains = true;
    context.settings.trackerBlocker.blockTinyImages = false;

    module.init(context);

    const thread = createThreadContainer();
    const trackerImg = addImage(thread, 'https://mailchimp.com/track.gif');
    triggerThreadDetected(context, thread);

    expect(trackerImg.style.display).toBe('none');

    module.destroy();
  });

  it('does NOT block normal images', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    const normalImg = addImage(thread, 'https://example.com/photo.jpg', { width: '200', height: '150' });
    triggerThreadDetected(context, thread);

    expect(normalImg.style.display).not.toBe('none');
    expect(normalImg.getAttribute('data-simply-mail-tracker')).toBeNull();

    module.destroy();
  });

  it('does NOT block when both blockKnownDomains and blockTinyImages are disabled', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();
    context.settings.trackerBlocker.blockKnownDomains = false;
    context.settings.trackerBlocker.blockTinyImages = false;

    module.init(context);

    const thread = createThreadContainer();
    const img = addImage(thread, 'https://mailchimp.com/track.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(img.style.display).not.toBe('none');

    module.destroy();
  });

  it('shows shield indicator with correct tracker count', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    addImage(thread, 'https://hubspot.com/track.png', { width: '1', height: '1' });
    addImage(thread, 'https://example.com/photo.jpg', { width: '300', height: '200' });
    triggerThreadDetected(context, thread);

    const shield = document.getElementById('simply-mail-tracker-shield');
    expect(shield).not.toBeNull();
    expect(shield?.textContent).toContain('2 trackers blocked');

    module.destroy();
  });

  it('shows singular "tracker blocked" for count of 1', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    const shield = document.getElementById('simply-mail-tracker-shield');
    expect(shield?.textContent).toContain('1 tracker blocked');

    module.destroy();
  });

  it('does NOT show shield when no trackers are found', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://example.com/photo.jpg', { width: '300', height: '200' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-shield')).toBeNull();

    module.destroy();
  });

  it('updates RuntimeStats.trackersBlockedToday in storage', async () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    addImage(thread, 'https://hubspot.com/track.png', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    // Wait for async updateStats
    await new Promise((r) => setTimeout(r, 10));

    expect(context.storage.getStats).toHaveBeenCalled();
    expect(context.storage.setStats).toHaveBeenCalledWith(
      expect.objectContaining({ trackersBlockedToday: 2 }),
    );

    module.destroy();
  });

  it('handles null thread node gracefully', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);
    triggerThreadDetected(context, null);

    expect(document.getElementById('simply-mail-tracker-shield')).toBeNull();

    module.destroy();
  });

  it('removes shield indicator and unhides images on destroy', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    const trackerImg = addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-shield')).not.toBeNull();
    expect(trackerImg.style.display).toBe('none');

    module.destroy();

    expect(document.getElementById('simply-mail-tracker-shield')).toBeNull();
    expect(trackerImg.style.display).not.toBe('none');
  });

  it('injects shield styles into the document when trackers are found', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    const style = document.getElementById('simply-mail-tracker-shield-style');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('simply-mail-shield-in');

    module.destroy();
  });

  it('removes style element on destroy', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-shield-style')).not.toBeNull();

    module.destroy();

    expect(document.getElementById('simply-mail-tracker-shield-style')).toBeNull();
  });
});

describe('isTinyImage', () => {
  it('detects width=1 attribute', () => {
    const img = document.createElement('img');
    img.setAttribute('width', '1');
    img.setAttribute('height', '10');
    expect(isTinyImage(img)).toBe(true);
  });

  it('detects height=1 attribute', () => {
    const img = document.createElement('img');
    img.setAttribute('width', '10');
    img.setAttribute('height', '1');
    expect(isTinyImage(img)).toBe(true);
  });

  it('returns false for normal-sized images', () => {
    const img = document.createElement('img');
    img.setAttribute('width', '200');
    img.setAttribute('height', '150');
    expect(isTinyImage(img)).toBe(false);
  });
});

describe('isKnownTrackingDomain', () => {
  it('matches mailchimp.com', () => {
    expect(isKnownTrackingDomain('https://mailchimp.com/track.gif')).toBe(true);
  });

  it('matches subdomains of known domains', () => {
    expect(isKnownTrackingDomain('https://track.mailchimp.com/pixel.gif')).toBe(true);
  });

  it('does not match unknown domains', () => {
    expect(isKnownTrackingDomain('https://example.com/image.png')).toBe(false);
  });

  it('handles invalid URLs gracefully', () => {
    expect(isKnownTrackingDomain('')).toBe(false);
  });
});

describe('hasSuspiciousQueryParams', () => {
  it('detects open tracking params', () => {
    expect(hasSuspiciousQueryParams('https://example.com/img.png?open=true')).toBe(true);
  });

  it('detects pixel tracking params', () => {
    expect(hasSuspiciousQueryParams('https://example.com/img.png?pixel=123')).toBe(true);
  });

  it('returns false for benign query params', () => {
    expect(hasSuspiciousQueryParams('https://example.com/img.png?quality=high')).toBe(false);
  });

  it('returns false for URLs without query params', () => {
    expect(hasSuspiciousQueryParams('https://example.com/img.png')).toBe(false);
  });
});

describe('tracker FAB badge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders FAB badge when trackers are found', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    const fab = document.getElementById('simply-mail-tracker-fab');
    expect(fab).not.toBeNull();
    expect(fab?.textContent).toContain('1 tracker');

    module.destroy();
  });

  it('renders FAB badge with plural "trackers" for count > 1', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    addImage(thread, 'https://hubspot.com/track.png', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    const fab = document.getElementById('simply-mail-tracker-fab');
    expect(fab).not.toBeNull();
    expect(fab?.textContent).toContain('2 trackers');

    module.destroy();
  });

  it('does NOT render FAB badge when no trackers are found', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://example.com/photo.jpg', { width: '300', height: '200' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-fab')).toBeNull();

    module.destroy();
  });

  it('adds pulse class when updating the FAB badge', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    const fab = document.getElementById('simply-mail-tracker-fab');
    expect(fab?.classList.contains('simply-mail-tracker-fab-pulse')).toBe(true);

    module.destroy();
  });

  it('removes FAB badge on destroy', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-fab')).not.toBeNull();

    module.destroy();

    expect(document.getElementById('simply-mail-tracker-fab')).toBeNull();
  });

  it('removes FAB badge style on destroy', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-fab-style')).not.toBeNull();

    module.destroy();

    expect(document.getElementById('simply-mail-tracker-fab-style')).toBeNull();
  });

  it('injects FAB badge styles with dark mode support', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    const style = document.getElementById('simply-mail-tracker-fab-style');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('simply-mail-dark-mode');
    expect(style?.textContent).toContain('simply-mail-fab-pulse');

    module.destroy();
  });

  it('removes FAB badge when trackerBlocker is disabled via onSettingsChange', () => {
    const module = createTrackerBlockerModule();
    const context = createContext();

    module.init(context);

    const thread = createThreadContainer();
    addImage(thread, 'https://mailchimp.com/t.gif', { width: '1', height: '1' });
    triggerThreadDetected(context, thread);

    expect(document.getElementById('simply-mail-tracker-fab')).not.toBeNull();

    const disabledSettings = structuredClone(context.settings);
    disabledSettings.trackerBlocker.enabled = false;
    module.onSettingsChange!(disabledSettings, context);

    expect(document.getElementById('simply-mail-tracker-fab')).toBeNull();

    module.destroy();
  });
});

import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { storage } from '@/shared/storage';
import type { RuntimeStats } from '@/shared/messaging';
import { sendRuntimeMessage } from '@/shared/messaging';
import type { SimplyMailSettings } from '@/shared/types';

function ToggleRow(
  props: {
    title: string;
    subtitle: string;
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
  },
) {
  return (
    <div class="popup-toggle-row">
      <div class="popup-toggle-copy">
        <strong>{props.title}</strong>
        <span class="popup-toggle-subtitle">{props.subtitle}</span>
      </div>
      <label class="toggle-switch" aria-label={props.title}>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => {
            const el = e.currentTarget;
            el.parentElement?.parentElement?.classList.add('is-pulsing');
            setTimeout(() => el.parentElement?.parentElement?.classList.remove('is-pulsing'), 300);
            props.onToggle();
          }}
          disabled={props.disabled}
        />
        <span />
      </label>
    </div>
  );
}

function App() {
  const [settings, setSettings] = useState<SimplyMailSettings | null>(null);
  const [stats, setStats] = useState<RuntimeStats>({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>();

  const showFeedback = useCallback((message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  useEffect(() => {
    void storage.getSettings().then(setSettings);
    void sendRuntimeMessage<RuntimeStats>({ type: 'simply-mail/get-stats' }).then(setStats).catch(() => {
      showFeedback('Stats unavailable.');
    });
  }, [showFeedback]);

  const patch = useCallback(
    async (partial: Partial<SimplyMailSettings>) => {
      try {
        const next = await storage.patchSettings(partial);
        setSettings(next);
      } catch {
        showFeedback('Setting did not save. Try again.');
      }
    },
    [showFeedback],
  );

  const openPalette = useCallback(() => {
    void sendRuntimeMessage<{ ok?: boolean }>({ type: 'simply-mail/show-palette' })
      .then((response) => {
        if (response?.ok === false) {
          showFeedback('Reload your inbox, then try the palette again.');
        }
      })
      .catch(() => {
        showFeedback('Open your inbox before using the palette.');
      });
  }, [showFeedback]);

  const openSettings = useCallback(() => {
    void sendRuntimeMessage({ type: 'simply-mail/open-options' }).catch(() => {
      window.open('settings.html', '_blank', 'noopener');
    });
  }, []);

  const enabledModules = useMemo(() => {
    if (!settings) {
      return 0;
    }

    return [
      settings.darkMode.enabled,
      settings.uiCleanup.enabled,
      settings.commandPalette.enabled,
      settings.keyboardNavigation.enabled,
      settings.savedSearches.enabled,
      settings.splitInboxSettings.enabled,
      settings.inboxZero.enabled,
      settings.trackerBlocker.enabled,
      settings.autoCcBcc.enabled,
      settings.groupByDate.enabled,
      settings.pauseInbox.enabled,
      settings.instantReply.enabled,
      settings.emailAnalytics.enabled,
      settings.ai.enabled,
    ].filter(Boolean).length;
  }, [settings]);

  if (!settings) {
    return (
      <main class="shell popup-shell" aria-busy="true">
        <section class="popup-hero">
          <p class="kicker">Simply Mail</p>
          <h1 class="popup-hero-title">Loading…</h1>
        </section>
      </main>
    );
  }

  return (
    <main class="shell popup-shell" role="main">
      <section class="popup-hero">
        <div class="popup-hero-header">
          <div>
            <p class="kicker">Simply Mail</p>
            <h1 class="popup-hero-title">Quick controls</h1>
          </div>
          <span class={`popup-status-chip ${settings.paused ? 'is-paused' : ''}`}>
            {settings.paused ? 'Paused' : 'Active'}
          </span>
        </div>
        <div class="popup-hero-meta">
          <span class="popup-meta-chip"><strong>{enabledModules}</strong> active</span>
          <span class="popup-meta-chip"><strong>{stats.trackersBlockedToday}</strong> blocked</span>
        </div>
      </section>

      {feedback ? (
        <div class="popup-feedback" role="status" aria-live="polite">{feedback}</div>
      ) : null}

      <section class="popup-section popup-section-tight">
        <div class="popup-toggle-list">
          <ToggleRow
            title="Dark Mode"
            subtitle={settings.darkMode.enabled ? `${settings.darkMode.mode}` : 'Off'}
            checked={settings.darkMode.enabled}
            onToggle={() => void patch({ darkMode: { ...settings.darkMode, enabled: !settings.darkMode.enabled } })}
          />
          <ToggleRow
            title="Tracker Blocker"
            subtitle={settings.trackerBlocker.enabled ? `${stats.trackersBlockedToday} blocked today` : 'Off'}
            checked={settings.trackerBlocker.enabled}
            onToggle={() => void patch({ trackerBlocker: { ...settings.trackerBlocker, enabled: !settings.trackerBlocker.enabled } })}
          />
          <ToggleRow
            title="Pause Inbox"
            subtitle={settings.paused ? 'Paused' : (settings.pauseInbox.enabled ? 'Ready' : 'Off')}
            checked={settings.paused}
            onToggle={() => void patch({ paused: !settings.paused })}
          />
        </div>
      </section>

      <section class="popup-footer popup-footer-actions">
        <button
          class="ghost popup-footer-action"
          onClick={openPalette}
        >
          Command Palette (⌘K)
        </button>
        <button
          type="button"
          class="ghost popup-footer-action"
          onClick={openSettings}
        >
          Settings
        </button>
      </section>

    </main>
  );
}

const appRoot = document.getElementById('app');
if (appRoot) render(<App />, appRoot);

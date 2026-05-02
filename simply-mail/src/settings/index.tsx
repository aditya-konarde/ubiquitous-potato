import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { storage } from '@/shared/storage';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { callAi } from '@/shared/ai-client';
import { clampNumber, createDraftId, parseMultilineList, toMultilineList } from '@/shared/settings-utils';
import type {
  AiSettings,
  AutoCcBccSettings,
  DarkModeSettings,
  SimplyMailSettings,
  SavedSearch,
  SmartActionsSettings,
  Snippet,
  SplitTab,
} from '@/shared/types';

function SettingRow(
  props: {
    title: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
    disabledReason?: string;
  },
) {
  return (
    <div class={`setting-row${props.disabled ? ' is-disabled' : ''}`} aria-disabled={props.disabled ? 'true' : undefined}>
      <div class="setting-copy">
        <h3>{props.title}</h3>
        <p>{props.description}</p>
        {props.disabledReason ? <p class="setting-help">{props.disabledReason}</p> : null}
      </div>
      <label class="toggle-switch" aria-label={props.title}>
        <input type="checkbox" checked={props.checked} onChange={props.onToggle} disabled={props.disabled} />
        <span />
      </label>
    </div>
  );
}

function ThemeModeControl(props: { value: DarkModeSettings['mode']; onChange: (mode: DarkModeSettings['mode']) => void; disabled?: boolean }) {
  const options: DarkModeSettings['mode'][] = ['system', 'light', 'dark'];

  return (
    <div class="segmented-control" role="radiogroup" aria-label="Dark mode preference">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === props.value}
          class={option === props.value ? 'is-active' : ''}
          disabled={props.disabled}
          onClick={() => props.onChange(option)}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}

function AutoCcBccModeControl(props: { value: AutoCcBccSettings['mode']; onChange: (mode: AutoCcBccSettings['mode']) => void; disabled?: boolean }) {
  const options: AutoCcBccSettings['mode'][] = ['new', 'reply', 'both'];

  return (
    <div class="segmented-control" role="radiogroup" aria-label="Auto CC/BCC mode">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === props.value}
          class={option === props.value ? 'is-active' : ''}
          disabled={props.disabled}
          onClick={() => props.onChange(option)}
        >
          {option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}

function AiProviderControl(props: { value: AiSettings['provider']; onChange: (provider: AiSettings['provider']) => void }) {
  const options: AiSettings['provider'][] = ['openai', 'anthropic', 'openrouter'];

  return (
    <div class="segmented-control" role="radiogroup" aria-label="AI provider">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === props.value}
          class={option === props.value ? 'is-active' : ''}
          onClick={() => props.onChange(option)}
        >
          {option === 'openai' ? 'Provider A' : option === 'anthropic' ? 'Provider B' : 'Provider C'}
        </button>
      ))}
    </div>
  );
}

function SmartActionsPositionControl(props: { value: SmartActionsSettings['position']; onChange: (position: SmartActionsSettings['position']) => void; disabled?: boolean }) {
  const options: SmartActionsSettings['position'][] = ['inline', 'floating'];

  return (
    <div class="segmented-control segmented-control-two" role="radiogroup" aria-label="Smart actions position">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === props.value}
          class={option === props.value ? 'is-active' : ''}
          disabled={props.disabled}
          onClick={() => props.onChange(option)}
        >
          {option === 'inline' ? 'Inline' : 'Floating'}
        </button>
      ))}
    </div>
  );
}

function MultilineEditor(
  props: {
    title: string;
    description: string;
    values: string[];
    placeholder: string;
    saveLabel: string;
    emptyState: string;
    emailsOnly?: boolean;
    onSave: (values: string[]) => void;
  },
) {
  const [draft, setDraft] = useState(toMultilineList(props.values));

  useEffect(() => {
    setDraft(toMultilineList(props.values));
  }, [props.values]);

  const parsedValues = useMemo(() => parseMultilineList(draft, { emailsOnly: props.emailsOnly }), [draft, props.emailsOnly]);

  return (
    <div class="setting-row setting-row-vertical">
      <div class="setting-copy stack-sm">
        <h3>{props.title}</h3>
        <p>{props.description}</p>
        {props.values.length > 0 ? (
          <div class="chip-row">
            {props.values.map((value) => (
              <span key={value} class="preview-chip"><code>{value}</code></span>
            ))}
          </div>
        ) : (
          <p class="muted">{props.emptyState}</p>
        )}
      </div>
      <textarea
        class="text-input text-area"
        value={draft}
        placeholder={props.placeholder}
        rows={4}
        onInput={(event) => setDraft((event.target as HTMLTextAreaElement).value)}
      />
      <div class="button-row">
        <button class="secondary" onClick={() => setDraft(toMultilineList(props.values))}>Reset</button>
        <button class="primary" onClick={() => props.onSave(parsedValues)}>{props.saveLabel}</button>
      </div>
    </div>
  );
}

function SplitTabsEditor(props: { tabs: SplitTab[]; onChange: (tabs: SplitTab[]) => void }) {
  const updateTab = (id: string, patch: Partial<SplitTab>) => {
    props.onChange(props.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  };

  const removeTab = (id: string) => {
    props.onChange(props.tabs.filter((tab) => tab.id !== id));
  };

  const addTab = () => {
    props.onChange([
      ...props.tabs,
      { id: createDraftId('tab'), label: `Focus ${props.tabs.length + 1}`, query: 'label:important' },
    ]);
  };

  return (
    <section class="panel-card stack-md">
      <div class="section-heading">
        <div>
          <h2>Focus tabs</h2>
          <p>Curate the split inbox views that deserve a permanent slot above your list.</p>
        </div>
        <span class="section-chip">High-signal views</span>
      </div>
      <div class="stack-md">
        {props.tabs.map((tab) => (
          <article key={tab.id} class="preview-card stack-sm">
            <div class="setting-row setting-row-inline-top setting-row-no-border">
              <div class="setting-copy">
                <h3>{tab.label}</h3>
                <p>{tab.query}</p>
              </div>
              <button class="secondary" onClick={() => removeTab(tab.id)}>Remove</button>
            </div>
            <div class="settings-form-grid">
              <label class="stack-sm">
                <span class="muted">Label</span>
                <input
                  class="text-input"
                  type="text"
                  value={tab.label}
                  onInput={(event) => updateTab(tab.id, { label: (event.target as HTMLInputElement).value })}
                />
              </label>
              <label class="stack-sm settings-form-span-full">
                <span class="muted">Search query</span>
                <input
                  class="text-input"
                  type="text"
                  value={tab.query}
                  onInput={(event) => updateTab(tab.id, { query: (event.target as HTMLInputElement).value })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <div class="button-row">
        <button class="secondary" onClick={addTab}>Add focus tab</button>
      </div>
    </section>
  );
}

function SavedSearchesEditor(props: { searches: SavedSearch[]; onChange: (searches: SavedSearch[]) => void }) {
  const updateSearch = (id: string, patch: Partial<SavedSearch>) => {
    props.onChange(props.searches.map((search) => (search.id === id ? { ...search, ...patch } : search)));
  };

  const removeSearch = (id: string) => {
    props.onChange(props.searches.filter((search) => search.id !== id));
  };

  const addSearch = () => {
    props.onChange([
      ...props.searches,
      { id: createDraftId('search'), label: `Saved search ${props.searches.length + 1}`, query: 'is:unread' },
    ]);
  };

  return (
    <section class="panel-card stack-md">
      <div class="section-heading">
        <div>
          <h2>Saved searches</h2>
          <p>Turn repeated query habits into sidebar shortcuts and palette actions.</p>
        </div>
        <span class="section-chip">Find anything fast</span>
      </div>
      <div class="stack-md">
        {props.searches.map((search) => (
          <article key={search.id} class="preview-card stack-sm">
            <div class="setting-row setting-row-inline-top setting-row-no-border">
              <div class="setting-copy">
                <h3>{search.label}</h3>
                <p>{search.query}</p>
              </div>
              <button class="secondary" onClick={() => removeSearch(search.id)}>Remove</button>
            </div>
            <div class="settings-form-grid">
              <label class="stack-sm">
                <span class="muted">Label</span>
                <input
                  class="text-input"
                  type="text"
                  value={search.label}
                  onInput={(event) => updateSearch(search.id, { label: (event.target as HTMLInputElement).value })}
                />
              </label>
              <label class="stack-sm settings-form-span-full">
                <span class="muted">Search query</span>
                <input
                  class="text-input"
                  type="text"
                  value={search.query}
                  onInput={(event) => updateSearch(search.id, { query: (event.target as HTMLInputElement).value })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <div class="button-row">
        <button class="secondary" onClick={addSearch}>Add saved search</button>
      </div>
    </section>
  );
}

function SnippetsEditor(props: { snippets: Snippet[]; onChange: (snippets: Snippet[]) => void }) {
  const updateSnippet = (id: string, patch: Partial<Snippet>) => {
    props.onChange(props.snippets.map((snippet) => (snippet.id === id ? { ...snippet, ...patch } : snippet)));
  };

  const removeSnippet = (id: string) => {
    props.onChange(props.snippets.filter((snippet) => snippet.id !== id));
  };

  const addSnippet = () => {
    props.onChange([
      ...props.snippets,
      { id: createDraftId('snippet'), trigger: `;snippet${props.snippets.length + 1}`, body: 'Thanks for the note. I will get back to you shortly.' },
    ]);
  };

  return (
    <section class="panel-card stack-md">
      <div class="section-heading">
        <div>
          <h2>Snippets</h2>
          <p>Prepare fast response building blocks for your next compose automation pass.</p>
        </div>
        <span class="section-chip">Prepared replies</span>
      </div>
      <div class="stack-md">
        {props.snippets.map((snippet) => (
          <article key={snippet.id} class="preview-card stack-sm">
            <div class="setting-row setting-row-inline-top setting-row-no-border">
              <div class="setting-copy">
                <h3>{snippet.trigger}</h3>
                <p>{snippet.body}</p>
              </div>
              <button class="secondary" onClick={() => removeSnippet(snippet.id)}>Remove</button>
            </div>
            <div class="settings-form-grid">
              <label class="stack-sm">
                <span class="muted">Trigger</span>
                <input
                  class="text-input"
                  type="text"
                  value={snippet.trigger}
                  onInput={(event) => updateSnippet(snippet.id, { trigger: (event.target as HTMLInputElement).value })}
                />
              </label>
              <label class="stack-sm settings-form-span-full">
                <span class="muted">Body</span>
                <textarea
                  class="text-input text-area"
                  rows={3}
                  value={snippet.body}
                  onInput={(event) => updateSnippet(snippet.id, { body: (event.target as HTMLTextAreaElement).value })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
      <div class="button-row">
        <button class="secondary" onClick={addSnippet}>Add snippet</button>
      </div>
    </section>
  );
}

function AiSettingsSection(props: { settings: SimplyMailSettings; update: (next: Partial<SimplyMailSettings>) => void }) {
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout>>();

  const showResult = useCallback((message: string, type: 'success' | 'error') => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    setTestResult({ message, type });
    resultTimer.current = setTimeout(() => setTestResult(null), 4000);
  }, []);

  useEffect(() => () => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
  }, []);

  const testConnection = useCallback(async () => {
    const ai = props.settings.ai;
    if (!ai.apiKey) {
      showResult('API key missing.', 'error');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      await callAi(ai, 'Test prompt.', "Say 'ok'", { maxTokens: 5 });
      showResult('Connection active.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed.';
      showResult(msg.substring(0, 40) + (msg.length > 40 ? '...' : ''), 'error');
    } finally {
      setIsTesting(false);
    }
  }, [props.settings.ai, showResult]);

  const providerPlaceholder = 'API key';
  const modelPlaceholder = 'model-name';

  return (
    <section class="panel-card stack-md">
      <div class="section-heading">
        <div>
          <h2>AI Intelligence</h2>
          <p>Configure your AI provider to enable smart replies and drafting.</p>
        </div>
      </div>

      <SettingRow
        title="Enable AI features"
        description="Power smart replies, draft suggestions, and any future AI-driven assistive surfaces."
        checked={props.settings.ai.enabled}
        onToggle={() => props.update({ ai: { ...props.settings.ai, enabled: !props.settings.ai.enabled } })}
      />
      <SettingRow
        title="Enable instant reply suggestions"
        description="Show AI-generated reply options when viewing an email thread."
        checked={props.settings.instantReply.enabled}
        disabled={!props.settings.ai.enabled}
        disabledReason={!props.settings.ai.enabled ? 'Turn on AI features to enable reply suggestions.' : undefined}
        onToggle={() => props.update({ instantReply: { ...props.settings.instantReply, enabled: !props.settings.instantReply.enabled } })}
      />
      <SettingRow
        title="Skip calendar invites"
        description="Avoid generating reply suggestions for invites, RSVPs, and .ics-heavy threads."
        checked={props.settings.instantReply.skipCalendarInvites}
        disabled={!props.settings.ai.enabled || !props.settings.instantReply.enabled}
        disabledReason={!props.settings.ai.enabled ? 'Requires AI features.' : !props.settings.instantReply.enabled ? 'Enable instant reply suggestions first.' : undefined}
        onToggle={() => props.update({ instantReply: { ...props.settings.instantReply, skipCalendarInvites: !props.settings.instantReply.skipCalendarInvites } })}
      />
      <SettingRow
        title="Skip promotional threads"
        description="Reserve AI calls for conversations and high-signal mail instead of marketing blasts."
        checked={props.settings.instantReply.skipPromotions}
        disabled={!props.settings.ai.enabled || !props.settings.instantReply.enabled}
        disabledReason={!props.settings.ai.enabled ? 'Requires AI features.' : !props.settings.instantReply.enabled ? 'Enable instant reply suggestions first.' : undefined}
        onToggle={() => props.update({ instantReply: { ...props.settings.instantReply, skipPromotions: !props.settings.instantReply.skipPromotions } })}
      />

      <div class="setting-row">
        <div class="setting-copy">
          <h3>AI provider</h3>
          <p>Choose which AI service powers Simply Mail features.</p>
        </div>
        <AiProviderControl
          value={props.settings.ai.provider}
          onChange={(provider) => props.update({ ai: { ...props.settings.ai, provider } })}
        />
      </div>

      <div class="setting-row setting-row-vertical">
        <div class="setting-copy stack-sm">
          <h3>API key</h3>
          <p>Your key stays in browser storage. Simply Mail talks only to the provider you configure.</p>
        </div>
        <div class="input-with-action">
          <input
            class="text-input text-input-mono"
            type={showKey ? 'text' : 'password'}
            placeholder={providerPlaceholder}
            value={props.settings.ai.apiKey}
            onInput={(e) => props.update({ ai: { ...props.settings.ai, apiKey: (e.target as HTMLInputElement).value } })}
          />
          <button
            class="ghost input-action"
            type="button"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div class="setting-row setting-row-vertical">
        <div class="setting-copy stack-sm">
          <h3>Model</h3>
          <p>Use a fast, low-cost model by default. Save bigger models for harder draft work later.</p>
        </div>
        <input
          class="text-input text-input-mono"
          type="text"
          placeholder={modelPlaceholder}
          value={props.settings.ai.model}
          onInput={(e) => props.update({ ai: { ...props.settings.ai, model: (e.target as HTMLInputElement).value } })}
        />
      </div>

      <div class="button-row settings-test-row">
        <button
          class="secondary"
          onClick={testConnection}
          disabled={isTesting}
        >
          {isTesting ? 'Testing...' : 'Test connection'}
        </button>
        {testResult && (
          <span
            class={`test-feedback type-${testResult.type}`}
          >
            {testResult.message}
          </span>
        )}
      </div>
    </section>
  );
}

const SIMPLY_MAIL_SETTINGS_KEYS = new Set([
  'uiCleanup', 'darkMode', 'keyboardNavigation', 'commandPalette',
  'savedSearches', 'splitInboxSettings', 'pauseInbox', 'groupByDate',
  'inboxZero', 'trackerBlocker', 'autoCcBcc', 'ai', 'instantReply',
  'smartActions', 'emailAnalytics', 'skeletonLoading', 'splitTabs', 'savedSearchesList',
  'snippets', 'paused', 'installedAt', 'onboarded',
  'inboxSummary', 'batchActions', 'readingPane', 'scrollProgress',
  'rowAnimations', 'senderAvatars', 'priorityBadges', 'attachmentChips',
]);

function isValidSettingsShape(data: unknown): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null) return false;
  const keys = Object.keys(data as Record<string, unknown>);
  const overlap = keys.filter((k) => SIMPLY_MAIL_SETTINGS_KEYS.has(k));
  return overlap.length >= 5;
}

function DataManagement(props: { settings: SimplyMailSettings; onReload: () => void }) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const handleExport = useCallback(() => {
    try {
      const json = JSON.stringify(props.settings, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'simply-mail-settings-backup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Settings exported successfully.', 'success');
    } catch {
      showToast('Failed to export settings.', 'error');
    }
  }, [props.settings, showToast]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!isValidSettingsShape(data)) {
        showToast('Invalid file: does not look like Simply Mail settings.', 'error');
        return;
      }
      await storage.setSettings(data as unknown as SimplyMailSettings);
      showToast('Settings imported successfully. Reloading…', 'success');
      setTimeout(() => props.onReload(), 800);
    } catch {
      showToast('Failed to read or parse the file.', 'error');
    }
  }, [props.onReload, showToast]);

  const handleReset = useCallback(() => {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.')) return;
    storage.setSettings(DEFAULT_SETTINGS)
      .then(() => {
        showToast('Settings reset to defaults. Reloading…', 'success');
        setTimeout(() => props.onReload(), 800);
      })
      .catch(() => {
        showToast('Failed to reset settings.', 'error');
      });
  }, [props.onReload, showToast]);

  return (
    <section class="sidebar-card stack-md">
      <div>
        <h2>Data</h2>
        <p class="muted">Backup, restore, or reset your settings.</p>
      </div>

      {toast && (
        <div class={`inline-alert inline-alert-${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      <div class="button-row">
        <button class="secondary" onClick={handleExport}>Export</button>
        <button class="secondary" onClick={handleImport}>Import</button>
        <button class="ghost" onClick={handleReset}>Reset</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        class="visually-hidden-file"
        onChange={handleFileChange}
      />
    </section>
  );
}


function App() {
  const [settings, setSettings] = useState<SimplyMailSettings | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'appearance' | 'navigation' | 'inbox' | 'communication' | 'privacy' | 'debug'>('appearance');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void storage.getSettings().then(setSettings);
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const reload = useCallback(() => {
    void storage.getSettings().then(setSettings);
  }, []);

  const update = useCallback((next: Partial<SimplyMailSettings>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    void storage.patchSettings(next)
      .then((updatedSettings) => {
        setSettings(updatedSettings);
        setSaveState('saved');
        saveTimer.current = setTimeout(() => setSaveState('idle'), 1800);
      })
      .catch(() => {
        setSaveState('error');
      });
  }, []);


  if (!settings) {
    return <main class="page"><section class="hero-card"><h1>Loading settings…</h1></section></main>;
  }

  const tabs = [
    { id: 'appearance', label: 'Appearance', detail: 'Theme, visual polish, and loading' },
    { id: 'navigation', label: 'Navigation', detail: 'Keyboard, palette, and reading pane' },
    { id: 'inbox', label: 'Inbox Management', detail: 'Split inbox, grouping, and batch tools' },
    { id: 'communication', label: 'Communication', detail: 'AI replies, actions, and snippets' },
    { id: 'privacy', label: 'Privacy', detail: 'Tracker blocking and protection' },
    { id: 'debug', label: 'Debug', detail: 'Analytics and diagnostics' },
  ] as const;

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab);
  if (!activeTabMeta) return null;

  const saveStateCopy = {
    idle: { tone: 'neutral', title: 'Autosave ready', detail: 'Changes save immediately.' },
    saving: { tone: 'info', title: 'Saving…', detail: 'Your latest change is being stored.' },
    saved: { tone: 'success', title: 'Saved', detail: 'Settings synced to browser storage.' },
    error: { tone: 'error', title: 'Save failed', detail: 'Retry the last change.' },
  } as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return (
          <section class="panel-card stack-md">
            <div class="section-heading">
              <div>
                <h2>Appearance</h2>
                <p>Make email cleaner, calmer, and easier on the eyes.</p>
              </div>
              <span class="section-chip">Visual polish</span>
            </div>

            <SettingRow
              title="Enable UI cleanup"
              description="Hide noisy interface clutter and soften the email app into a focused workspace."
              checked={settings.uiCleanup.enabled}
              onToggle={() => update({ uiCleanup: { ...settings.uiCleanup, enabled: !settings.uiCleanup.enabled } })}
            />
            <SettingRow
              title="Hide meeting rail"
              description="Remove the meeting entry when it is just taking space."
              checked={settings.uiCleanup.hideMeet}
              disabled={!settings.uiCleanup.enabled}
              disabledReason={!settings.uiCleanup.enabled ? 'Enable UI cleanup first.' : undefined}
              onToggle={() => update({ uiCleanup: { ...settings.uiCleanup, hideMeet: !settings.uiCleanup.hideMeet } })}
            />
            <SettingRow
              title="Hide chat rail"
              description="Suppress the chat rail when the inbox should stay about mail."
              checked={settings.uiCleanup.hideChat}
              disabled={!settings.uiCleanup.enabled}
              disabledReason={!settings.uiCleanup.enabled ? 'Enable UI cleanup first.' : undefined}
              onToggle={() => update({ uiCleanup: { ...settings.uiCleanup, hideChat: !settings.uiCleanup.hideChat } })}
            />
            <SettingRow
              title="Hide collaboration spaces"
              description="Collapse collaboration areas that do not help with inbox triage."
              checked={settings.uiCleanup.hideSpaces}
              disabled={!settings.uiCleanup.enabled}
              disabledReason={!settings.uiCleanup.enabled ? 'Enable UI cleanup first.' : undefined}
              onToggle={() => update({ uiCleanup: { ...settings.uiCleanup, hideSpaces: !settings.uiCleanup.hideSpaces } })}
            />
            <SettingRow
              title="Constrain content width"
              description="Keep long message and list layouts readable on wide screens."
              checked={settings.uiCleanup.constrainWidth}
              disabled={!settings.uiCleanup.enabled}
              disabledReason={!settings.uiCleanup.enabled ? 'Enable UI cleanup first.' : undefined}
              onToggle={() => update({ uiCleanup: { ...settings.uiCleanup, constrainWidth: !settings.uiCleanup.constrainWidth } })}
            />
            <SettingRow
              title="Compact density"
              description="Tighten email row spacing to show more messages at once."
              checked={settings.uiCleanup.compactDensity}
              disabled={!settings.uiCleanup.enabled}
              disabledReason={!settings.uiCleanup.enabled ? 'Enable UI cleanup first.' : undefined}
              onToggle={() => update({ uiCleanup: { ...settings.uiCleanup, compactDensity: !settings.uiCleanup.compactDensity } })}
            />
            <SettingRow
              title="Enable dark mode"
              description="Apply a richer, layered dark theme across email surfaces."
              checked={settings.darkMode.enabled}
              onToggle={() => update({ darkMode: { ...settings.darkMode, enabled: !settings.darkMode.enabled } })}
            />
            <div class={`setting-row${!settings.darkMode.enabled ? ' is-disabled' : ''}`}>
              <div class="setting-copy stack-sm">
                <h3>Dark mode preference</h3>
                <p>Choose whether Simply Mail follows the system, stays light, or stays dark.</p>
                {!settings.darkMode.enabled ? <p class="setting-help">Turn on dark mode to choose a preference.</p> : null}
              </div>
              <div aria-disabled={!settings.darkMode.enabled ? 'true' : undefined}>
                <ThemeModeControl
                  value={settings.darkMode.mode}
                  disabled={!settings.darkMode.enabled}
                  onChange={(mode) => update({ darkMode: { ...settings.darkMode, mode } })}
                />
              </div>
            </div>
            <SettingRow
              title="Invert message bodies"
              description="Useful for bright newsletters inside dark mode. Keep off for maximum fidelity."
              checked={settings.darkMode.invertMessageBodies}
              disabled={!settings.darkMode.enabled}
              disabledReason={!settings.darkMode.enabled ? 'Enable dark mode first.' : undefined}
              onToggle={() => update({ darkMode: { ...settings.darkMode, invertMessageBodies: !settings.darkMode.invertMessageBodies } })}
            />
          </section>
        );
      case 'navigation':
        return (
          <div class="section-stack">
            <section class="panel-card stack-md">
              <div class="section-heading">
                <div>
                  <h2>Focus and navigation</h2>
                  <p>Build a workflow around fast movement, curated views, and keyboard-first control.</p>
                </div>
                <span class="section-chip">Workflow</span>
              </div>

              <SettingRow
                title="Keyboard navigation"
                description="Move with j/k or arrows, archive with e, search with /, and reply with Enter."
                checked={settings.keyboardNavigation.enabled}
                onToggle={() => update({ keyboardNavigation: { ...settings.keyboardNavigation, enabled: !settings.keyboardNavigation.enabled } })}
              />
              <SettingRow
                title="Vim-style motion keys"
                description="Keep j/k available on top of arrow key navigation."
                checked={settings.keyboardNavigation.vimMode}
                disabled={!settings.keyboardNavigation.enabled}
                disabledReason={!settings.keyboardNavigation.enabled ? 'Enable keyboard navigation first.' : undefined}
                onToggle={() => update({ keyboardNavigation: { ...settings.keyboardNavigation, vimMode: !settings.keyboardNavigation.vimMode } })}
              />
              <SettingRow
                title="Command palette"
                description="Launch actions, jump across email app, and search saved views from one overlay."
                checked={settings.commandPalette.enabled}
                onToggle={() => update({ commandPalette: { ...settings.commandPalette, enabled: !settings.commandPalette.enabled } })}
              />
              <SettingRow
                title="Include saved searches in palette"
                description="Surface your sidebar searches inside Cmd/Ctrl + K as first-class commands."
                checked={settings.commandPalette.includeSavedSearches}
                disabled={!settings.commandPalette.enabled || !settings.savedSearches.enabled}
                disabledReason={!settings.commandPalette.enabled ? 'Enable the command palette first.' : !settings.savedSearches.enabled ? 'Turn on saved searches first.' : undefined}
                onToggle={() => update({ commandPalette: { ...settings.commandPalette, includeSavedSearches: !settings.commandPalette.includeSavedSearches } })}
              />
              <SettingRow
                title="Saved-searches rail"
                description="Inject a shortcut block into the mail sidebar."
                checked={settings.savedSearches.enabled}
                onToggle={() => update({ savedSearches: { ...settings.savedSearches, enabled: !settings.savedSearches.enabled } })}
              />
              <SettingRow
                title="Show saved searches in sidebar"
                description="Keep shortcut chips visible in the left rail instead of palette-only."
                checked={settings.savedSearches.showInSidebar}
                disabled={!settings.savedSearches.enabled}
                disabledReason={!settings.savedSearches.enabled ? 'Turn on saved searches first.' : undefined}
                onToggle={() => update({ savedSearches: { ...settings.savedSearches, showInSidebar: !settings.savedSearches.showInSidebar } })}
              />
              <SettingRow
                title="Split inbox tabs"
                description="Pin focus tabs above the inbox using mail search as the filtering engine."
                checked={settings.splitInboxSettings.enabled}
                onToggle={() => update({ splitInboxSettings: { ...settings.splitInboxSettings, enabled: !settings.splitInboxSettings.enabled } })}
              />
              <SettingRow
                title="Show tab counts"
                description="Display a visible badge for the currently active focus view."
                checked={settings.splitInboxSettings.showCounts}
                disabled={!settings.splitInboxSettings.enabled}
                disabledReason={!settings.splitInboxSettings.enabled ? 'Enable split inbox tabs first.' : undefined}
                onToggle={() => update({ splitInboxSettings: { ...settings.splitInboxSettings, showCounts: !settings.splitInboxSettings.showCounts } })}
              />
              <SettingRow
                title="Inbox Zero celebration"
                description="Keep the empty-state delight ready for the next inbox-zero pass."
                checked={settings.inboxZero.enabled}
                onToggle={() => update({ inboxZero: { ...settings.inboxZero, enabled: !settings.inboxZero.enabled } })}
              />
              <SettingRow
                title="Show Inbox Zero state on empty searches"
                description="Use the celebratory state for saved views and filtered inboxes too."
                checked={settings.inboxZero.showWhenEmptySearch}
                disabled={!settings.inboxZero.enabled}
                disabledReason={!settings.inboxZero.enabled ? 'Enable Inbox Zero celebration first.' : undefined}
                onToggle={() => update({ inboxZero: { ...settings.inboxZero, showWhenEmptySearch: !settings.inboxZero.showWhenEmptySearch } })}
              />
              <SettingRow
                title="Smart Actions"
                description="Hover over email rows for quick actions: archive, delete, snooze, mark read, star, and more."
                checked={settings.smartActions.enabled}
                onToggle={() => update({ smartActions: { ...settings.smartActions, enabled: !settings.smartActions.enabled } })}
              />
              <SettingRow
                title="Show actions on hover"
                description="Reveal action buttons when you mouse over a conversation row."
                checked={settings.smartActions.showOnHover}
                disabled={!settings.smartActions.enabled}
                disabledReason={!settings.smartActions.enabled ? 'Enable Smart Actions first.' : undefined}
                onToggle={() => update({ smartActions: { ...settings.smartActions, showOnHover: !settings.smartActions.showOnHover } })}
              />
              <div class={`setting-row${!settings.smartActions.enabled || !settings.smartActions.showOnHover ? ' is-disabled' : ''}`}>
                <div class="setting-copy stack-sm">
                  <h3>Action position</h3>
                  <p>Choose whether smart actions appear inline inside the row or as a floating toolbar.</p>
                  {!settings.smartActions.enabled || !settings.smartActions.showOnHover ? <p class="setting-help">Enable Smart Actions and hover mode to choose a position.</p> : null}
                </div>
                <div aria-disabled={!settings.smartActions.enabled || !settings.smartActions.showOnHover ? 'true' : undefined}>
                  <SmartActionsPositionControl
                    value={settings.smartActions.position}
                    disabled={!settings.smartActions.enabled || !settings.smartActions.showOnHover}
                    onChange={(position) => update({ smartActions: { ...settings.smartActions, position } })}
                  />
                </div>
              </div>
            </section>

            <SplitTabsEditor tabs={settings.splitTabs} onChange={(splitTabs) => update({ splitTabs })} />
            <SavedSearchesEditor searches={settings.savedSearchesList} onChange={(savedSearchesList) => update({ savedSearchesList })} />
          </div>
        );
      case 'privacy':
        return (
          <section class="panel-card stack-md">
            <div class="section-heading">
              <div>
                <h2>Privacy</h2>
                <p>Block trackers and keep your reading habits private.</p>
              </div>
              <span class="section-chip">Protection</span>
            </div>

            <SettingRow
              title="Block tracking pixels"
              description="Prevent email senders from knowing when you open messages."
              checked={settings.trackerBlocker.enabled}
              onToggle={() => update({ trackerBlocker: { ...settings.trackerBlocker, enabled: !settings.trackerBlocker.enabled } })}
            />
            <SettingRow
              title="Block known tracker domains"
              description="Stop images loaded from known analytics and tracking services."
              checked={settings.trackerBlocker.blockKnownDomains}
              disabled={!settings.trackerBlocker.enabled}
              disabledReason={!settings.trackerBlocker.enabled ? 'Turn on tracker blocking first.' : undefined}
              onToggle={() => update({ trackerBlocker: { ...settings.trackerBlocker, blockKnownDomains: !settings.trackerBlocker.blockKnownDomains } })}
            />
            <SettingRow
              title="Block tiny images"
              description="Remove 1x1 and similarly small images commonly used as beacons."
              checked={settings.trackerBlocker.blockTinyImages}
              disabled={!settings.trackerBlocker.enabled}
              disabledReason={!settings.trackerBlocker.enabled ? 'Turn on tracker blocking first.' : undefined}
              onToggle={() => update({ trackerBlocker: { ...settings.trackerBlocker, blockTinyImages: !settings.trackerBlocker.blockTinyImages } })}
            />
          </section>
        );
      case 'communication':
        return (
          <div class="section-stack">
            <AiSettingsSection settings={settings} update={update} />
            <SnippetsEditor snippets={settings.snippets} onChange={(snippets) => update({ snippets })} />
            <section class="panel-card stack-md">
              <div class="section-heading">
                <div>
                  <h2>Compose automation</h2>
                  <p>Automatically add CC and BCC recipients to outgoing mail.</p>
                </div>
                <span class="section-chip">Automation</span>
              </div>

              <SettingRow
                title="Auto CC/BCC"
                description="Add predefined recipients to every composed or replied message."
                checked={settings.autoCcBcc.enabled}
                onToggle={() => update({ autoCcBcc: { ...settings.autoCcBcc, enabled: !settings.autoCcBcc.enabled } })}
              />
              <MultilineEditor
                title="CC list"
                description="One address per line. Invalid addresses are ignored when you save."
                values={settings.autoCcBcc.cc}
                placeholder={'team@example.com\nmanager@example.com'}
                saveLabel="Save CC list"
                emptyState="No CC addresses configured."
                emailsOnly
                onSave={(cc) => update({ autoCcBcc: { ...settings.autoCcBcc, cc } })}
              />
              <MultilineEditor
                title="BCC list"
                description="One address per line. Keep this list small to avoid surprise recipients."
                values={settings.autoCcBcc.bcc}
                placeholder={'archive@example.com\naudit@example.com'}
                saveLabel="Save BCC list"
                emptyState="No BCC addresses configured."
                emailsOnly
                onSave={(bcc) => update({ autoCcBcc: { ...settings.autoCcBcc, bcc } })}
              />
              <div class={`setting-row${!settings.autoCcBcc.enabled ? ' is-disabled' : ''}`} aria-disabled={!settings.autoCcBcc.enabled ? 'true' : undefined}>
                <div class="setting-copy">
                  <h3>Apply mode</h3>
                  <p>Choose which messages get automatic CC/BCC recipients.</p>
                  {!settings.autoCcBcc.enabled ? <p class="setting-help">Turn on Auto CC/BCC to choose when it runs.</p> : null}
                </div>
                <div aria-disabled={!settings.autoCcBcc.enabled ? 'true' : undefined}>
                  <AutoCcBccModeControl
                    value={settings.autoCcBcc.mode}
                    disabled={!settings.autoCcBcc.enabled}
                    onChange={(mode) => update({ autoCcBcc: { ...settings.autoCcBcc, mode } })}
                  />
                </div>
              </div>
            </section>
          </div>
        );
      case 'debug':
        return (
          <div class="section-stack">
            <section class="panel-card stack-md">
              <div class="section-heading">
                <div>
                  <h2>Email analytics</h2>
                  <p>Keep weekly digest value without turning local analytics into clutter.</p>
                </div>
                <span class="section-chip">Reflection</span>
              </div>

              <SettingRow
                title="Enable weekly digest"
                description="Track inbox activity locally and surface a lightweight weekly summary banner."
                checked={settings.emailAnalytics.enabled}
                onToggle={() => update({ emailAnalytics: { ...settings.emailAnalytics, enabled: !settings.emailAnalytics.enabled } })}
              />
              <div class={`setting-row setting-row-compact${!settings.emailAnalytics.enabled ? ' is-disabled' : ''}`}>
                <div class="setting-copy stack-sm">
                  <h3>Retention window</h3>
                  <p>How long local analytics events should stay available for digesting.</p>
                  {!settings.emailAnalytics.enabled ? <p class="setting-help">Enable weekly digest to adjust retention.</p> : null}
                </div>
                <label class="stack-sm settings-number-field">
                  <span class="muted">Days</span>
                  <input
                    class="text-input"
                    type="number"
                    min={30}
                    max={365}
                    disabled={!settings.emailAnalytics.enabled}
                    value={settings.emailAnalytics.retentionDays}
                    onInput={(event) => update({
                      emailAnalytics: {
                        ...settings.emailAnalytics,
                        retentionDays: clampNumber(Number((event.target as HTMLInputElement).value || settings.emailAnalytics.retentionDays), 30, 365),
                      },
                    })}
                  />
                </label>
              </div>
            </section>
          </div>
        );
      case 'inbox':
        return (
          <section class="panel-card stack-md">
            <div class="section-heading">
              <div>
                <h2>Inbox organization</h2>
                <p>Group messages by date and control inbox availability.</p>
              </div>
              <span class="section-chip">Organization</span>
            </div>

            <SettingRow
              title="Group by date"
              description="Cluster inbox messages into Today, Yesterday, and earlier groups."
              checked={settings.groupByDate.enabled}
              onToggle={() => update({ groupByDate: { ...settings.groupByDate, enabled: !settings.groupByDate.enabled } })}
            />
            <SettingRow
              title="Pause inbox overlay"
              description="Temporarily hide incoming mail behind a focused overlay."
              checked={settings.pauseInbox.enabled}
              onToggle={() => update({ pauseInbox: { ...settings.pauseInbox, enabled: !settings.pauseInbox.enabled } })}
            />
            <SettingRow
              title="Hide inbox when paused"
              description="Completely conceal the inbox list while the pause is active."
              checked={settings.pauseInbox.hideInboxWhenPaused}
              disabled={!settings.pauseInbox.enabled}
              disabledReason={!settings.pauseInbox.enabled ? 'Enable pause inbox overlay first.' : undefined}
              onToggle={() => update({ pauseInbox: { ...settings.pauseInbox, hideInboxWhenPaused: !settings.pauseInbox.hideInboxWhenPaused } })}
            />
            <SettingRow
              title="Mute notifications"
              description="Silence desktop notifications while the inbox is paused."
              checked={settings.pauseInbox.muteNotifications}
              disabled={!settings.pauseInbox.enabled}
              disabledReason={!settings.pauseInbox.enabled ? 'Enable pause inbox overlay first.' : undefined}
              onToggle={() => update({ pauseInbox: { ...settings.pauseInbox, muteNotifications: !settings.pauseInbox.muteNotifications } })}
            />
          </section>
        );
    }
  };

  return (
    <main class="page settings-page" role="main">
      <div class="settings-layout">
        <aside class="settings-sidebar">
          <div class="settings-brand">
            <p class="kicker settings-kicker">Simply Mail Settings</p>
            <h1 class="settings-title">Configuration</h1>
          </div>
          <div class="settings-tab-list" role="tablist" aria-label="Settings categories">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                class={`settings-sidebar-link ${activeTab === tab.id ? 'is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <DataManagement settings={settings} onReload={reload} />
        </aside>

        <div class="section-stack settings-content">
          <div class="settings-content-header">
            <div class="settings-content-title">
              <h2>{activeTabMeta.label}</h2>
              <p>{activeTabMeta.detail}</p>
            </div>
            <div class="settings-status-row">
              <span class="status-chip" data-state={settings.paused ? 'paused' : 'active'}>{settings.paused ? 'Paused' : 'Active'}</span>
              <span class={`status-chip status-chip-${saveStateCopy[saveState].tone}`}>{saveStateCopy[saveState].title}</span>
            </div>
          </div>
          <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} aria-label={activeTabMeta.label}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </main>
  );
}

const appRoot = document.getElementById('app');
if (appRoot) render(<App />, appRoot);

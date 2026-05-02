import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/constants';
import { mergeSettings, storage } from '@/shared/storage';

describe('mergeSettings', () => {
  it('clones collection defaults so callers cannot mutate shared defaults', () => {
    const settings = mergeSettings();

    settings.splitTabs[0]!.label = 'Changed';
    settings.snippets[0]!.trigger = ';changed';

    expect(DEFAULT_SETTINGS.splitTabs[0]!.label).toBe('Important');
    expect(DEFAULT_SETTINGS.snippets[0]!.trigger).toBe(';thanks');
  });

  it('merges smart action and analytics settings instead of dropping them', () => {
    const settings = mergeSettings({
      smartActions: { enabled: false, position: 'floating' } as Partial<(typeof DEFAULT_SETTINGS)['smartActions']> as typeof DEFAULT_SETTINGS.smartActions,
      emailAnalytics: { retentionDays: 30 } as Partial<(typeof DEFAULT_SETTINGS)['emailAnalytics']> as typeof DEFAULT_SETTINGS.emailAnalytics,
      readingPane: { enabled: true } as Partial<(typeof DEFAULT_SETTINGS)['readingPane']> as typeof DEFAULT_SETTINGS.readingPane,
      inboxSummary: { enabled: true } as Partial<(typeof DEFAULT_SETTINGS)['inboxSummary']> as typeof DEFAULT_SETTINGS.inboxSummary,
    });

    expect(settings.smartActions).toMatchObject({
      enabled: false,
      showOnHover: DEFAULT_SETTINGS.smartActions.showOnHover,
      position: 'floating',
    });
    expect(settings.emailAnalytics).toMatchObject({
      enabled: DEFAULT_SETTINGS.emailAnalytics.enabled,
      retentionDays: 30,
    });
    expect(settings.readingPane).toMatchObject({
      enabled: true,
      position: DEFAULT_SETTINGS.readingPane.position,
      trigger: DEFAULT_SETTINGS.readingPane.trigger,
    });
    expect(settings.inboxSummary).toMatchObject({
      enabled: true,
      showTrackers: DEFAULT_SETTINGS.inboxSummary.showTrackers,
      showStreak: DEFAULT_SETTINGS.inboxSummary.showStreak,
    });
  });
});

describe('storage', () => {
  function stubLocalStorage() {
    const store = new Map<string, string>();
    const localStorageStub = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key);
      }),
    };

    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('localStorage', localStorageStub);
    return { store };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to defaults when local settings JSON is malformed', async () => {
    const { store } = stubLocalStorage();
    store.set(STORAGE_KEYS.settings, '{bad json');

    await expect(storage.getSettings()).resolves.toMatchObject(DEFAULT_SETTINGS);
  });

  it('falls back to an empty snoozed queue when stored JSON is malformed', async () => {
    const { store } = stubLocalStorage();
    store.set(STORAGE_KEYS.snoozed, '{bad json');

    await expect(storage.getSnoozedItems()).resolves.toEqual([]);
  });

  it('only notifies local listeners for the settings storage key', async () => {
    const { store } = stubLocalStorage();
    const listener = vi.fn();
    let storageHandler: ((event: StorageEvent) => void) | undefined;
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'storage') {
        storageHandler = handler as (event: StorageEvent) => void;
      }
    });
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => undefined);
    const unsubscribe = storage.onSettingsChanged(listener);

    store.set(STORAGE_KEYS.settings, JSON.stringify({ paused: true }));
    storageHandler?.({ key: STORAGE_KEYS.snoozed } as StorageEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).not.toHaveBeenCalled();

    storageHandler?.({ key: STORAGE_KEYS.settings } as StorageEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(removeEventListenerSpy).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('patchSettings merges nested setting objects instead of replacing them', async () => {
    const { store } = stubLocalStorage();
    store.set(
      STORAGE_KEYS.settings,
      JSON.stringify({
        darkMode: { enabled: true, mode: 'dark', invertMessageBodies: false },
      }),
    );

    const next = await storage.patchSettings({
      darkMode: { invertMessageBodies: true } as Partial<(typeof DEFAULT_SETTINGS)['darkMode']> as typeof DEFAULT_SETTINGS.darkMode,
    });

    expect(next.darkMode).toMatchObject({ enabled: true, mode: 'dark', invertMessageBodies: true });
  });

  it('patchSettings preserves and updates smart action and analytics settings', async () => {
    const { store } = stubLocalStorage();
    store.set(
      STORAGE_KEYS.settings,
      JSON.stringify({
        smartActions: { enabled: true, showOnHover: true, position: 'inline' },
        emailAnalytics: { enabled: true, retentionDays: 90 },
      }),
    );

    const next = await storage.patchSettings({
      smartActions: { position: 'floating' } as Partial<(typeof DEFAULT_SETTINGS)['smartActions']> as typeof DEFAULT_SETTINGS.smartActions,
      emailAnalytics: { retentionDays: 30 } as Partial<(typeof DEFAULT_SETTINGS)['emailAnalytics']> as typeof DEFAULT_SETTINGS.emailAnalytics,
    });

    expect(next.smartActions).toMatchObject({ enabled: true, showOnHover: true, position: 'floating' });
    expect(next.emailAnalytics).toMatchObject({ enabled: true, retentionDays: 30 });
  });

  it('patchSettings preserves newer nested feature defaults', async () => {
    const { store } = stubLocalStorage();
    store.set(
      STORAGE_KEYS.settings,
      JSON.stringify({
        readingPane: { enabled: false, position: 'right', trigger: 'select' },
        inboxSummary: { enabled: false, showTrackers: true, showStreak: true },
      }),
    );

    const next = await storage.patchSettings({
      readingPane: { enabled: true } as Partial<(typeof DEFAULT_SETTINGS)['readingPane']> as typeof DEFAULT_SETTINGS.readingPane,
      inboxSummary: { showStreak: false } as Partial<(typeof DEFAULT_SETTINGS)['inboxSummary']> as typeof DEFAULT_SETTINGS.inboxSummary,
    });

    expect(next.readingPane).toMatchObject({ enabled: true, position: 'right', trigger: 'select' });
    expect(next.inboxSummary).toMatchObject({ enabled: false, showTrackers: true, showStreak: false });
  });
});

import { DEFAULT_RUNTIME_STATS, DEFAULT_SETTINGS, STORAGE_KEYS } from './constants';
import type { ReminderItem, RuntimeStats, SimplyMailSettings, SnoozedItem, StorageLike } from './types';

function hasbrowserStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function mergeSettings(partial?: Partial<SimplyMailSettings>): SimplyMailSettings {
  if (!partial) {
    return {
      ...DEFAULT_SETTINGS,
      splitTabs: DEFAULT_SETTINGS.splitTabs.map((tab) => ({ ...tab })),
      savedSearchesList: DEFAULT_SETTINGS.savedSearchesList.map((search) => ({ ...search })),
      snippets: DEFAULT_SETTINGS.snippets.map((snippet) => ({ ...snippet })),
    };
  }

  // Fast path: if only top-level scalar fields changed, skip deep spread
  const hasNestedChanges = (
    partial.uiCleanup || partial.darkMode || partial.keyboardNavigation ||
    partial.commandPalette || partial.savedSearches || partial.splitInboxSettings ||
    partial.pauseInbox || partial.groupByDate || partial.inboxZero ||
    partial.trackerBlocker || partial.autoCcBcc || partial.ai || partial.instantReply ||
    partial.smartActions || partial.emailAnalytics ||
    partial.inboxSummary || partial.batchActions || partial.readingPane ||
    partial.scrollProgress || partial.rowAnimations || partial.skeletonLoading ||
    partial.senderAvatars || partial.priorityBadges || partial.attachmentChips ||
    partial.splitTabs || partial.savedSearchesList || partial.snippets
  );

  if (!hasNestedChanges) {
    return {
      ...DEFAULT_SETTINGS,
      ...partial,
      splitTabs: DEFAULT_SETTINGS.splitTabs.map((tab) => ({ ...tab })),
      savedSearchesList: DEFAULT_SETTINGS.savedSearchesList.map((search) => ({ ...search })),
      snippets: DEFAULT_SETTINGS.snippets.map((snippet) => ({ ...snippet })),
    };
  }

  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    uiCleanup: { ...DEFAULT_SETTINGS.uiCleanup, ...partial?.uiCleanup },
    darkMode: { ...DEFAULT_SETTINGS.darkMode, ...partial?.darkMode },
    keyboardNavigation: { ...DEFAULT_SETTINGS.keyboardNavigation, ...partial?.keyboardNavigation },
    commandPalette: { ...DEFAULT_SETTINGS.commandPalette, ...partial?.commandPalette },
    savedSearches: { ...DEFAULT_SETTINGS.savedSearches, ...partial?.savedSearches },
    splitInboxSettings: { ...DEFAULT_SETTINGS.splitInboxSettings, ...partial?.splitInboxSettings },
    pauseInbox: { ...DEFAULT_SETTINGS.pauseInbox, ...partial?.pauseInbox },
    groupByDate: { ...DEFAULT_SETTINGS.groupByDate, ...partial?.groupByDate },
    inboxZero: { ...DEFAULT_SETTINGS.inboxZero, ...partial?.inboxZero },
    trackerBlocker: { ...DEFAULT_SETTINGS.trackerBlocker, ...partial?.trackerBlocker },
    autoCcBcc: {
      ...DEFAULT_SETTINGS.autoCcBcc,
      ...partial?.autoCcBcc,
      cc: [...(partial?.autoCcBcc?.cc ?? DEFAULT_SETTINGS.autoCcBcc.cc)],
      bcc: [...(partial?.autoCcBcc?.bcc ?? DEFAULT_SETTINGS.autoCcBcc.bcc)],
    },
    ai: { ...DEFAULT_SETTINGS.ai, ...partial?.ai },
    instantReply: { ...DEFAULT_SETTINGS.instantReply, ...partial?.instantReply },
    smartActions: { ...DEFAULT_SETTINGS.smartActions, ...partial?.smartActions },
    emailAnalytics: { ...DEFAULT_SETTINGS.emailAnalytics, ...partial?.emailAnalytics },
    inboxSummary: { ...DEFAULT_SETTINGS.inboxSummary, ...partial?.inboxSummary },
    batchActions: { ...DEFAULT_SETTINGS.batchActions, ...partial?.batchActions },
    readingPane: { ...DEFAULT_SETTINGS.readingPane, ...partial?.readingPane },
    scrollProgress: { ...DEFAULT_SETTINGS.scrollProgress, ...partial?.scrollProgress },
    rowAnimations: { ...DEFAULT_SETTINGS.rowAnimations, ...partial?.rowAnimations },
    skeletonLoading: { ...DEFAULT_SETTINGS.skeletonLoading, ...partial?.skeletonLoading },
    senderAvatars: { ...DEFAULT_SETTINGS.senderAvatars, ...partial?.senderAvatars },
    priorityBadges: { ...DEFAULT_SETTINGS.priorityBadges, ...partial?.priorityBadges },
    attachmentChips: { ...DEFAULT_SETTINGS.attachmentChips, ...partial?.attachmentChips },
    splitTabs: (partial?.splitTabs ?? DEFAULT_SETTINGS.splitTabs).map((tab) => ({ ...tab })),
    savedSearchesList: (partial?.savedSearchesList ?? DEFAULT_SETTINGS.savedSearchesList).map((search) => ({ ...search })),
    snippets: (partial?.snippets ?? DEFAULT_SETTINGS.snippets).map((snippet) => ({ ...snippet })),
  };
}

async function getLocalStorageSettings(): Promise<SimplyMailSettings> {
  return mergeSettings(parseJson<Partial<SimplyMailSettings>>(localStorage.getItem(STORAGE_KEYS.settings)));
}

async function setLocalStorageSettings(settings: SimplyMailSettings): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

async function getStoredValue<T>(key: string, fallback: T): Promise<T> {
  if (hasbrowserStorage()) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? fallback;
  }

  const raw = localStorage.getItem(key);
  return parseJson<T>(raw) ?? fallback;
}

async function setStoredValue<T>(key: string, value: T): Promise<void> {
  if (hasbrowserStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export const storage: StorageLike = {
  async getSettings() {
    if (hasbrowserStorage()) {
      const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
      return mergeSettings(result[STORAGE_KEYS.settings] as Partial<SimplyMailSettings> | undefined);
    }

    return getLocalStorageSettings();
  },

  async setSettings(settings) {
    const next = mergeSettings(settings);
    if (hasbrowserStorage()) {
      await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
      return;
    }

    await setLocalStorageSettings(next);
  },

  async patchSettings(patch) {
    const current = await this.getSettings();
    const next = mergeSettings({
      ...current,
      ...patch,
      uiCleanup: { ...current.uiCleanup, ...patch.uiCleanup },
      darkMode: { ...current.darkMode, ...patch.darkMode },
      keyboardNavigation: { ...current.keyboardNavigation, ...patch.keyboardNavigation },
      commandPalette: { ...current.commandPalette, ...patch.commandPalette },
      savedSearches: { ...current.savedSearches, ...patch.savedSearches },
      splitInboxSettings: { ...current.splitInboxSettings, ...patch.splitInboxSettings },
      pauseInbox: { ...current.pauseInbox, ...patch.pauseInbox },
      groupByDate: { ...current.groupByDate, ...patch.groupByDate },
      inboxZero: { ...current.inboxZero, ...patch.inboxZero },
      trackerBlocker: { ...current.trackerBlocker, ...patch.trackerBlocker },
      autoCcBcc: {
        ...current.autoCcBcc,
        ...patch.autoCcBcc,
        cc: [...(patch.autoCcBcc?.cc ?? current.autoCcBcc.cc)],
        bcc: [...(patch.autoCcBcc?.bcc ?? current.autoCcBcc.bcc)],
      },
      ai: { ...current.ai, ...patch.ai },
      instantReply: { ...current.instantReply, ...patch.instantReply },
      smartActions: { ...current.smartActions, ...patch.smartActions },
      emailAnalytics: { ...current.emailAnalytics, ...patch.emailAnalytics },
      inboxSummary: { ...current.inboxSummary, ...patch.inboxSummary },
      batchActions: { ...current.batchActions, ...patch.batchActions },
      readingPane: { ...current.readingPane, ...patch.readingPane },
      scrollProgress: { ...current.scrollProgress, ...patch.scrollProgress },
      rowAnimations: { ...current.rowAnimations, ...patch.rowAnimations },
      skeletonLoading: { ...current.skeletonLoading, ...patch.skeletonLoading },
      senderAvatars: { ...current.senderAvatars, ...patch.senderAvatars },
      priorityBadges: { ...current.priorityBadges, ...patch.priorityBadges },
      attachmentChips: { ...current.attachmentChips, ...patch.attachmentChips },
    });
    await this.setSettings(next);
    return next;
  },

  async getSnoozedItems() {
    return getStoredValue<SnoozedItem[]>(STORAGE_KEYS.snoozed, []);
  },

  async setSnoozedItems(items) {
    await setStoredValue(STORAGE_KEYS.snoozed, items);
  },

  async getReminderItems() {
    return getStoredValue<ReminderItem[]>(STORAGE_KEYS.reminders, []);
  },

  async setReminderItems(items) {
    await setStoredValue(STORAGE_KEYS.reminders, items);
  },

  async getStats() {
    return getStoredValue<RuntimeStats>(STORAGE_KEYS.stats, DEFAULT_RUNTIME_STATS);
  },

  async setStats(stats) {
    await setStoredValue(STORAGE_KEYS.stats, stats);
  },

  onSettingsChanged(listener) {
    if (hasbrowserStorage()) {
      const callback = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName !== 'local' || !changes[STORAGE_KEYS.settings]) {
          return;
        }

        listener(mergeSettings(changes[STORAGE_KEYS.settings].newValue as Partial<SimplyMailSettings> | undefined));
      };

      chrome.storage.onChanged.addListener(callback);
      return () => chrome.storage.onChanged.removeListener(callback);
    }

    const callback = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.settings) {
        return;
      }

      if (event.storageArea && event.storageArea !== localStorage) {
        return;
      }

      void this.getSettings().then(listener);
    };

    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  },
};

export { mergeSettings };

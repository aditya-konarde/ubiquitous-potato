export type MailView = 'inbox' | 'thread' | 'compose' | 'search' | 'label' | 'sent' | 'drafts' | 'starred' | 'trash' | 'spam' | 'scheduled' | 'allMail' | 'unknown';

export type ToggleableModuleName =
  | 'uiCleanup'
  | 'darkMode'
  | 'keyboardNavigation'
  | 'commandPalette'
  | 'savedSearches'
  | 'splitInbox'
  | 'pauseInbox'
  | 'groupByDate'
  | 'inboxZero'
  | 'trackerBlocker'
  | 'autoCcBcc'
  | 'instantReply'
  | 'smartActions'
  | 'emailAnalytics'
  | 'snippetExpansion'
  | 'inboxSummary'
  | 'readingPane'
  | 'batchActions'
  | 'scrollProgress'
  | 'rowAnimations'
  | 'senderAvatars'
  | 'priorityBadges'
  | 'attachmentChips'
  | 'skeletonLoading';

export interface SplitTab {
  id: string;
  label: string;
  query: string;
}

export interface SavedSearch {
  id: string;
  label: string;
  query: string;
}

export interface Snippet {
  id: string;
  trigger: string;
  body: string;
}

export interface ReminderItem {
  id: string;
  threadId: string;
  subject: string;
  checkAt: number;
}

export interface SnoozedItem {
  id: string;
  threadId: string;
  subject: string;
  resumeAt: number;
}

export interface RuntimeStats {
  trackersBlockedToday: number;
  snoozedCount: number;
  reminderCount: number;
}

export interface UiCleanupSettings {
  enabled: boolean;
  hideMeet: boolean;
  hideChat: boolean;
  hideSpaces: boolean;
  constrainWidth: boolean;
  compactDensity: boolean;
}

export interface DarkModeSettings {
  enabled: boolean;
  mode: 'system' | 'light' | 'dark';
  invertMessageBodies: boolean;
}

export interface KeyboardNavigationSettings {
  enabled: boolean;
  vimMode: boolean;
}

export interface CommandPaletteSettings {
  enabled: boolean;
  includeSavedSearches: boolean;
}

export interface SavedSearchesSettings {
  enabled: boolean;
  showInSidebar: boolean;
}

export interface SplitInboxSettings {
  enabled: boolean;
  showCounts: boolean;
}

export interface PauseInboxSettings {
  enabled: boolean;
  hideInboxWhenPaused: boolean;
  muteNotifications: boolean;
}

export interface GroupByDateSettings {
  enabled: boolean;
}

export interface InboxZeroSettings {
  enabled: boolean;
  showWhenEmptySearch: boolean;
}

export interface TrackerBlockerSettings {
  enabled: boolean;
  blockKnownDomains: boolean;
  blockTinyImages: boolean;
}

export interface AutoCcBccSettings {
  enabled: boolean;
  cc: string[];
  bcc: string[];
  mode: 'new' | 'reply' | 'both';
}

export interface AiSettings {
  enabled: boolean;
  provider: 'openai' | 'anthropic' | 'openrouter';
  apiKey: string;
  model: string;
}

export interface InstantReplySettings {
  enabled: boolean;
  skipCalendarInvites: boolean;
  skipPromotions: boolean;
}

export interface SmartActionsSettings {
  enabled: boolean;
  showOnHover: boolean;
  position: 'inline' | 'floating';
}

export interface EmailAnalyticsSettings {
  enabled: boolean;
  retentionDays: number;
}

export interface BatchActionsSettings {
  enabled: boolean;
  position: 'bottom' | 'top';
}

export interface ReadingPaneSettings {
  enabled: boolean;
  position: 'right' | 'bottom';
  trigger: 'hover' | 'select';
}

export interface InboxSummarySettings {
  enabled: boolean;
  showTrackers: boolean;
  showStreak: boolean;
}

export interface ScrollProgressSettings {
  enabled: boolean;
  height: 2 | 3 | 4;
}

export interface RowAnimationsSettings {
  enabled: boolean;
  staggerMs: number;
}

export interface SkeletonLoadingSettings {
  enabled: boolean;
  rowCount: number;
}

export interface SenderAvatarsSettings {
  enabled: boolean;
}

export interface PriorityBadgesSettings {
  enabled: boolean;
}

export interface AttachmentChipsSettings {
  enabled: boolean;
}

export interface SimplyMailSettings {
  uiCleanup: UiCleanupSettings;
  darkMode: DarkModeSettings;
  keyboardNavigation: KeyboardNavigationSettings;
  commandPalette: CommandPaletteSettings;
  savedSearches: SavedSearchesSettings;
  splitInboxSettings: SplitInboxSettings;
  pauseInbox: PauseInboxSettings;
  groupByDate: GroupByDateSettings;
  inboxZero: InboxZeroSettings;
  trackerBlocker: TrackerBlockerSettings;
  autoCcBcc: AutoCcBccSettings;
  ai: AiSettings;
  instantReply: InstantReplySettings;
  smartActions: SmartActionsSettings;
  emailAnalytics: EmailAnalyticsSettings;
  inboxSummary: InboxSummarySettings;
  batchActions: BatchActionsSettings;
  readingPane: ReadingPaneSettings;
  scrollProgress: ScrollProgressSettings;
  rowAnimations: RowAnimationsSettings;
  skeletonLoading: SkeletonLoadingSettings;
  senderAvatars: SenderAvatarsSettings;
  priorityBadges: PriorityBadgesSettings;
  attachmentChips: AttachmentChipsSettings;
  splitTabs: SplitTab[];
  savedSearchesList: SavedSearch[];
  snippets: Snippet[];
  paused: boolean;
  installedAt: number;
  onboarded: boolean;
}

export interface CommandDefinition {
  id: string;
  title: string;
  keywords?: string[];
  group?: string;
  run: () => void;
}

export interface ModuleContext {
  observer: MailObserverLike;
  settings: SimplyMailSettings;
  storage: StorageLike;
  commandPalette: CommandPaletteRegistryLike;
}

export interface SimplyMailModule {
  name: ToggleableModuleName;
  init: (context: ModuleContext) => void | Promise<void>;
  destroy: () => void | Promise<void>;
  onSettingsChange?: (settings: SimplyMailSettings, context: ModuleContext) => void | Promise<void>;
}

export interface MailObserverEventMap {
  'view-changed': { view: MailView; hash: string };
  'compose-detected': { node: Element | null };
  'thread-detected': { node: Element | null };
  'inbox-updated': { rows: Element[] };
}

export interface MailObserverLike {
  start: () => void;
  stop: () => void;
  getCurrentView: () => MailView;
  on: <TEvent extends keyof MailObserverEventMap>(
    event: TEvent,
    handler: (payload: MailObserverEventMap[TEvent]) => void,
  ) => () => void;
}

export interface StorageLike {
  getSettings: () => Promise<SimplyMailSettings>;
  setSettings: (settings: SimplyMailSettings) => Promise<void>;
  patchSettings: (patch: Partial<SimplyMailSettings>) => Promise<SimplyMailSettings>;
  getSnoozedItems: () => Promise<SnoozedItem[]>;
  setSnoozedItems: (items: SnoozedItem[]) => Promise<void>;
  getReminderItems: () => Promise<ReminderItem[]>;
  setReminderItems: (items: ReminderItem[]) => Promise<void>;
  getStats: () => Promise<RuntimeStats>;
  setStats: (stats: RuntimeStats) => Promise<void>;
  onSettingsChanged: (listener: (settings: SimplyMailSettings) => void) => () => void;
}

export interface CommandPaletteRegistryLike {
  registerCommands: (moduleName: string, commands: CommandDefinition[]) => void;
  unregisterCommands: (moduleName: string) => void;
}

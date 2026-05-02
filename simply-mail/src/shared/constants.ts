import type { RuntimeStats, SavedSearch, SimplyMailSettings } from './types';

export const STORAGE_KEYS = {
  settings: 'simply-mail-settings',
  snoozed: 'simply-mail-snoozed',
  reminders: 'simply-mail-reminders',
  stats: 'simply-mail-stats',
} as const;

export const DEFAULT_SPLIT_TABS = [
  { id: 'important', label: 'Important', query: 'is:important' },
  { id: 'other', label: 'Other', query: '-is:important in:inbox' },
  { id: 'starred', label: 'Starred', query: 'is:starred' },
];

export const DEFAULT_SAVED_SEARCHES: SavedSearch[] = [
  { id: 'unread', label: 'Unread', query: 'is:unread' },
  { id: 'attachments', label: 'Attachments', query: 'has:attachment' },
  { id: 'travel', label: 'Travel', query: '(from:airbnb OR from:delta OR from:united OR label:travel)' },
  { id: 'purchases', label: 'Purchases', query: '(receipt OR order OR shipped OR delivered)' },
  { id: 'pdfs', label: 'PDFs', query: 'filename:pdf' },
  { id: 'photos', label: 'Photos', query: 'has:attachment (filename:jpg OR filename:png)' },
  { id: 'newsletters', label: 'Newsletters', query: '(unsubscribe OR label:^smartlabel_promo)' },
  { id: 'calendar', label: 'Calendar', query: '(filename:ics OR calendar)' },
  { id: 'archived', label: 'Archived', query: '-in:inbox -in:drafts -in:sent' },
  { id: 'notes', label: 'Notes to self', query: '(from:me to:me) OR label:notes' },
];

export const DEFAULT_SNIPPETS = [
  { id: 'thanks', trigger: ';thanks', body: 'Thanks so much — appreciated.' },
  { id: 'followup', trigger: ';followup', body: 'Just following up on this when you have a moment.' },
  { id: 'intro', trigger: ';intro', body: 'Nice to meet you — looking forward to working together.' },
];

export const DEFAULT_SETTINGS: SimplyMailSettings = {
  uiCleanup: {
    enabled: true,
    hideMeet: true,
    hideChat: true,
    hideSpaces: true,
    constrainWidth: true,
    compactDensity: false,
  },
  darkMode: {
    enabled: true,
    mode: 'system',
    invertMessageBodies: false,
  },
  keyboardNavigation: {
    enabled: true,
    vimMode: true,
  },
  commandPalette: {
    enabled: true,
    includeSavedSearches: true,
  },
  savedSearches: {
    enabled: true,
    showInSidebar: true,
  },
  splitInboxSettings: {
    enabled: false,
    showCounts: true,
  },
  pauseInbox: {
    enabled: true,
    hideInboxWhenPaused: true,
    muteNotifications: true,
  },
  groupByDate: {
    enabled: false,
  },
  inboxZero: {
    enabled: true,
    showWhenEmptySearch: false,
  },
  trackerBlocker: {
    enabled: true,
    blockKnownDomains: true,
    blockTinyImages: true,
  },
  autoCcBcc: {
    enabled: false,
    cc: [],
    bcc: [],
    mode: 'new',
  },
  ai: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  instantReply: {
    enabled: false,
    skipCalendarInvites: true,
    skipPromotions: true,
  },
  smartActions: {
    enabled: true,
    showOnHover: true,
    position: 'inline',
  },
  emailAnalytics: {
    enabled: true,
    retentionDays: 90,
  },
  inboxSummary: {
    enabled: false,
    showTrackers: true,
    showStreak: true,
  },
  batchActions: {
    enabled: true,
    position: 'bottom',
  },
  readingPane: {
    enabled: false,
    position: 'right',
    trigger: 'select',
  },
  scrollProgress: {
    enabled: false,
    height: 3,
  },
  rowAnimations: {
    enabled: false,
    staggerMs: 50,
  },
  skeletonLoading: {
    enabled: false,
    rowCount: 6,
  },
  senderAvatars: {
    enabled: false,
  },
  priorityBadges: {
    enabled: false,
  },
  attachmentChips: {
    enabled: false,
  },
  splitTabs: DEFAULT_SPLIT_TABS,
  savedSearchesList: DEFAULT_SAVED_SEARCHES,
  snippets: DEFAULT_SNIPPETS,
  paused: false,
  installedAt: Date.now(),
  onboarded: false,
};

export const DEFAULT_RUNTIME_STATS: RuntimeStats = {
  trackersBlockedToday: 0,
  snoozedCount: 0,
  reminderCount: 0,
};

export const ALARM_NAMES = {
  reminders: 'simply-mail-reminders',
  snoozed: 'simply-mail-snoozed',
} as const;

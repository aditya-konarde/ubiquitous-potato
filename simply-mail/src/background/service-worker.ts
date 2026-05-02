import { ALARM_NAMES, STORAGE_KEYS } from '@/shared/constants';
import type { RuntimeMessage, RuntimeStats } from '@/shared/messaging';
import type { ReminderItem, SnoozedItem } from '@/shared/types';

const RUNTIME_MESSAGE_TYPES = new Set<RuntimeMessage['type']>([
  'simply-mail/open-options',
  'simply-mail/get-stats',
  'simply-mail/open-compose',
  'simply-mail/show-palette',
  'simply-mail/onboarded-badge',
]);

function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'string' &&
    RUNTIME_MESSAGE_TYPES.has((message as { type: RuntimeMessage['type'] }).type)
  );
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAMES.reminders, { periodInMinutes: 1 });
  chrome.alarms.create(ALARM_NAMES.snoozed, { periodInMinutes: 1 });
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) {
    return false;
  }

  if (message.type === 'simply-mail/open-options') {
    void chrome.runtime.openOptionsPage()
      .then(() => chrome.action.setBadgeText({ text: '' }))
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'simply-mail/get-stats') {
    void chrome.storage.local.get(STORAGE_KEYS.stats).then((result) => {
      const stats = (result[STORAGE_KEYS.stats] as RuntimeStats | undefined) ?? {
        trackersBlockedToday: 0,
        snoozedCount: 0,
        reminderCount: 0,
      };
      sendResponse(stats);
    });
    return true;
  }

  if (message.type === 'simply-mail/open-compose') {
    void handleOpenCompose()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'simply-mail/show-palette') {
    void handleShowPalette()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'simply-mail/onboarded-badge') {
    void chrome.action.setBadgeText({ text: '•' });
    void chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // success green
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAMES.reminders) {
    void processReminders();
  } else if (alarm.name === ALARM_NAMES.snoozed) {
    void processSnoozed();
  }
});

async function processReminders(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.reminders);
    const items = (result[STORAGE_KEYS.reminders] as ReminderItem[] | undefined) ?? [];
    const now = Date.now();

    const due = items.filter((item) => item.checkAt <= now);
    if (due.length === 0) return;

    // Show notifications for due reminders
    for (const item of due) {
      chrome.notifications?.create(`simply-mail-reminder-${item.id}`, {
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: 'Simply Mail Reminder',
        message: item.subject || 'You have a reminder to check.',
      });
    }

    // Remove processed reminders
    const remaining = items.filter((item) => item.checkAt > now);
    await chrome.storage.local.set({ [STORAGE_KEYS.reminders]: remaining });
  } catch {
    // Storage may not be available; silently skip
  }
}

async function processSnoozed(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.snoozed);
    const items = (result[STORAGE_KEYS.snoozed] as SnoozedItem[] | undefined) ?? [];
    const now = Date.now();

    const due = items.filter((item) => item.resumeAt <= now);
    if (due.length === 0) return;

    // Show notifications for due snoozed items
    for (const item of due) {
      chrome.notifications?.create(`simply-mail-snooze-${item.id}`, {
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: 'Simply Mail Snooze',
        message: item.subject || 'A snoozed thread is ready.',
      });
    }

    // Remove processed snoozed items
    const remaining = items.filter((item) => item.resumeAt > now);
    await chrome.storage.local.set({ [STORAGE_KEYS.snoozed]: remaining });
  } catch {
    // Storage may not be available; silently skip
  }
}

async function handleOpenCompose(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: '*://mail.google.com/*' });

  if (tabs.length > 0 && tabs[0]?.id != null) {
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const btn = document.querySelector<HTMLElement>('[gh="cm"]');
        btn?.click();
      },
    });
  } else {
    await chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#inbox' });
  }
}

async function handleShowPalette(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: '*://mail.google.com/*' });

  if (tabs.length > 0 && tabs[0]?.id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.tabs.sendMessage(tabs[0].id, { type: 'simply-mail/toggle-palette' });
    return;
  }

  await chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#inbox' });
}

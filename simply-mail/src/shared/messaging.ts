export type RuntimeMessage =
  | { type: 'simply-mail/open-options' }
  | { type: 'simply-mail/get-stats' }
  | { type: 'simply-mail/open-compose' }
  | { type: 'simply-mail/show-palette' }
  | { type: 'simply-mail/onboarded-badge' };

export type { RuntimeStats } from './types';

function hasbrowserRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.sendMessage);
}

export function sendRuntimeMessage<TResponse>(message: RuntimeMessage): Promise<TResponse> {
  if (hasbrowserRuntime()) {
    return chrome.runtime.sendMessage(message) as Promise<TResponse>;
  }

  if (message.type === 'simply-mail/get-stats') {
    return Promise.resolve({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 } as TResponse);
  }

  if (message.type === 'simply-mail/open-options') {
    if (typeof window !== 'undefined') {
      window.location.href = './settings.html';
    }
    return Promise.resolve(undefined as TResponse);
  }

  if (message.type === 'simply-mail/open-compose' || message.type === 'simply-mail/show-palette' || message.type === 'simply-mail/onboarded-badge') {
    return Promise.resolve(undefined as TResponse);
  }

  return Promise.reject(new Error('extension runtime is unavailable in this context.'));
}

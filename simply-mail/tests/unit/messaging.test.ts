import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendRuntimeMessage } from '@/shared/messaging';
import type { RuntimeStats } from '@/shared/types';

// Mock chrome.runtime
const mockSendMessage = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockSendMessage.mockReset();
});

describe('sendRuntimeMessage', () => {
  it('uses chrome.runtime.sendMessage when available', async () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      value: {
        runtime: {
          sendMessage: mockSendMessage.mockResolvedValue({
            trackersBlockedToday: 5,
            snoozedCount: 2,
            reminderCount: 1,
          }),
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await sendRuntimeMessage<RuntimeStats>({ type: 'simply-mail/get-stats' });
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'simply-mail/get-stats' });
    expect(result).toEqual({
      trackersBlockedToday: 5,
      snoozedCount: 2,
      reminderCount: 1,
    });

    Object.defineProperty(globalThis, 'chrome', {
      value: originalChrome,
      writable: true,
      configurable: true,
    });
  });

  it('returns default stats when chrome runtime is unavailable for simply-mail/get-stats', async () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      value: {},
      writable: true,
      configurable: true,
    });

    const result = await sendRuntimeMessage<RuntimeStats>({ type: 'simply-mail/get-stats' });
    expect(result).toEqual({
      trackersBlockedToday: 0,
      snoozedCount: 0,
      reminderCount: 0,
    });

    Object.defineProperty(globalThis, 'chrome', {
      value: originalChrome,
      writable: true,
      configurable: true,
    });
  });

  it('no-ops user action messages when chrome runtime is unavailable', async () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      value: {},
      writable: true,
      configurable: true,
    });

    await expect(sendRuntimeMessage({ type: 'simply-mail/show-palette' })).resolves.toBeUndefined();
    await expect(sendRuntimeMessage({ type: 'simply-mail/onboarded-badge' })).resolves.toBeUndefined();

    Object.defineProperty(globalThis, 'chrome', {
      value: originalChrome,
      writable: true,
      configurable: true,
    });
  });

  it('rejects with error for unknown message type without chrome runtime', async () => {
    const originalChrome = globalThis.chrome;
    Object.defineProperty(globalThis, 'chrome', {
      value: {},
      writable: true,
      configurable: true,
    });

    // Use a type assertion to test the fallback path for an unknown message
    await expect(
      sendRuntimeMessage({ type: 'simply-mail/unknown' } as unknown as Parameters<typeof sendRuntimeMessage>[0]),
    ).rejects.toThrow('extension runtime is unavailable in this context.');

    Object.defineProperty(globalThis, 'chrome', {
      value: originalChrome,
      writable: true,
      configurable: true,
    });
  });
});

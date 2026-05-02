import { initOnboarding, OVERLAY_ID, HINT_ID, STYLE_ID, HINT_STYLE_ID } from '@/content/modules/onboarding';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { vi } from 'vitest';
import type { StorageLike } from '@/shared/types';

function createMockStorage(settings: typeof DEFAULT_SETTINGS): StorageLike {
  return {
    getSettings: vi.fn().mockResolvedValue({ ...settings }),
    setSettings: vi.fn().mockResolvedValue(undefined),
    patchSettings: vi.fn().mockImplementation(async (patch) => {
      const updated = { ...settings, ...patch };
      return updated;
    }),
    getSnoozedItems: vi.fn().mockResolvedValue([]),
    setSnoozedItems: vi.fn().mockResolvedValue(undefined),
    getReminderItems: vi.fn().mockResolvedValue([]),
    setReminderItems: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 }),
    setStats: vi.fn().mockResolvedValue(undefined),
    onSettingsChanged: vi.fn().mockReturnValue(() => {}),
  };
}

describe('onboarding', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '';
  });

  it('shows overlay when onboarded is false', async () => {
    const storage = createMockStorage({ ...DEFAULT_SETTINGS, onboarded: false });
    await initOnboarding(storage);

    const overlay = document.getElementById(OVERLAY_ID);
    expect(overlay).not.toBeNull();
    expect(overlay!.querySelector('.simply-mail-onboard-card')).not.toBeNull();
    expect(overlay!.querySelector('.simply-mail-onboard-title')!.textContent).toBe('Simply Mail is ready');
    expect(overlay!.querySelector('.simply-mail-onboard-btn')!.textContent).toBe('Get Started');

    // Feature cards present
    const features = overlay!.querySelectorAll('.simply-mail-onboard-feature');
    expect(features).toHaveLength(4);

    // Style injected
    expect(document.getElementById(STYLE_ID)).not.toBeNull();
  });

  it('does not show overlay when onboarded is true', async () => {
    const storage = createMockStorage({ ...DEFAULT_SETTINGS, onboarded: true });
    const cleanup = await initOnboarding(storage);

    expect(document.getElementById(OVERLAY_ID)).toBeNull();
    expect(document.getElementById(STYLE_ID)).toBeNull();

    // Cleanup should be a no-op
    expect(() => cleanup()).not.toThrow();
  });

  it('sets onboarded to true on dismiss and shows shortcuts hint', async () => {
    vi.useFakeTimers();
    const storage = createMockStorage({ ...DEFAULT_SETTINGS, onboarded: false });
    await initOnboarding(storage);

    const overlay = document.getElementById(OVERLAY_ID)!;
    const btn = overlay.querySelector('.simply-mail-onboard-btn') as HTMLButtonElement;

    // Click "Get Started"
    btn.click();

    // patchSettings should have been called
    expect(storage.patchSettings).toHaveBeenCalledWith({ onboarded: true });

    // Simulate animationend for overlay fadeout
    overlay.dispatchEvent(new Event('animationend'));

    // Overlay should be removed
    expect(document.getElementById(OVERLAY_ID)).toBeNull();

    // Shortcuts hint should appear
    const hint = document.getElementById(HINT_ID);
    expect(hint).not.toBeNull();
    expect(hint!.querySelector('.simply-mail-hint-title')!.textContent).toBe('Keyboard Shortcuts');

    // Shortcut items
    const items = hint!.querySelectorAll('.simply-mail-hint-item');
    expect(items).toHaveLength(6);

    // Hint still visible before 5s
    vi.advanceTimersByTime(4999);
    expect(document.getElementById(HINT_ID)).not.toBeNull();

    // After 5 seconds, dismissHint is called (adds leaving class)
    vi.advanceTimersByTime(1);
    expect(hint!.classList.contains('simply-mail-hint-leaving')).toBe(true);

    // Simulate hint fadeout animation ending
    hint!.dispatchEvent(new Event('animationend'));
    expect(document.getElementById(HINT_ID)).toBeNull();
    expect(document.getElementById(HINT_STYLE_ID)).toBeNull();

    vi.useRealTimers();
  });

  it('cleanup function removes all onboarding DOM', async () => {
    const storage = createMockStorage({ ...DEFAULT_SETTINGS, onboarded: false });
    const cleanup = await initOnboarding(storage);

    expect(document.getElementById(OVERLAY_ID)).not.toBeNull();

    cleanup();

    expect(document.getElementById(OVERLAY_ID)).toBeNull();
    expect(document.getElementById(HINT_ID)).toBeNull();
    expect(document.getElementById(STYLE_ID)).toBeNull();
    expect(document.getElementById(HINT_STYLE_ID)).toBeNull();
  });
});

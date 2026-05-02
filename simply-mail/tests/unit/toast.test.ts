import { showToast, initToastSystem, destroyToastSystem } from '@/content/modules/toast';
import { vi } from 'vitest';

const TOAST_CONTAINER_ID = 'simply-mail-toast-container';
const TOAST_STYLE_ID = 'simply-mail-toast-styles';

describe('toast system', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    destroyToastSystem();
    document.body.innerHTML = '';
    document.documentElement.querySelectorAll(`#${TOAST_STYLE_ID}`).forEach((el) => el.remove());
  });

  it('showToast creates an accessible toast with the correct message', () => {
    showToast('Hello world');
    const toast = document.querySelector('.simply-mail-toast');

    expect(document.getElementById(TOAST_CONTAINER_ID)).not.toBeNull();
    expect(toast?.textContent).toBe('Hello world');
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.getAttribute('aria-live')).toBe('polite');
  });

  it('injects styles on first showToast call', () => {
    expect(document.getElementById(TOAST_STYLE_ID)).toBeNull();
    showToast('Test');
    expect(document.getElementById(TOAST_STYLE_ID)).not.toBeNull();
  });

  it('dedupes repeated messages instead of stacking duplicates', () => {
    showToast('Saved');
    showToast('Saved');

    const toasts = document.querySelectorAll('.simply-mail-toast');
    expect(toasts).toHaveLength(1);
  });

  it('limits the visible stack to three toasts', () => {
    showToast('First');
    showToast('Second');
    showToast('Third');
    showToast('Fourth');

    const toasts = Array.from(document.querySelectorAll('.simply-mail-toast')).map((node) => node.textContent);
    expect(toasts).toEqual(['Second', 'Third', 'Fourth']);
  });

  it('adds is-leaving class after the specified duration', () => {
    showToast('Duration test', 1000);
    const toast = document.querySelector('.simply-mail-toast')!;

    vi.advanceTimersByTime(999);
    expect(toast.classList.contains('is-leaving')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(toast.classList.contains('is-leaving')).toBe(true);
  });

  it('removes toast from DOM after leaving animation ends', () => {
    showToast('Remove test', 500);
    vi.advanceTimersByTime(500);
    const toast = document.querySelector('.simply-mail-toast')!;

    toast.dispatchEvent(new Event('animationend'));
    expect(document.querySelector('.simply-mail-toast')).toBeNull();
  });

  it('initToastSystem injects styles without creating toasts', () => {
    initToastSystem();
    expect(document.getElementById(TOAST_STYLE_ID)).not.toBeNull();
    expect(document.querySelectorAll('.simply-mail-toast')).toHaveLength(0);
  });

  it('destroyToastSystem removes container and styles from DOM', () => {
    showToast('Cleanup test');
    destroyToastSystem();

    expect(document.getElementById(TOAST_CONTAINER_ID)).toBeNull();
    expect(document.getElementById(TOAST_STYLE_ID)).toBeNull();
  });
});

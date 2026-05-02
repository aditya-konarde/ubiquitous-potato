import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MailObserver } from '@/content/mail-observer';
import type { MailView } from '@/shared/types';

// Mock getCurrentView
let mockCurrentView: MailView = 'inbox';
vi.mock('@/content/view', () => ({
  getCurrentView: () => mockCurrentView,
}));

describe('MailObserver', () => {
  let observer: MailObserver;

  beforeEach(() => {
    observer = new MailObserver();
    mockCurrentView = 'inbox';
    document.body.innerHTML = '';
  });

  afterEach(() => {
    observer.stop();
  });

  it('emits view-changed on start', () => {
    const handler = vi.fn();
    observer.on('view-changed', handler);
    observer.start();

    expect(handler).toHaveBeenCalledWith({
      view: 'inbox',
      hash: window.location.hash,
    });
  });

  it('returns current view via getCurrentView', () => {
    observer.start();
    expect(observer.getCurrentView()).toBe('inbox');
  });

  it('emits view-changed when view changes after process', () => {
    const handler = vi.fn();
    observer.on('view-changed', handler);
    observer.start();

    // Initial call
    expect(handler).toHaveBeenCalledTimes(1);

    // Change the mock view
    mockCurrentView = 'thread';
    (observer as unknown as { process: () => void }).process();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: 'thread' }),
    );
  });

  it('does not emit view-changed when view stays the same', () => {
    const handler = vi.fn();
    observer.on('view-changed', handler);
    observer.start();
    expect(handler).toHaveBeenCalledTimes(1);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1); // No additional call
  });

  it('emits compose-detected when a compose dialog appears', () => {
    const handler = vi.fn();
    observer.on('compose-detected', handler);
    observer.start();

    // Add a compose dialog to the DOM
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const subjectInput = document.createElement('input');
    subjectInput.setAttribute('name', 'subjectbox');
    dialog.appendChild(subjectInput);
    document.body.appendChild(dialog);

    (observer as unknown as { process: () => void }).process();

    expect(handler).toHaveBeenCalledWith({ node: dialog });
  });

  it('does not emit compose-detected for same dialog twice', () => {
    const handler = vi.fn();
    observer.on('compose-detected', handler);
    observer.start();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const subjectInput = document.createElement('input');
    subjectInput.setAttribute('name', 'subjectbox');
    dialog.appendChild(subjectInput);
    document.body.appendChild(dialog);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1); // No duplicate
  });

  it('prunes disconnected compose nodes', () => {
    const handler = vi.fn();
    observer.on('compose-detected', handler);
    observer.start();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const subjectInput = document.createElement('input');
    subjectInput.setAttribute('name', 'subjectbox');
    dialog.appendChild(subjectInput);
    document.body.appendChild(dialog);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);

    // Remove the dialog — process to prune it from known set
    dialog.remove();
    (observer as unknown as { process: () => void }).process();

    // Add it back — should be detected again since it was pruned
    document.body.appendChild(dialog);
    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('emits thread-detected when a thread container appears', () => {
    const handler = vi.fn();
    observer.on('thread-detected', handler);
    observer.start();

    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    const thread = document.createElement('div');
    thread.setAttribute('data-message-id', 'msg-123');
    main.appendChild(thread);
    document.body.appendChild(main);

    (observer as unknown as { process: () => void }).process();

    expect(handler).toHaveBeenCalledWith({ node: thread });
  });

  it('does not emit thread-detected for the same node twice', () => {
    const handler = vi.fn();
    observer.on('thread-detected', handler);
    observer.start();

    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    const thread = document.createElement('div');
    thread.setAttribute('data-message-id', 'msg-123');
    main.appendChild(thread);
    document.body.appendChild(main);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resets thread node when thread container is removed', () => {
    const handler = vi.fn();
    observer.on('thread-detected', handler);
    observer.start();

    const main = document.createElement('div');
    main.setAttribute('role', 'main');
    const thread = document.createElement('div');
    thread.setAttribute('data-message-id', 'msg-123');
    main.appendChild(thread);
    document.body.appendChild(main);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);

    // Remove the thread
    thread.remove();

    // Add a new thread — should be detected
    const thread2 = document.createElement('div');
    thread2.setAttribute('data-message-id', 'msg-456');
    main.appendChild(thread2);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('emits inbox-updated when rows appear with new signatures', () => {
    const handler = vi.fn();
    observer.on('inbox-updated', handler);
    observer.start();

    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    row.setAttribute('data-thread-id', 'thread-1');
    document.body.appendChild(row);

    (observer as unknown as { process: () => void }).process();

    expect(handler).toHaveBeenCalledWith({ rows: [row] });
  });

  it('does not emit inbox-updated when row signature is unchanged', () => {
    const handler = vi.fn();
    observer.on('inbox-updated', handler);
    observer.start();

    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    row.setAttribute('data-thread-id', 'thread-1');
    document.body.appendChild(row);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits inbox-updated when rows change', () => {
    const handler = vi.fn();
    observer.on('inbox-updated', handler);
    observer.start();

    const row1 = document.createElement('tr');
    row1.setAttribute('role', 'row');
    row1.setAttribute('data-thread-id', 'thread-1');
    document.body.appendChild(row1);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1);

    // Add a new row
    const row2 = document.createElement('tr');
    row2.setAttribute('role', 'row');
    row2.setAttribute('data-thread-id', 'thread-2');
    document.body.appendChild(row2);

    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes handler correctly', () => {
    const handler = vi.fn();
    const unsubscribe = observer.on('view-changed', handler);
    observer.start();
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    mockCurrentView = 'thread';
    (observer as unknown as { process: () => void }).process();
    expect(handler).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  it('cleans up mutation observer on stop', () => {
    observer.start();
    const mo = (observer as unknown as { mutationObserver: MutationObserver | null }).mutationObserver;
    expect(mo).not.toBeNull();

    observer.stop();
    expect((observer as unknown as { mutationObserver: MutationObserver | null }).mutationObserver).toBeNull();
  });

  it('handles multiple handlers for the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    observer.on('view-changed', handler1);
    observer.on('view-changed', handler2);
    observer.start();

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

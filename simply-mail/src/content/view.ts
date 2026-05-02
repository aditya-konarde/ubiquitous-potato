import type { MailView } from '@/shared/types';

const SEARCH_HASH_RE = /^#search\//;
const LABEL_HASH_RE = /^#label\//;

let cachedHash: string | null = null;
let cachedView: MailView = 'unknown';

function computeView(hash: string): MailView {
  // Strip compose query parameter — compose is an overlay, not a view.
  // The underlying view (inbox, sent, etc.) stays the same.
  const base = hash.replace(/[?&]compose=[^&]*/g, '').replace(/\?$/, '');

  if (!base || base === '#' || base === '#inbox') {
    return 'inbox';
  }

  if (base === '#sent' || base.startsWith('#sent/')) {
    return 'sent';
  }

  if (base === '#drafts' || base.startsWith('#drafts')) {
    return 'drafts';
  }

  if (base === '#starred' || base.startsWith('#starred')) {
    return 'starred';
  }

  if (base === '#trash' || base.startsWith('#trash')) {
    return 'trash';
  }

  if (base === '#spam' || base.startsWith('#spam')) {
    return 'spam';
  }

  if (base === '#scheduled' || base.startsWith('#scheduled')) {
    return 'scheduled';
  }

  if (base === '#all' || base.startsWith('#all')) {
    return 'allMail';
  }

  if (SEARCH_HASH_RE.test(base)) {
    return 'search';
  }

  if (LABEL_HASH_RE.test(base)) {
    return 'label';
  }

  if (/#[^/]+\/[a-zA-Z0-9]+$/.test(base)) {
    return 'thread';
  }

  return 'unknown';
}

export function getCurrentView(hash = window.location.hash): MailView {
  if (hash === cachedHash) {
    return cachedView;
  }
  cachedHash = hash;
  cachedView = computeView(hash);
  return cachedView;
}

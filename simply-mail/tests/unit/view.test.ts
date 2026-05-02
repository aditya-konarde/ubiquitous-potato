import { getCurrentView } from '@/content/view';

describe('getCurrentView', () => {
  it.each([
    ['', 'inbox'],
    ['#inbox', 'inbox'],
    ['#search/from%3Aalice', 'search'],
    ['#label/Work', 'label'],
    ['#sent', 'sent'],
    ['#drafts', 'drafts'],
    ['#starred', 'starred'],
    ['#trash', 'trash'],
    ['#spam', 'spam'],
    ['#scheduled', 'scheduled'],
    ['#all', 'allMail'],
    ['#inbox/FMfcgzQbdr', 'thread'],
    ['#inbox?compose=new', 'inbox'],
    ['#random-view', 'unknown'],
  ])('returns %s -> %s', (hash, expected) => {
    expect(getCurrentView(hash)).toBe(expected);
  });
});

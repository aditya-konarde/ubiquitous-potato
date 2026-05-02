import { clampNumber, createDraftId, parseMultilineList, toMultilineList } from '@/shared/settings-utils';

describe('settings utils', () => {
  it('parses multiline values, trimming blanks and deduping', () => {
    expect(parseMultilineList(' alpha\n\n beta \nalpha\n')).toEqual(['alpha', 'beta']);
  });

  it('filters invalid email entries when requested', () => {
    expect(parseMultilineList('a@example.com\nnot-an-email\nb@example.org', { emailsOnly: true })).toEqual([
      'a@example.com',
      'b@example.org',
    ]);
  });

  it('serializes values back to multiline text', () => {
    expect(toMultilineList(['one', 'two'])).toBe('one\ntwo');
  });

  it('clamps numbers into range', () => {
    expect(clampNumber(10, 30, 365)).toBe(30);
    expect(clampNumber(120, 30, 365)).toBe(120);
    expect(clampNumber(700, 30, 365)).toBe(365);
  });

  it('creates prefixed draft ids', () => {
    const id = createDraftId('tab');
    expect(id.startsWith('tab-')).toBe(true);
    expect(id.length).toBeGreaterThan(6);
  });
});

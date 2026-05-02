import { describe, it, expect } from 'vitest';
import { extractSenderFromRow, extractSubjectFromRow } from '@/content/modules/row-utils';

describe('extractSenderFromRow', () => {
  it('extracts email from [email] attribute', () => {
    const row = document.createElement('tr');
    const span = document.createElement('span');
    span.setAttribute('email', 'alice@example.com');
    row.appendChild(span);

    expect(extractSenderFromRow(row)).toBe('alice@example.com');
  });

  it('extracts email from [data-hovercard-id] when [email] is absent', () => {
    const row = document.createElement('tr');
    const span = document.createElement('span');
    span.setAttribute('data-hovercard-id', 'bob@example.com');
    row.appendChild(span);

    expect(extractSenderFromRow(row)).toBe('bob@example.com');
  });

  it('prefers [email] over [data-hovercard-id]', () => {
    const row = document.createElement('tr');
    const span = document.createElement('span');
    span.setAttribute('email', 'alice@example.com');
    span.setAttribute('data-hovercard-id', 'bob@example.com');
    row.appendChild(span);

    expect(extractSenderFromRow(row)).toBe('alice@example.com');
  });

  it('extracts from name span with .yW class', () => {
    const row = document.createElement('tr');
    const wrapper = document.createElement('div');
    wrapper.className = 'yW';
    const span = document.createElement('span');
    span.textContent = 'Charlie';
    wrapper.appendChild(span);
    row.appendChild(wrapper);

    expect(extractSenderFromRow(row)).toBe('Charlie');
  });

  it('extracts email from name span with email attribute', () => {
    const row = document.createElement('tr');
    const wrapper = document.createElement('div');
    wrapper.className = 'yW';
    const span = document.createElement('span');
    span.setAttribute('email', 'charlie@example.com');
    wrapper.appendChild(span);
    row.appendChild(wrapper);

    expect(extractSenderFromRow(row)).toBe('charlie@example.com');
  });

  it('extracts from .zF class', () => {
    const row = document.createElement('tr');
    const span = document.createElement('span');
    span.className = 'zF';
    span.textContent = 'Dave';
    row.appendChild(span);

    expect(extractSenderFromRow(row)).toBe('Dave');
  });

  it('extracts email from row aria-label', () => {
    const row = document.createElement('tr');
    row.setAttribute('aria-label', 'Message from eve@example.com about meeting');

    expect(extractSenderFromRow(row)).toBe('eve@example.com');
  });

  it('returns empty string when no sender info found', () => {
    const row = document.createElement('tr');
    expect(extractSenderFromRow(row)).toBe('');
  });

  it('returns empty string when aria-label has no email', () => {
    const row = document.createElement('tr');
    row.setAttribute('aria-label', 'Some message without email');
    expect(extractSenderFromRow(row)).toBe('');
  });
});

describe('extractSubjectFromRow', () => {
  it('extracts subject from .bog element', () => {
    const row = document.createElement('tr');
    const subjectEl = document.createElement('span');
    subjectEl.className = 'bog';
    subjectEl.textContent = 'Project Update';
    row.appendChild(subjectEl);

    expect(extractSubjectFromRow(row)).toBe('Project Update');
  });

  it('extracts subject from [role="link"] element', () => {
    const row = document.createElement('tr');
    const link = document.createElement('a');
    link.setAttribute('role', 'link');
    link.textContent = 'Meeting Tomorrow';
    row.appendChild(link);

    expect(extractSubjectFromRow(row)).toBe('Meeting Tomorrow');
  });

  it('prefers .bog over [role="link"]', () => {
    const row = document.createElement('tr');
    const link = document.createElement('a');
    link.setAttribute('role', 'link');
    link.textContent = 'Old Subject';
    row.appendChild(link);
    const bog = document.createElement('span');
    bog.className = 'bog';
    bog.textContent = 'New Subject';
    row.appendChild(bog);

    expect(extractSubjectFromRow(row)).toBe('New Subject');
  });

  it('trims whitespace from subject', () => {
    const row = document.createElement('tr');
    const subjectEl = document.createElement('span');
    subjectEl.className = 'bog';
    subjectEl.textContent = '  Padded Subject  ';
    row.appendChild(subjectEl);

    expect(extractSubjectFromRow(row)).toBe('Padded Subject');
  });

  it('returns empty string when no subject element found', () => {
    const row = document.createElement('tr');
    expect(extractSubjectFromRow(row)).toBe('');
  });

  it('returns empty string when subject element has no text', () => {
    const row = document.createElement('tr');
    const subjectEl = document.createElement('span');
    subjectEl.className = 'bog';
    row.appendChild(subjectEl);

    expect(extractSubjectFromRow(row)).toBe('');
  });
});

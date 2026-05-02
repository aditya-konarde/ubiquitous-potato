/**
 * Shared DOM extraction utilities for email app email rows.
 * Used by multiple modules (smart-actions, email-analytics) to avoid duplication.
 */

export function extractSenderFromRow(row: Element): string {
  // Try aria-label on email/name spans
  const emailEl = row.querySelector('[email]') ?? row.querySelector('[data-hovercard-id]');
  if (emailEl) {
    return emailEl.getAttribute('email') ?? emailEl.getAttribute('data-hovercard-id') ?? '';
  }
  // Try the name span (.yW or .zF in email app)
  const nameSpan = row.querySelector('.yW span, .zF');
  if (nameSpan) {
    return nameSpan.getAttribute('email') ?? nameSpan.textContent?.trim() ?? '';
  }
  // Try aria-label on the row itself
  const rowLabel = row.getAttribute('aria-label') ?? '';
  if (rowLabel) {
    const match = rowLabel.match(/[\w.-]+@[\w.-]+\.\w+/);
    return match ? match[0] : '';
  }
  return '';
}

export function extractSubjectFromRow(row: Element): string {
  // email app subject is in .bog or the subject cell
  const subjectEl = row.querySelector('.bog') ?? row.querySelector('[role="link"]');
  return subjectEl?.textContent?.trim() ?? '';
}

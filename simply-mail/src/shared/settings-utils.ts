const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function createDraftId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseMultilineList(raw: string, options?: { emailsOnly?: boolean }): string[] {
  const unique = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) {
      continue;
    }
    if (options?.emailsOnly && !EMAIL_PATTERN.test(value)) {
      continue;
    }
    unique.add(value);
  }

  return [...unique];
}

export function toMultilineList(values: string[]): string {
  return values.join('\n');
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Shared DOM utilities for content modules.
 * Consolidates common patterns used across multiple modules.
 */

/**
 * Create or update a `<style>` element by ID.
 * If a style with the given ID already exists, its textContent is updated.
 * Otherwise, a new `<style>` element is created and appended to `<html>`.
 */
export function ensureStyle(id: string, css: string): void {
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.documentElement.appendChild(style);
    }
  }
  style.textContent = css;
}

/**
 * Remove a `<style>` element by ID.
 */
export function removeStyle(id: string): void {
  document.getElementById(id)?.remove();
}

/**
 * Get the email app main content area mount point.
 * Returns the `[role="main"]` element if it's an HTMLElement, otherwise null.
 */
export function getMountPoint(): HTMLElement | null {
  const main = document.querySelector('[role="main"]');
  return main instanceof HTMLElement ? main : null;
}

/**
 * Build a mail search hash URL from a query string.
 */
export function hashForQuery(query: string): string {
  return `#search/${encodeURIComponent(query)}`;
}

/** Milliseconds in one day. */
export const MS_PER_DAY = 86_400_000;

/** Milliseconds in one week. */
export const MS_PER_WEEK = 7 * MS_PER_DAY;

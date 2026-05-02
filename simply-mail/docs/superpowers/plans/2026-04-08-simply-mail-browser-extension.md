# Simply Mail browser extension plan

## Goal

Build a browser extension that creates a cleaner, decluttered email experience without a hosted backend.

The extension should make the inbox calmer, easier to scan, and more keyboard-friendly while keeping user data local whenever possible.

## Architecture

- Manifest V3 browser extension
- Content script on the supported webmail surface
- Modular feature system driven by a central observer
- Preact popup and settings surfaces
- Browser storage for settings and local state
- Optional smart drafting features through a user-configured provider

## Principles

1. Keep public copy generic: describe the product as a cleaner, decluttered email experience.
2. Avoid implying affiliation with any mail provider, browser vendor, AI provider, or competing product.
3. Keep permissions narrow.
4. Do not use a hosted backend.
5. Keep all feature modules independently toggleable.
6. Prefer graceful degradation when the underlying mail surface changes.

## Feature areas

- UI cleanup and calmer visual hierarchy
- Keyboard navigation
- Command palette
- Saved searches
- Inbox grouping
- Pause inbox mode
- Reminder notifications
- Tracker blocking
- Optional smart replies and drafting
- Settings backup and restore

## Development checks

```bash
npm ci --include=dev
npm run typecheck
npm test
npm run build
```

## Release copy

Use neutral wording such as:

> Simply Mail creates a cleaner, decluttered email experience with calmer visuals, keyboard-friendly workflows, and local-first settings.

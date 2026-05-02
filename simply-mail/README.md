# Simply Mail

Simply Mail is a browser extension that creates a cleaner, decluttered email experience.

It focuses on a calmer inbox, fewer distractions, keyboard-friendly navigation, and local-only customization. There is no hosted backend, and user settings stay in browser storage.

## Status

Experimental side project. Expect the supported mail surface to change occasionally, which may break features.

## Features

- UI cleanup and visual polish
- Keyboard navigation and command palette foundations
- Modular content-script feature system
- Popup and settings pages built with Preact
- Optional smart drafting features using a user-configured provider
- Unit tests for core browser-extension modules

## Development

```bash
npm ci --include=dev
npm run typecheck
npm test
npm run build
```

The production extension bundle is generated in `dist/`. That directory is intentionally ignored in the monorepo.

## Load unpacked

1. Run `npm run build`.
2. Open your browser's extension management page.
3. Enable developer mode.
4. Choose **Load unpacked** and select `simply-mail/dist`.
5. Open the supported webmail site.

## Layout

```text
assets/      Extension icons
scripts/     Build and utility scripts
src/         Background, content, popup, settings, shared code, and UI CSS
tests/       Vitest unit tests
docs/        Planning notes
```

## Privacy model

- No hosted backend.
- No mail API or OAuth access.
- Changes happen through local DOM manipulation in the browser.
- Optional smart features send selected context directly from the user's browser to the configured provider.

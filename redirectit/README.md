# Redirectit

Redirectit is a tiny Manifest V3 Chrome extension that redirects `www.reddit.com` pages to `old.reddit.com` using Declarative Net Request rules.

## Install locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this directory: `redirectit/`.

## Files

- `manifest.json`: Chrome extension manifest
- `rules.json`: Declarative Net Request redirect rule

## Development checks

From the repository root:

```bash
python3 -m json.tool redirectit/manifest.json >/dev/null
python3 -m json.tool redirectit/rules.json >/dev/null
```

## Generated files

Chromium may create a `_metadata/` directory after loading the unpacked extension. That directory is generated and should not be committed.

## License

GPLv3 via the root repository `LICENSE`.

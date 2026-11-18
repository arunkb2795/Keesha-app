# Keesha wallet launcher icon

Created with the built-in image generation tool. `wallet-source.png` preserves the generated transparent artwork. Run `node scripts/export-wallet-icons.cjs` from the project root to reproduce the platform exports.

- `wallet-icon.png`: opaque 1024×1024 icon for iOS and Android fallback.
- `wallet-adaptive-foreground.png`: transparent 1024×1024 Android adaptive foreground, padded inside its safe area; use background `#176346`.
- `wallet-monochrome.png`: transparent monochrome layer for Android themed icons.
- `wallet-preview.png`: 256×256 preview.

App icon settings are in `app.json`. Build and install a new native binary to see the launcher icon; reloading JavaScript does not replace an installed icon.

## Generation prompt

Use case: logo-brand. Asset type: installed phone app launcher foreground for Keesha, a personal expense tracker. Create one clean, polished wallet symbol, front view, flat vector-like bitmap with crisp rounded shapes. A warm ivory wallet body (#F7F6F2), a subtle mint card peeking from its top, and a dark forest-green clasp (#176346) with one small ivory circular button. Bold, simple, recognizable at 48px. Center the entire wallet within the middle 58% of a square 1024x1024 canvas, with generous transparent padding on all sides for Android adaptive icon masks. Transparent background, no text, no letters, no currency signs, no surrounding badge, no rounded-square tile, no shadow outside the wallet, no mockup, no gradients. This foreground will be placed on a solid forest-green background.

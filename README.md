# Tab Loom

A Toby-like Chrome new-tab extension for collecting open tabs into workspaces and folders.

## Run

```powershell
pnpm install
pnpm run dev
```

## Build And Load In Chrome

```powershell
pnpm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated `dist` directory. Do not install by opening `index.html`; Chrome extensions must be loaded from `chrome://extensions`.

## Test

```powershell
pnpm run typecheck
pnpm run test
pnpm run build
```

The extension stores its data in `chrome.storage.local` and supports JSON export/import from the top-right toolbar.

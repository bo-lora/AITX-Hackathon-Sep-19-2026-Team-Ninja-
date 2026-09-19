# ContextNinja Chrome extension

Vanilla MV3. No compile. **Not on the Chrome Web Store.** Judges load this folder unpacked.

## Load unpacked

1. Pack a zip (`pnpm pack:extension`) or use this folder as-is.
2. If you downloaded the zip, unzip it. The folder must contain `manifest.json`.
3. Chrome → `chrome://extensions`
4. Turn on **Developer mode** (top right).
5. **Load unpacked** → pick this folder (or the unzipped `contextninja-extension` folder).
6. Pin ContextNinja. Open a normal page (email or OpenEMR, not `chrome://`). Icon → **Create skill** → do the path → **Done**.

Skill manager must be running at http://127.0.0.1:43124. Chrome may warn about developer-mode extensions after a restart; keep this one enabled.

See `INSTALL.txt` (also inside the zip).

```bash
pnpm pack:extension
```

That writes `packages/webapp/landing-page/public/contextninja-extension.zip` (and the same file on the skill manager).

Create skill records DOM events in the current tab. Done POSTs JSON to `http://127.0.0.1:43124/api/sessions` and opens the workflow page.

No API keys. The extension never calls Grok.

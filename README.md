# Team Ninja — Cursor Austin × AITX

19 Sep 2026 hackathon. **ContextNinja** records a real workflow in Chrome, then a webapp turns that session into a Grok computer-use skill.

Mary does not know Cursor and never should. Her product is the Chrome extension, this webapp, and Grok. No API key in the extension.

## Operator flow

1. Load `apps/extension` unpacked in Chrome. Click **Create skill**, do the work, click **Done**.
2. Done POSTs session JSON to the webapp and opens the **workflow** page.
3. Edit the steps. **Save** opens the **skill** page.
4. **Add to Grok**, **Download**, optional **Publish**. The homepage lists trained skills.

## Monorepo

```
apps/web         Next.js operator app (port 43123)
apps/extension   Chrome MV3 recorder (no keys)
packages/session Shared session / skill types
docs/            Product lock and pipeline notes
docs/brand/      Accepted ContextNinja logo
research/        Ingress examples
```

Type lock for `apps/web`: headlines **Bricolage Grotesque**, body **Open Sans** (Google Fonts via `next/font`). Logo is `apps/web/public/logo.png`. Home follows the cream extension-landing structure (nav, hero, circular mark, official Chrome Web Store badge); `docs/brand/landing-reference.png` is layout reference only.

## Run

```bash
pnpm install
pnpm dev
```

Webapp: http://127.0.0.1:43123

Then Chrome → Extensions → Load unpacked → `apps/extension`.

A sample workflow button on the homepage skips the extension so a judge can still walk Save → Add to Grok.

## Docs

- [`docs/deliverables.md`](docs/deliverables.md) — demo lock
- [`docs/product-name.md`](docs/product-name.md) — ContextNinja
- [`docs/hackathon-pipeline.md`](docs/hackathon-pipeline.md) — recorder → AST → artifact
- [`docs/huddle-video-vs-live.md`](docs/huddle-video-vs-live.md) — live DOM vs video
- [`research/ingestion-to-workflow-for-agents.md`](research/ingestion-to-workflow-for-agents.md)
- [`research/Legacy Software Video Ingress Examples.md`](research/Legacy%20Software%20Video%20Ingress%20Examples.md)

## Contribute

```bash
git clone https://github.com/bo-lora/AITX-Hackathon-Sep-19-2026-Team-Ninja-.git
cd AITX-Hackathon-Sep-19-2026-Team-Ninja-
git checkout -b your-slice
```

Push the branch and open a pull request into `main`. Do not force-push `main`. Keep secrets out of git.

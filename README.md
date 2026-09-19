# Team Ninja — Cursor Austin × AITX

19 Sep 2026 hackathon. **ContextNinja** records a real workflow in Chrome, then the skill manager turns that session into a Grok computer-use skill.

The product is the Chrome extension, the landing page, the skill manager, and Grok. No API key in the extension.

## Operator flow

1. Load `packages/extension` unpacked in Chrome. Click **Create skill**, do the work, click **Done**.
2. Done POSTs session JSON to the skill manager (`POST /api/sessions`) and opens the **workflow** page.
3. Edit the steps. **Save** opens the **skill** page.
4. **Add to Grok**, **Download**, optional **Publish**. The skill manager lists trained skills.

## Monorepo

```
packages/extension              Chrome MV3 recorder (no keys)
packages/webapp/landing-page    Marketing / download landing (port 43123)
packages/webapp/skill-manager   Workflow edit → save → Add to Grok / download / skill list (port 43124)
packages/backend                SessionPayload, deriveSteps, store, POST /api/sessions
docs/                           Product lock and pipeline notes
docs/brand/                     Accepted ContextNinja logo
research/                       Ingress examples
```

Type lock: headlines **Bricolage Grotesque**, body **Open Sans** (Google Fonts via `next/font`). Cream `#f3efed`. Logo is `packages/webapp/landing-page/public/logo.png`. Download CTA is a dark pill with the round Chrome icon. `docs/brand/landing-reference.png` is layout reference only.

## Run

```bash
pnpm install
pnpm dev
```

Landing: http://127.0.0.1:43123  
Skill manager: http://127.0.0.1:43124

Then Chrome → Extensions → Load unpacked → `packages/extension`.

A sample workflow button on the landing page skips the extension so a judge can still walk Save → Add to Grok.

## Docs

- [`docs/deliverables.md`](docs/deliverables.md) — demo lock
- [`docs/product-name.md`](docs/product-name.md) — ContextNinja
- [`docs/hackathon-pipeline.md`](docs/hackathon-pipeline.md) — recorder → AST → artifact
- [`docs/huddle-video-vs-live.md`](docs/huddle-video-vs-live.md) — live DOM vs video
- [`docs/team-status-and-recorder-design.md`](docs/team-status-and-recorder-design.md) — status + recorder contract
- [`research/ingestion-to-workflow-for-agents.md`](research/ingestion-to-workflow-for-agents.md)
- [`research/Legacy Software Video Ingress Examples.md`](research/Legacy%20Software%20Video%20Ingress%20Examples.md)

## Contribute

```bash
git clone https://github.com/bo-lora/AITX-Hackathon-Sep-19-2026-Team-Ninja-.git
cd AITX-Hackathon-Sep-19-2026-Team-Ninja-
git checkout -b your-slice
```

Push the branch and open a pull request into `main`. Do not force-push `main`. Keep secrets out of git.

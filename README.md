# Team Ninja — Cursor Austin × AITX

19 Sep 2026 hackathon. We turn a **screen recording of legacy software** into something Mary can paste into **her** AI client.

## Problem

Older job software lives behind a GUI. It is not AI-addressable. Mary already knows the clicks in that app; they do not transfer into Cursor, Grok, or ChatGPT.

She should not have to click through every screen again.

## Product

1. Mary records the repetitive workflow (any video file; capture app does not matter).
2. She uploads the video, adds a little context, and runs it.
3. She gets a **copy-paste MCP artifact** for the client she already uses: Cursor, Grok, or ChatGPT. That choice is hers.

**Ingress is video.** The recording is the source of the workflow. The presented result must match that recording: no silent extra sources, no fake claims.

## Example targets (research)

These are the kinds of GUI apps the pipeline is for, with public tutorial/screencast examples in [`research/`](research/):

- **QuickBooks Desktop** — bills, payments, batch entry
- **Tyler / Incode** (municipal court, cashiering, related suites)
- **Industrial / niche desktop** — e.g. Streampix camera setup, other long-tail tools with no native AI API

They are **vectors**, not the four-hour runtime. Epic-class EHRs are the story, not the demo environment.

For a slice judges can actually run, a small **owned stand-in** (ClinicDesk-style: labeled forms, fake patients, local login) is the right constrained target. Record that UI, compile the MCP tool, replay it. Same product; safer clock.

## This repo

Right now this is **docs and research**, not a running server. There is nothing to `npm start` or `uvicorn` yet. Read the research note, then ship code on a branch.

- Research: [`research/Legacy Software Video Ingress Examples.md`](research/Legacy%20Software%20Video%20Ingress%20Examples.md)
- License: Apache-2.0 (`LICENSE`)

## Contribute

```bash
git clone https://github.com/bo-lora/AITX-Hackathon-Sep-19-2026-Team-Ninja-.git
cd AITX-Hackathon-Sep-19-2026-Team-Ninja-
git checkout -b your-slice
```

Push the branch and open a **pull request into `main`**. Cursor Cloud Agents are welcome: grant the GitHub App this repo, start the agent here, and have it open a PR. Do not force-push `main`.

Keep secrets out of git (`.env`, API keys). Add `.env.example` if you introduce config.

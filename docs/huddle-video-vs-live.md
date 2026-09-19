# Huddle: video vs live DOM (divide and conquer)

**Demo lock:** operator product is ContextNinja extension + webapp + Grok. Mary never uses Cursor. Cursor is team-only. No API key in the extension.

Do **not** delete either path. Split the room. Both can ship a FastMCP paste into Cursor. Video is not the compiler for Track B.

- Live-DOM pipeline (lock for her Chrome): `docs/hackathon-pipeline.md`
- Video / target research: `research/Legacy Software Video Ingress Examples.md`
- OSS recorder map: `research/ingestion-to-workflow-for-agents.md`

GrokBot train-a-task is **pitch contrast only**. Do not scrape Grok. Teach in the operator’s own Chrome, not an agent VM.

## Track A — Invoice Ninja + video + OpenAPI

**Who:** people chasing a runnable SaaS with a real API.

- App: **Invoice Ninja** (self-host or demo), not Epic.
- Ingress: a **screen recording** of a repetitive flow (e.g. enter/pay a bill) plus a little context.
- Compiler aid: Invoice Ninja **OpenAPI** — map what the video shows onto documented endpoints instead of guessing pixels.
- Output: copy-paste MCP / client snippet that calls those APIs.

Video here is a *story + mapping hint*, not a click-guessing runtime. If OpenAPI covers the flow, prefer the API over Playwright-from-frames.

## Track B — live DOM in her Chrome

**Who:** people building GrokBot-style teach-a-task in the human’s natural browser.

- Ingress: **live session recorder** in *her* Chrome (logged-in tabs). Pick **one**: Open Browser Use, Automa, or OpenDevBrowser (DevTools Recorder JSON is fine if no extension).
- Compiler: recorded events → JSON/YAML AST (selectors, not x,y) → **FastMCP** `server.py` + `.cursor/mcp.json`.
- Output: Cursor chat tool that replays the taught flow.

Do not integrate all three recorders. See the OSS map.

## Optional — OpenEMR fax-entry

Only if someone has cycles after A or B has a pasteable tool. OpenEMR public demo is nested frames and resets; treat fax/chart-note entry as a stretch storyboard, not the scored demo.

## Handshake at the end of the huddle

1. Track A names the Invoice Ninja flow and whether OpenAPI is reachable.
2. Track B names the single recorder and the Chrome target URL.
3. Both agree the judge paste is still **MCP + `.cursor/mcp.json`**.
4. Do not merge the tracks mid-hack unless one is blocked.

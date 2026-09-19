# Four-hour pipeline

**Demo lock:** operator product is ContextNinja extension + webapp + Grok. Mary never uses Cursor. Cursor is team-only. No API key in the extension.

Video ingestion (FFmpeg keyframes + Whisper + VLM) is **not** the compiler. Screen-recording → guessed clicks is non-deterministic and flaky. Do not build that path for the demo.

The product is **GrokBot train-a-task, but in the human’s natural environment** — their Chrome, their desktop, their logged-in apps — not Grok’s cloud computer / agent VM. Record live DOM (and related) interactions, emit a structured AST (JSON/YAML) or executable tool, paste into Cursor / Grok / ChatGPT via FastMCP.

Mary still should not click through every screen *after* teach. Teach happens once where she already works.

## Contrast: GrokBot vs this

| | GrokBot train-a-task | This hack |
| --- | --- | --- |
| Where | Grok cloud computer / Bot VM | Operator’s own browser/OS |
| How | DOM scraper + “teach a routine” | Same idea: live session recorder |
| Output | Skill/routine locked inside Grok | Portable FastMCP + `.cursor/mcp.json` |

Do not scrape or export Grok routines. Pitch against them; implement the recorder ourselves (or with one OSS extension).

## 1. Ingestion (live session, not video)

Pick **one** recorder. Prefer native or OSS; do not integrate all of them.

- **Chrome DevTools Recorder** → W3C User Journey JSON (no extra extension).
- **Automa** → structured JSON workflow (selectors, steps, conditionals).
- **Open Browser Use** → extension + local MCP, live tool-calls/CDP.
- **OpenDevBrowser** → extension relay → `opendevbrowser_*` tools.

If the target is **desktop with no DOM** (QuickBooks Desktop, industrial apps), do not fake it with video this weekend. Either pick a **web** demo target (QuickBooks Online, Tyler web, Sauce Demo) or record with a desktop a11y/event recorder only if one is already in the room. Video remains a last-resort storyboard, not the pipeline.

YouTube / `yt-dlp` is not ingress for the compiler.

## 2. AST, not pixels

Logged events: clicks, inputs, navigations, tab switches. Codify to JSON/YAML AST an agent can parse — not an SOP and not `x,y` clicks.

Optional thin LLM pass: JSON AST → parameterized tool (`vendor`, `amount`, …) and Playwright/Puppeteer *from selectors in the AST*, not from frames.

## 3. Payload: FastMCP + Cursor MCP

Do not hand-write JSON-RPC.

- Generate `server.py` with **FastMCP** (tool name, description, type-hint `inputSchema`).
- Project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "legacy-bridge-tool": {
      "command": "python",
      "args": ["server.py"]
    }
  }
}
```

Optional `"env": {}` for keys. Or Settings → Tools & MCP → Add new MCP server. Restart Cursor. Chat (`Cmd+L` / `Ctrl+L`) should see the tool.

## 4. Traceability (judges)

Barebones UI (Streamlit or HTML): each AST step beside the **recorded event** (selector + action + URL), not a guessed video frame. No hidden sources. Teach session = source of truth.

## 5. Four-hour slice

1. Recorder in the operator’s Chrome (DevTools export or Automa JSON).
2. Script: JSON AST → FastMCP `server.py`.
3. `.cursor/mcp.json` pointed at `python server.py`.
4. Trace view: AST step ↔ recorded event.
5. Demo: Mary (or a teammate) teaches bill-entry / equivalent **in her browser**, then Cursor calls the tool.

See `research/ingestion-to-workflow-for-agents.md` for the OSS map.

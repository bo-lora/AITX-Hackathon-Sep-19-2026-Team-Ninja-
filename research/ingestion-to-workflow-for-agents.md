# Ingestion-to-workflow for agents

Sits at process ingestion, task mining, and agentic web automation. These tools log DOM interactions (clicks, inputs, navigations) and emit structured JSON/YAML AST or executable code an agent or script can run — not a static SOP.

Use this when the legacy target is **a browser with a real DOM**. The four-hour video pipeline (`docs/hackathon-pipeline.md`) is for apps **without** a readable DOM (desktop, QuickBooks, Tyler, industrial UIs): FFmpeg keyframes + Whisper + VLM → FastMCP.

## 1. Browser-Use and Open Browser Use

- Original `browser-use`: Python library for LLMs controlling Chrome.
- [Open Browser Use](https://www.producthunt.com/products/open-browser-use) and forks: Manifest V3 Chrome extension + local server/MCP runtime.
- Records live Chrome sessions (tabs, downloads, inputs) into unified tool-calls for an agent.

## 2. Automa

[Automa](https://github.com/AutomaApp/automa) — open-source extension, drag-and-drop or session recorder.

- Captures CSS/XPath selectors, interactions, conditionals.
- Exports a **JSON workflow definition**, not an SOP. Nodes are deterministic; often used as the ingestion layer into an LLM to infer APIs or generate Playwright/Puppeteer.

## 3. OpenDevBrowser

[OpenDevBrowser](https://github.com/freshtechbro/opendevbrowser) — script-first browser automation runtime for agents.

- Chrome extension relay into the browser runtime.
- Maps UI flows to standardized `opendevbrowser_*` tool calls for an LLM to turn a manual flow into a programmatic process.

## 4. Chrome DevTools Recorder

Native Chrome, no third-party extension.

- Record a flow, export **W3C User Journey JSON**.
- Pipe that JSON through an LLM to a strict API, orchestration, or Playwright/Puppeteer script.

## Comparison

| Project | Ingestion | Output | Best for |
| --- | --- | --- | --- |
| Open Browser Use | Extension + local MCP | Agent tool calls / CDP streams | Live context into agent frameworks |
| Automa | Extension recorder | Structured JSON workflow | Deterministic pipelines an agent can trigger |
| OpenDevBrowser | Extension relay | 70+ CLI/agent tools | Script-first UI → programmatic tasks |
| DevTools Recorder | Native Chrome | W3C User Journey JSON | Custom codegen and API-boundary inference |

## Hackathon implication

- **Web + DOM:** prefer a recorder (DevTools JSON or Automa JSON) as ingress instead of (or before) video.
- **Desktop / no DOM:** keep video → Whisper + keyframes → VLM → FastMCP.
- Do not spend the four hours integrating all four; pick one web recorder only if the demo target is Chrome.

Sources: [Product Hunt — Open Browser Use](https://www.producthunt.com/products/open-browser-use), [OpenDevBrowser](https://github.com/freshtechbro/opendevbrowser), [Chrome DevTools recording + AI](https://www.eviltester.com/blog/eviltester/ai/chrome-dev-tools-recording-ai-writes-code/).

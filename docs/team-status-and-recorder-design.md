# Team status and recorder design

Shareable. Branch: `cursor/packages-layout-a532`

Do not duplicate `docs/deliverables.md`, `docs/hackathon-pipeline.md`, or `research/ingestion-to-workflow-for-agents.md`. This is status + the recorder contract.

---

## 1. Status

**Shipped (webapp is the demo surface):**

- pnpm monorepo: `packages/extension`, `packages/webapp/landing-page`, `packages/webapp/skill-manager`, `packages/backend`
- Landing (`:43123`): cream `#f3efed` (ninja logo), Bricolage Grotesque headlines, Open Sans body
- Dark **Download Chrome Extension** pill with Bo’s round Chrome icon (`packages/webapp/landing-page/public/chrome-icon.png`)
- Locked home copy (“Let's cut through all the bullshit!” … carpal tunnel … dreadful task … BS)
- Skill manager (`:43124`): workflow edit → Save → skill page (Add to Grok / download / optional Publish) → skill list
- `POST /api/sessions` lives in `packages/backend` (hosted by the skill manager); empty `steps` are derived from `events`
- One recording contract: `SessionPayload` + `deriveSteps` in `packages/backend` (no fourth types package)
- Extension folder is an MV3 **stub**: popup Create / Done, content-script listeners, background POST to `http://127.0.0.1:43124/api/sessions` then open `/workflows/:id`. No keys.

**Not done (this is the next work):**

- A recorder teammates can trust in a real logged-in tab (selectors, SPA navigations, 2FA pages)
- Extension UI that feels like a product (Create / Done states, errors when the skill manager is down)

Watch demo on the landing page can land a sample workflow without the extension. That does not replace the recorder.

---

## 2. Recorder technical design

**Job:** in Mary’s real Chrome, Create → she does the task → Done. Extension records live DOM + navigation, POSTs **one** `SessionPayload` JSON, redirects to the skill manager. **No API key in the extension.** Skill generation stays on the skill manager / backend.

Invent as little as possible. One recorder. Map onto `packages/backend`, do not add a second schema.

| Option | What it gives | For this hack |
| --- | --- | --- |
| **Automa** | OSS MV3 recorder; CSS/XPath; JSON **workflow graph** (nodes, conditionals) | Steal selector habits. Do **not** ship Automa’s graph or UI. |
| **Chrome DevTools Recorder** | Native; W3C User Journey JSON | Closest *idea* (steps + selectors). Operator would leave the site to record. Not the Create / Done product. Optional: map a DevTools export → `SessionPayload` later, not the demo path. |
| **Open Browser Use / OpenDevBrowser** | Extension + agent/MCP/CDP runtime | Whole platforms. Do not integrate. Pitch contrast only. |
| **rrweb** | Full DOM mutation replay (session-replay video) | Wrong artifact. We need an event AST (click/input/submit/navigate + selector), not a pixel replay. Skip. |

**Recommend:** keep the thin MV3 wrapper already in `packages/extension`. Finish it; do not vendor a recorder product.

Reuse:

- Automa / DevTools: CSS selector from the event target (`id`, `data-testid`, labeled text, short path). Not `x,y`.
- Our stub: Create injects `content.js`; Done POSTs JSON; backend `deriveSteps`.

Build (thin):

- Popup: Create / Done / idle vs recording / “skill manager not running”
- Content script: click, input, change, submit, Enter/Tab/Escape; strip password values (`••••`)
- Background: session id + `createdAt` on Create; `navigate` events on tab URL changes; re-inject after navigation
- POST body = `SessionPayload`. `steps` may be `[]`

Do not: rrweb snapshots, Automa conditionals, Playwright-from-frames, keys on the POST.

---

## 3. Recording payload example

Contract: `SessionPayload` in `packages/backend`. Start = `createdAt`. End = last `events[].ts`. Page URL/title live on each event (`url`, `title`) plus `startUrl`. Navigation is `type: "navigate"`. Selectors are CSS. Types: `click` | `input` | `change` | `submit` | `navigate` | `keydown` | `focus`.

`POST http://127.0.0.1:43124/api/sessions`  
`Content-Type: application/json`

```json
{
  "id": "session-k7q2m1",
  "createdAt": "2026-09-19T18:04:11.200Z",
  "title": "Pay a vendor bill",
  "startUrl": "https://demo.ledger.example/login",
  "events": [
    {
      "id": "evt-01",
      "ts": 1758300251200,
      "type": "navigate",
      "url": "https://demo.ledger.example/login",
      "selector": "document",
      "href": "https://demo.ledger.example/login",
      "title": "Ledger — Sign in"
    },
    {
      "id": "evt-02",
      "ts": 1758300254100,
      "type": "input",
      "url": "https://demo.ledger.example/login",
      "selector": "#email",
      "tagName": "INPUT",
      "text": "Email",
      "value": "ops@example.com",
      "title": "Ledger — Sign in"
    },
    {
      "id": "evt-03",
      "ts": 1758300256800,
      "type": "input",
      "url": "https://demo.ledger.example/login",
      "selector": "#password",
      "tagName": "INPUT",
      "text": "Password",
      "value": "••••",
      "title": "Ledger — Sign in"
    },
    {
      "id": "evt-04",
      "ts": 1758300257900,
      "type": "submit",
      "url": "https://demo.ledger.example/login",
      "selector": "form#login",
      "tagName": "FORM",
      "text": "Sign in",
      "title": "Ledger — Sign in"
    },
    {
      "id": "evt-05",
      "ts": 1758300259100,
      "type": "navigate",
      "url": "https://demo.ledger.example/bills/new",
      "selector": "document",
      "href": "https://demo.ledger.example/bills/new",
      "title": "Ledger — New bill"
    },
    {
      "id": "evt-06",
      "ts": 1758300262000,
      "type": "click",
      "url": "https://demo.ledger.example/bills/new",
      "selector": "button[data-testid='vendor-picker']",
      "tagName": "BUTTON",
      "text": "Choose vendor",
      "title": "Ledger — New bill"
    },
    {
      "id": "evt-07",
      "ts": 1758300265400,
      "type": "input",
      "url": "https://demo.ledger.example/bills/new",
      "selector": "input[name='amount']",
      "tagName": "INPUT",
      "text": "Amount",
      "value": "1840.00",
      "title": "Ledger — New bill"
    },
    {
      "id": "evt-08",
      "ts": 1758300268100,
      "type": "click",
      "url": "https://demo.ledger.example/bills/new",
      "selector": "button#save-bill",
      "tagName": "BUTTON",
      "text": "Save bill",
      "title": "Ledger — New bill"
    }
  ],
  "steps": []
}
```

Skill manager response: `{ "id": "session-k7q2m1", "workflowUrl": "http://127.0.0.1:43124/workflows/session-k7q2m1" }`. Extension opens `workflowUrl`. If `steps` is `[]`, the server fills them with `deriveSteps(events)`.

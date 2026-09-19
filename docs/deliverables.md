# ContextNinja — deliverables

**ContextNinja** plays on *contextual inquiry*: observe an engaged user in their natural environment to uncover pain points and hidden workarounds they might never think to mention. The ninja is the **Chrome extension** in **her** browser plus a **webapp** where she confirms, saves, and manages skills.

**Mary does not know Cursor and never should.** Cursor is team-only. Her product is extension + webapp + Grok. No API key in the extension. Analyze / reason / generate runs on the **webapp** after Done (server `.env` or settings). The extension never calls Grok and never ships a key.

## Operator flow (demo)

1. Install the Chrome extension. (No keys. No Cursor.)
2. Click **Create skill**. Do the real workflow (login/2FA included) while it records **DOM events and task flow**.
3. Click **Done**. Extension POSTs the session JSON and **redirects to the webapp landing page** where **that workflow is already sitting**.
4. She **edits** the visual workflow. **Save** → **skill page**.
5. Skill page actions:
   - **Add to Grok**
   - **Download**
   - optional **Publish**
6. **Homepage** lists **all trained skills** so she can manage past training tasks.
7. **Demo close:** Add to Grok (or download + upload) → prompt Grok to open the site and run the task with **computer use**.

## Ship list (hackathon)

| Piece | What it is | Done when |
| --- | --- | --- |
| Extension | Create / Done, DOM + navigation, POST JSON, redirect to webapp | Payload lands on the workflow page; **no API key** |
| Webapp — workflow landing | Visual workflow from payload, editable | Operator can edit steps |
| Webapp — skill page | After save: Add to Grok, Download, optional Publish | One click toward Grok or a file |
| Webapp — homepage | List of past trained skills | She can reopen/manage them |
| Skill artifact | Grok computer-use skill | Prompt replays the taught site task |
| Traceability | Steps tied to recorded DOM events on the landing page | Judge can see event → step |

Skill-creator logic (understand the payload, emit the Grok skill) **lives behind the webapp**, not in Cursor, not in the extension.

## Out of this demo

- Asking Mary to install Cursor or run a skill there.
- API key in the extension or on the session POST.
- Video as the compiler.
- Recording on Grok’s cloud computer (teach stays in her Chrome).
- Narration requirement.

## Open (do not block the slice)

- Exact Grok skill file shape and what **Add to Grok** can do in four hours (deep link vs download+upload).
- Publish target (public gallery vs private list only).
- Localhost vs hosted webapp for the judge laptop.

## Package map

| Path | Role |
| --- | --- |
| `apps/extension` | MV3 Create / Done. DOM + navigation. POST JSON. Redirect. **No API key.** |
| `apps/web` | Workflow landing, save, skill page, homepage skill list |
| `packages/session` | Shared session payload, steps, Grok skill text |
| `docs/brand/contextninja-logo.png` | Accepted mark (also `apps/web/public/logo.png`) |

`apps/web` type lock: headlines **Bricolage Grotesque**, body **Open Sans**.

## Related local docs

- `docs/product-name.md` — ContextNinja
- `docs/hackathon-pipeline.md` — recorder → AST → artifact
- `docs/huddle-video-vs-live.md` — why live DOM vs video
- `research/ingestion-to-workflow-for-agents.md` — Open Browser Use, Automa, OpenDevBrowser, DevTools Recorder

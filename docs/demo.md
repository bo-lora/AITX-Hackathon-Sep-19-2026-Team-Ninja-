# Demo

**Train** needs the Chrome extension. **Run** is the next referral fax on OpenEMR. They are not the same click.

The job is a referral PDF: inbox → EHR login → four screens (patient, visit, insurance, attach fax). Not billing.

## On the laptop (before anyone walks up)

Needs Node 20+, Python 3, and `pdftotext` (`brew install poppler` on macOS).

```bash
pnpm install
cd packages/engine && npm install && npx playwright install chromium && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium && cd ../..
```

Two terminals:

```bash
pnpm dev
```

```bash
npm start --prefix packages/engine
```

Chrome → Extensions → Load unpacked → `packages/extension`.

Check:

- Landing: http://127.0.0.1:43123
- Team: http://127.0.0.1:43123/team
- Skill manager: http://127.0.0.1:43124
- Engine: `curl -s http://127.0.0.1:4710/health` → `{"ok":true,...}`

OpenEMR stage copy is `https://demo.openemr.io/a/openemr`. Login `admin` / `pass`. Fake patients only, named `HACKDEMO-…`.

## Train

1. Open http://127.0.0.1:43123 and download the extension (or load `packages/extension` unpacked)
2. Click **Create skill**
3. Do one referral in her Chrome: email → login → patient, visit, insurance, attach the PDF
4. **Done** — the taught path lands in the skill manager
5. **Save** → skill page → **Download skill folder** if you want the artifact

Password stays in the login page. It is never stored in the skill.

## Run (after a skill exists)

1. Open the skill → **Run in OpenEMR**
2. If a login window opens, type `pass` there — never into chat
3. Watch the headed browser fill the **next** referral PDF onto the four screens
4. **Open review** — fax vs what was saved

If you skip train, **Skip train — open a taught skill** on the landing seeds the referral path so you can still Run.

If Run says the engine is down, the second terminal is not up.

## What to say

- Train is live Chrome because those screens do not all hydrate, and her cookies are in her browser.
- Run is Playwright on the stage EHR, not REST. Attach-fax and billing have no API worth calling.
- These are **these referral faxes** (three known layouts), not any fax on earth.
- Video, if you show one, is the **after** shot: the agent filling OpenEMR. It is not how she trains.

## Later (not this demo)

`packages/compiler` can ground a **taught** path onto OpenAPI where the spec has the call, and leave the rest on the UI. It does not replace the extension. Billing staying unmapped is the point of that work.

## If something is already logged in

`GET http://127.0.0.1:4710/status?site=a` should mention `LOGGED_IN`. Otherwise Run will pop login again. One browser job at a time.

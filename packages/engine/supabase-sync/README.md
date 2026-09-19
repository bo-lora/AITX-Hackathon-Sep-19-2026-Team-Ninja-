# supabase-sync: audit trail + public review link

Syncs one OpenEMR referral-intake run to Supabase:
- **Tables** (`schema.sql`): `runs`, `referrals`, `steps`, `reviews`.
- **Public Storage bucket `demo-runs`**: a standalone review page (`index.html`), `run/report.html`, screenshots, and the referral PDFs. Links are rewritten to be relative, so the page works without the local server.
- Prints `PUBLIC URL: <SUPABASE_URL>/storage/v1/object/public/demo-runs/<run_id>/index.html`.

It is **optional**. If `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are missing from `<repo>/.env`, it prints `keys absent — skipped` and exits 0. Key values are never printed or logged. It needs only Python 3 stdlib and `pdftotext` (poppler), which the PDF safety check uses.

## One-time setup
1. Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `<repo>/.env`.
2. Supabase dashboard → SQL Editor → paste `schema.sql` → Run. The script creates the bucket itself, but it cannot create tables because the REST API has no DDL. Until the schema is applied, uploads still work and each table upsert logs `FAILED … apply schema.sql`.

## Usage
```
<repo>/supabase-sync/supabase-sync <run_dir|intake_dir>          # upsert + upload, prints public URL
<repo>/supabase-sync/supabase-sync <dir> --dry-run               # safety check + counts only
<repo>/supabase-sync/supabase-sync <intake_dir> --reviews-only   # write review.json verdicts to `reviews`
```
Accepted inputs: an automation-server `intake/<id>/` folder (it follows `intake.json.run_id` to `test-runner/runs/<run_id>/`), or a test-runner `runs/<run_id>/` folder.

## Hook for the /intake owner (automation-server, not edited by this task)
After `/intake` writes `intake.json` and `review.html` (server.ts, right after `fs.writeFileSync(path.join(work, 'review.html'), …)`), add this one line to the server:
```
run(path.join(ROOT, 'supabase-sync', 'supabase-sync'), [work]).then(r => log('supabase-sync:', (r.out.match(/PUBLIC URL: \S+/) || ['skipped'])[0])).catch(() => {});
```
Shell equivalent:
```
<repo>/supabase-sync/supabase-sync "$INTAKE_DIR" || true
```
In `POST /review/<id>/mark`, after `review.json` is written:
```
<repo>/supabase-sync/supabase-sync "$INTAKE_DIR" --reviews-only || true
```
It is safe to run repeatedly: storage uses `x-upsert` and the tables use primary-key upserts.

## Safety check (runs before every upload; any failure means nothing is uploaded)
- No file whose path contains session / cookie / storageState, and no `auth*.json`. JSON files are never collected in the first place.
- Every HTML file and every PDF (text read with `pdftotext`) is checked for `PHPSESSID`, `cookie`, `storageState`, `Authorization`, `SERVICE_ROLE`, and any literal value of a `*KEY*`, `*TOKEN*`, `*SECRET*` or `*PASSWORD*` variable in `.env`. The check is case-insensitive.
- Every patient last name in the run (report `LNAME` and extracted `last_name`) must start with `HACKDEMO-`. Every PDF must contain `HACKDEMO-` and have a HACKDEMO `RE: Referral - …` name.
- Screenshots are uploaded only when the run is HACKDEMO-only, **and** only `rNN-<step>-verify.png` / `final-*.png` are published. `before`, `after` and `setup-*` shots are withheld: on 2026-09-19 at 12:55, `r01-patient-before.png` and `setup-login-verify.png` showed the shared Patient Finder list with other public users' patients. In the published report.html, those images are replaced with a "screenshot not published" placeholder.
- Local absolute paths (`/Users/...`) are removed from the published HTML.
- The public review page's Looks right / Something's wrong buttons are made read-only. Verdicts are recorded only through Mary's local page → `review.json` → `--reviews-only`.

Results go to `sync.log` (no key values).

## Tests
`python3 test/test_sync.py` covers: the no-keys skip; each safety-check block case; review.json → `reviews`; link rewriting; end-to-end sync of real runs against a local mock of the Supabase REST + Storage API (`test/mock_supabase.py`), which fetches every relative link on the public pages and expects HTTP 200; and idempotent re-sync.

`wait-for-keys.sh` polls `.env` every 2 minutes and prints only present/absent for each variable name.

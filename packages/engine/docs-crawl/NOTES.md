# NOTES — handoff 17 (M) docs crawl. FINAL, 13:19 CDT: stopped at the hard cut with no real crawl

REAL CRAWL: NOT RUN. <repo>/.env was absent (checked 12:46 and then every 20s until 13:18; still absent at 13:19), so no APIFY_TOKEN and no Supabase keys.
Per the spec, the cached docs-facts stay the source of truth for the demo.

What was built and verified (all against local stand-ins, not Supabase):
- schema.sql applied cleanly to a throwaway local Postgres 15 (docker, container hack-docscrawl-pg); search_docs() returns ranked passages.
  Applying it to the real Supabase project is UNVERIFIED (needs a human to paste it into the SQL editor; PostgREST cannot run DDL).
- Mock dataset = the 8 cached open-emr.org wiki pages in docs-facts/sources (not a crawl). 75 passages after dropping table-of-contents blocks.
- docs-search returns 3 cited passages for each of the 3 required queries on both mock (sqlite FTS5) and localpg (the real SQL function).
- Fact recovery (quote text found inside a top-3 passage), results/*.json:
  mock:    5 of 8 facts (F1 F2 F4 F5 F7); localpg: 4 of 8 (F1 F2 F4 F5). F3 and F8 are github.com sources, out of crawl scope by design. F6 missed on both with the query "appointment status encounter".
- Apify actor input field names checked against the public input schema of the apify/website-content-crawler build tagged version-0 (all 10 fields exist). Which build a run uses by default is UNVERIFIED.
- Seed URLs (7 wiki pages) each returned HTTP 200 (one GET each, 12:53).
- The Supabase load path (supabase_load / supabase_search) has NEVER been run against a real project: UNVERIFIED.

To finish when keys exist (about 5 minutes):
1. Paste schema.sql into Supabase SQL editor.
2. python3 crawl.py            (prints actor run id + usageTotalUsd; writes crawl/run-log.json, crawl/items.json)
3. python3 check_facts.py --backend supabase
- Local Postgres container hack-docscrawl-pg stopped at 13:19 (re-create with: docker run -d --rm --name hack-docscrawl-pg -e POSTGRES_PASSWORD=mock -p 55439:5432 postgres:15-alpine, then psql < schema.sql).

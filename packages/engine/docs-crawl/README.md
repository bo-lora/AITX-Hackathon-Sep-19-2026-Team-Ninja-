# docs-crawl (handoff 17 / M): Apify docs crawl -> Postgres full-text search -> "docs say"

Stdlib Python only. Optional: with no keys everything falls back to a local sqlite FTS5 mock.

Files
- schema.sql        tables `docs` (url,title,text + tsvector) and `doc_passages` (tsvector, GIN), RPC `search_docs(q,n)`. Paste once into the Supabase SQL editor (PostgREST cannot run DDL).
- crawl.py          `--mock` loads cached <repo>/docs-facts/sources/*.txt; no flag = real Apify run (apify/website-content-crawler, cheerio, maxCrawlPages=40, timeout 600s, include globs on open-emr.org/wiki topics) -> crawl/items.json + crawl/run-log.json (run id, usageTotalUsd) -> mock + Supabase. `--load-only` reloads items.json. `--print-input` shows the actor input.
- docs-search       `./docs-search "<query>" [--backend mock|localpg|supabase] [--json]` -> top 3 passages, URL + verbatim snippet (exact substring of the stored text; text mode shows newlines as " / ", --json is exact).
- check_facts.py    runs the 3 required queries + one query per docs-facts fact; writes results/<backend>-facts-check.json.
- docslib.py        dotenv loader (prints only present/absent), chunking, backends.

Keys (<repo>/.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFY_TOKEN. Never printed.
Backend default: supabase if both Supabase keys present, else mock.

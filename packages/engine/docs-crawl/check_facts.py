#!/usr/bin/env python3
"""Do the known docs-facts come back for their queries? Writes results/<backend>-facts-check.json + the 3 required queries."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import docslib

FACTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs-facts/facts.json")
QUERIES = {
    "F1-required-fields": "new patient required fields",
    "F2-new-search-only-way": "manually add new patients",
    "F3-duplicate-check": "duplicate patient check",
    "F4-appointment-from-calendar": "click time open appointment scheduler dialog",
    "F5-appointment-category": "appointment category",
    "F6-appointment-status-side-effects": "appointment status encounter",
    "F7-find-available-needs-schedule": "provider not available calendar",
    "F8-api-must-be-enabled": "enable REST API",
}
REQUIRED = ["new patient required fields", "appointment category", "insurance"]
norm = lambda s: re.sub(r"\s+", " ", s).strip().lower()

docslib.load_env()
backend = sys.argv[sys.argv.index("--backend") + 1] if "--backend" in sys.argv else None
out = {"required_queries": {}, "facts": []}
for q in REQUIRED:
    used, res = docslib.search(q, 3, backend)
    out["backend"] = used
    out["required_queries"][q] = [{"url": r["url"], "title": r["title"], "snippet": r["snippet"]} for r in res]
rec = 0
for f in json.load(open(FACTS)):
    q = QUERIES.get(f["id"], f["fact"][:60])
    _, res = docslib.search(q, 3, backend)
    in_scope = f["url"].startswith(docslib.ALLOWED_PREFIX)
    hit_url = any(r["url"] == f["url"] for r in res)
    hit_quote = any(norm(f["quote"])[:80] in norm(r["passage"]) for r in res)
    rec += hit_quote
    out["facts"].append({"id": f["id"], "query": q, "fact_url": f["url"], "in_crawl_scope": in_scope,
                         "top3_urls": [r["url"] for r in res], "url_in_top3": hit_url, "quote_in_top3_passage": hit_quote})
    print("%-38s %-8s url_in_top3=%-5s quote_recovered=%s  (q=%r)" % (f["id"], "wiki" if in_scope else "OFFSCOPE", hit_url, hit_quote, q))
out["recovered"] = "%d of %d facts (%d of them are wiki pages in crawl scope)" % (rec, len(out["facts"]), sum(x["in_crawl_scope"] for x in out["facts"]))
print(out["recovered"], "backend:", out["backend"])
os.makedirs(os.path.join(docslib.HERE, "results"), exist_ok=True)
json.dump(out, open(os.path.join(docslib.HERE, "results", "%s-facts-check.json" % out["backend"]), "w"), indent=2)

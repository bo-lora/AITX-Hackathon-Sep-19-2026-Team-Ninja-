#!/usr/bin/env python3
"""Run apify/website-content-crawler on open-emr.org wiki (<=40 pages), then load into the store.

  python3 crawl.py --mock          # no keys: load cached docs-facts/sources/*.txt into sqlite mock
  python3 crawl.py                 # APIFY_TOKEN present: real crawl -> crawl/items.json -> Supabase (or mock if no Supabase keys)
  python3 crawl.py --load-only     # reload crawl/items.json into the store
Never prints secret values. Token goes in the Authorization header, never in a URL.
"""
import glob, json, os, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import docslib

HERE = docslib.HERE
OUT = os.path.join(HERE, "crawl")
LOG = os.path.join(OUT, "run-log.json")
FACTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs-facts/facts.json")
W = "https://www.open-emr.org/wiki/index.php/"
EXTRA_SEEDS = ["HOWTO:_Create_a_New_Patient_Record_-_OpenEMR_v7", "OpenEMR_7_Calendar", "Calendar_Categories",
               "AppointmentStatuses-v7", "OpenEMR_7_Search_-_Add_Patient", "TheCalendarNotes-v7"]
TOPICS = ["Patient", "patient", "Registration", "Demographic", "Insurance", "insurance", "Document", "document",
          "Calendar", "calendar", "Appointment", "appointment", "Categor", "Scheduling", "Front_Desk", "Flow_Board"]
MAX_PAGES = 40


def seeds():
    urls = []
    for f in json.load(open(FACTS)):
        if f["url"].startswith(docslib.ALLOWED_PREFIX) and f["url"] not in urls:
            urls.append(f["url"])
    for s in EXTRA_SEEDS:
        if W + s not in urls:
            urls.append(W + s)
    return urls


def actor_input():
    return {
        "startUrls": [{"url": u} for u in seeds()],
        "crawlerType": "cheerio",
        "maxCrawlPages": MAX_PAGES,
        "maxResults": MAX_PAGES,
        "maxCrawlDepth": 2,
        "includeUrlGlobs": [{"glob": W + "*%s*" % t} for t in TOPICS],
        "excludeUrlGlobs": [{"glob": g} for g in [W + "Special:*", W + "*action=*", W + "User*", W + "Talk:*",
                                                  W + "File:*", W + "Category:*", "https://www.open-emr.org/wiki/index.php?*"]],
        "saveMarkdown": False,
        "saveHtml": False,
        "removeCookieWarnings": True,
    }


def apify(method, path, body=None):
    h = {"Authorization": "Bearer " + os.environ["APIFY_TOKEN"], "Content-Type": "application/json"}
    req = urllib.request.Request("https://api.apify.com/v2" + path, method=method, headers=h,
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read())


def real_crawl():
    os.makedirs(OUT, exist_ok=True)
    inp = actor_input()
    json.dump(inp, open(os.path.join(OUT, "actor-input.json"), "w"), indent=2)
    run = apify("POST", "/acts/apify~website-content-crawler/runs?timeout=600&memory=2048", inp)["data"]
    rid = run["id"]
    print("actor run id:", rid, flush=True)
    log = {"run_id": rid, "started": run.get("startedAt"), "dataset_id": run.get("defaultDatasetId")}
    json.dump(log, open(LOG, "w"), indent=2)
    while run["status"] in ("READY", "RUNNING"):
        time.sleep(10)
        run = apify("GET", "/actor-runs/%s?waitForFinish=50" % rid)["data"]
        print("status:", run["status"], "pages so far:", (run.get("stats") or {}).get("requestsFinished"), flush=True)
    items = apify("GET", "/datasets/%s/items?clean=true&format=json&limit=%d" % (run["defaultDatasetId"], MAX_PAGES + 5)) \
        if False else None
    req = urllib.request.Request("https://api.apify.com/v2/datasets/%s/items?clean=true&format=json&limit=%d"
                                 % (run["defaultDatasetId"], MAX_PAGES + 5),
                                 headers={"Authorization": "Bearer " + os.environ["APIFY_TOKEN"]})
    with urllib.request.urlopen(req, timeout=90) as r:
        items = json.loads(r.read())
    log.update({"status": run["status"], "finished": run.get("finishedAt"),
                "usage_total_usd": run.get("usageTotalUsd"), "usage": run.get("usage"),
                "stats": run.get("stats"), "items": len(items)})
    json.dump(log, open(LOG, "w"), indent=2)
    json.dump(items, open(os.path.join(OUT, "items.json"), "w"), indent=1)
    print("run status:", run["status"], "items:", len(items), "usageTotalUsd:", run.get("usageTotalUsd"))
    return rid, items


def pages_from_items(items):
    pages = []
    for it in items:
        url = it.get("url") or ""
        if not url.startswith(docslib.ALLOWED_PREFIX):
            print("SKIP off-scope url:", url); continue
        title = (it.get("metadata") or {}).get("title") or url.rsplit("/", 1)[-1]
        text = it.get("text") or ""
        if text.strip():
            pages.append({"url": url, "title": title, "text": text})
    return pages[:MAX_PAGES]


def mock_pages():
    pages = []
    for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs-facts/sources/*.txt"))):
        name = os.path.basename(f)[:-4]
        text = open(f, encoding="utf-8").read()
        if len(text) < 100:
            continue
        slug = name.replace("HOWTO__", "HOWTO:_")
        pages.append({"url": W + slug, "title": slug.replace("_", " "), "text": text})
    return pages


def store(pages, rid):
    d, p = docslib.mock_load(pages, rid)
    print("loaded into mock sqlite: docs=%s passages=%s" % (d, p))
    if docslib.have_supabase():
        try:
            d, p = docslib.supabase_load(pages, rid)
            print("loaded into supabase (re-read): docs=%s passages=%s" % (d, p))
        except Exception as e:  # never fatal: the crawl result is already on disk + in the mock
            print("SUPABASE LOAD FAILED:", str(e)[:300])


if __name__ == "__main__":
    status = docslib.load_env()
    print("keys:", ", ".join("%s %s" % kv for kv in status.items()))
    if "--mock" in sys.argv:
        pages = mock_pages()
        d, p = docslib.mock_load(pages, "mock-docs-facts-sources")
        print("MOCK loaded from cached docs-facts sources: docs=%d passages=%d" % (d, p))
    elif "--load-only" in sys.argv:
        items = json.load(open(os.path.join(OUT, "items.json")))
        store(pages_from_items(items), json.load(open(LOG)).get("run_id"))
    elif "--print-input" in sys.argv:
        print(json.dumps(actor_input(), indent=2))
    else:
        if not os.environ.get("APIFY_TOKEN"):
            sys.exit("APIFY_TOKEN absent: nothing crawled. Use --mock.")
        rid, items = real_crawl()
        store(pages_from_items(items), rid)

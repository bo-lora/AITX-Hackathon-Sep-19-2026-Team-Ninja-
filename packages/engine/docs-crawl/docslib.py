"""Shared helpers for docs-crawl. Stdlib only. NEVER prints secret values."""
import json, os, re, sqlite3, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
KEYS = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APIFY_TOKEN")
MOCK_DB = os.path.join(HERE, "mock", "docs.sqlite")
ALLOWED_PREFIX = "https://www.open-emr.org/wiki/"


def load_env():
    """Parse the dotenv file into os.environ without echoing anything."""
    if os.path.exists(ENV_PATH):
        for line in open(ENV_PATH, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip().removeprefix("export ").strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    return {k: ("present" if os.environ.get(k) else "absent") for k in KEYS}


def have_supabase():
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


# ---------- chunking ----------
def chunk(text, target=700):
    paras = [p.strip() for p in re.split(r"\n\s*\n|\n(?=\s*[#*\-\d])", text) if p.strip()]
    out, buf = [], ""
    for p in paras:
        if len(p) > target * 2:  # split very long paragraphs on sentence ends
            for s in re.split(r"(?<=[.!?])\s+", p):
                if buf and len(buf) + len(s) > target:
                    out.append(buf); buf = ""
                buf = (buf + " " + s).strip()
            continue
        if buf and len(buf) + len(p) > target:
            out.append(buf); buf = ""
        buf = (buf + "\n" + p).strip()
    if buf:
        out.append(buf)
    return [c for c in out if not is_toc(c)]


def is_toc(c):
    """Drop wiki table-of-contents blocks ('Contents / 1 Intro / 2.1 ...'): they match every query."""
    lines = [l for l in c.splitlines() if l.strip()]
    numbered = sum(1 for l in lines if re.match(r"^\s*(Contents|\d+(\.\d+)*\s)", l))
    return len(lines) >= 3 and numbered / len(lines) > 0.6


def terms(q):
    return [w for w in re.split(r"[^a-z0-9]+", q.lower()) if len(w) > 1]


def snippet(passage, q, width=450):
    """Return an EXACT substring of passage (verbatim) centred on the densest match."""
    if len(passage) <= width:
        return passage
    low = passage.lower()
    ts = [t[:5] for t in terms(q)]
    best, best_i = -1, 0
    for i in range(0, max(1, len(passage) - width + 1), 20):
        win = low[i:i + width]
        score = sum(win.count(t) for t in ts) + 2 * sum(1 for t in ts if t in win)
        if score > best:
            best, best_i = score, i
    s = best_i
    while s > 0 and not passage[s - 1].isspace() and best_i - s < 30:
        s -= 1
    return passage[s:s + width]


# ---------- mock backend (sqlite FTS5, same shape as Supabase) ----------
def mock_conn():
    os.makedirs(os.path.dirname(MOCK_DB), exist_ok=True)
    c = sqlite3.connect(MOCK_DB)
    c.execute("create table if not exists docs(url text primary key, title text, text text, run_id text)")
    c.execute("create virtual table if not exists doc_passages using fts5(url unindexed, title, seq unindexed, passage, tokenize='porter')")
    return c


def mock_load(pages, run_id):
    c = mock_conn()
    for p in pages:
        c.execute("delete from doc_passages where url=?", (p["url"],))
        c.execute("insert or replace into docs values(?,?,?,?)", (p["url"], p["title"], p["text"], run_id))
        for i, ps in enumerate(chunk(p["text"])):
            c.execute("insert into doc_passages values(?,?,?,?)", (p["url"], p["title"], i, ps))
    c.commit()
    return c.execute("select count(*) from docs").fetchone()[0], c.execute("select count(*) from doc_passages").fetchone()[0]


def mock_search(q, n=3):
    c = mock_conn()
    ts = terms(q)
    if not ts:
        return []
    match = " OR ".join('"%s"*' % t for t in ts)
    rows = c.execute("select url,title,passage,bm25(doc_passages,0,1,0,2) r from doc_passages where doc_passages match ? order by r limit ?", (match, n)).fetchall()
    return [{"url": u, "title": t, "passage": p, "rank": -r} for u, t, p, r in rows]


# ---------- Supabase backend (PostgREST) ----------
def _sb(method, path, body=None, prefer=None):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:500]


def supabase_load(pages, run_id):
    st, body = _sb("POST", "/rest/v1/docs?on_conflict=url",
                   [{"url": p["url"], "title": p["title"], "text": p["text"], "run_id": run_id} for p in pages],
                   prefer="resolution=merge-duplicates,return=minimal")
    if st >= 300:
        raise RuntimeError("docs upsert failed HTTP %s: %s (did you run schema.sql?)" % (st, body))
    rows = []
    for p in pages:
        for i, ps in enumerate(chunk(p["text"])):
            rows.append({"url": p["url"], "title": p["title"], "seq": i, "passage": ps})
    urls = ",".join('"%s"' % p["url"].replace('"', '') for p in pages)
    _sb("DELETE", "/rest/v1/doc_passages?url=in.(%s)" % urllib.request.quote(urls, safe='(),"'))
    for i in range(0, len(rows), 200):
        st, body = _sb("POST", "/rest/v1/doc_passages", rows[i:i + 200], prefer="return=minimal")
        if st >= 300:
            raise RuntimeError("passages insert failed HTTP %s: %s" % (st, body))
    # re-read (a 2xx is a transport claim, not a state claim)
    st, d = _sb("GET", "/rest/v1/docs?select=url", prefer="count=exact")
    st2, p2 = _sb("GET", "/rest/v1/doc_passages?select=id", prefer="count=exact")
    return (len(d) if isinstance(d, list) else d), (len(p2) if isinstance(p2, list) else p2)


def supabase_search(q, n=3):
    st, body = _sb("POST", "/rest/v1/rpc/search_docs", {"q": q, "n": n})
    if st >= 300:
        raise RuntimeError("search_docs RPC failed HTTP %s: %s" % (st, body))
    return body


def search(q, n=3, backend=None):
    backend = backend or ("supabase" if have_supabase() else "mock")
    rows = (supabase_search(q, n) if backend == "supabase" else
            localpg_search(q, n) if backend == "localpg" else mock_search(q, n))
    return backend, [{"url": r["url"], "title": r["title"], "snippet": snippet(r["passage"], q), "passage": r["passage"]} for r in rows]


# ---------- local Postgres (docker) backend: runs the SAME schema.sql search_docs() as Supabase ----------
def localpg_search(q, n=3, container="hack-docscrawl-pg"):
    import subprocess
    sql = "select coalesce(json_agg(r),'[]') from search_docs(%s, %d) r" % ("'" + q.replace("'", "''") + "'", n)
    out = subprocess.run(["docker", "exec", container, "psql", "-U", "postgres", "-At", "-c", sql],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)

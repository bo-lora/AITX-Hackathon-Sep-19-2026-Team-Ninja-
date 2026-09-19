"""Minimal local mock of the Supabase REST + Storage endpoints supabase-sync uses. Stores in memory."""
import json, re, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

KEY = 'mock-service-role-key-0123456789'
STATE = {'buckets': {}, 'objects': {}, 'tables': {t: {} for t in ('runs', 'referrals', 'steps', 'reviews')}}
PK = {'runs': ('id',), 'referrals': ('run_id', 'referral'), 'steps': ('run_id', 'referral', 'step'), 'reviews': ('run_id', 'referral')}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, st, body=b'', ctype='application/json', extra=None):
        self.send_response(st); self.send_header('content-type', ctype)
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.send_header('content-length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def _auth(self):
        return self.headers.get('apikey') == KEY and self.headers.get('Authorization') == 'Bearer ' + KEY

    def _body(self):
        return self.rfile.read(int(self.headers.get('content-length') or 0))

    def do_GET(self):
        u = urlparse(self.path)
        m = re.match(r'^/storage/v1/object/public/([^/]+)/(.+)$', u.path)
        if m:
            b, o = m.group(1), unquote(m.group(2))
            if not STATE['buckets'].get(b, {}).get('public'): return self._send(400, b'{"error":"not public"}')
            if (b, o) not in STATE['objects']: return self._send(404, b'{"error":"not found"}')
            data, ct = STATE['objects'][(b, o)]; return self._send(200, data, ct)
        m = re.match(r'^/rest/v1/(\w+)$', u.path)
        if m:
            if not self._auth(): return self._send(401)
            rows = list(STATE['tables'][m.group(1)].values())
            for k, v in parse_qs(u.query).items():
                if k in ('select', 'limit'): continue
                val = v[0].removeprefix('eq.'); rows = [r for r in rows if str(r.get(k)) == val]
            return self._send(200, json.dumps(rows[:1]).encode(), extra={'content-range': f'0-0/{len(rows)}'})
        self._send(404)

    def do_PUT(self):
        if not self._auth(): return self._send(401)
        b = json.loads(self._body() or b'{}'); m = re.match(r'^/storage/v1/bucket/([^/]+)$', self.path)
        if m: STATE['buckets'][m.group(1)] = b; return self._send(200, b'{}')
        self._send(404)

    def do_POST(self):
        if not self._auth(): return self._send(401, b'{"error":"bad key"}')
        u = urlparse(self.path); body = self._body()
        if u.path == '/storage/v1/bucket':
            b = json.loads(body)
            if b['id'] in STATE['buckets']: return self._send(400, b'{"error":"Duplicate","message":"The resource already exists"}')
            STATE['buckets'][b['id']] = b; return self._send(200, b'{}')
        m = re.match(r'^/storage/v1/object/([^/]+)/(.+)$', u.path)
        if m:
            if m.group(1) not in STATE['buckets']: return self._send(404, b'{"error":"bucket not found"}')
            STATE['objects'][(m.group(1), unquote(m.group(2)))] = (body, self.headers.get('content-type')); return self._send(200, b'{}')
        m = re.match(r'^/rest/v1/(\w+)$', u.path)
        if m:
            t = m.group(1)
            if t not in STATE['tables']: return self._send(404, b'{"code":"PGRST205"}')
            for r in json.loads(body):
                STATE['tables'][t][tuple(r[k] for k in PK[t])] = r
            return self._send(201)
        self._send(404)


def start(port=0):
    s = ThreadingHTTPServer(('127.0.0.1', port), H); threading.Thread(target=s.serve_forever, daemon=True).start(); return s


if __name__ == '__main__':
    s = start(int(sys.argv[1]) if len(sys.argv) > 1 else 54329); print('mock on', s.server_address); threading.Event().wait()

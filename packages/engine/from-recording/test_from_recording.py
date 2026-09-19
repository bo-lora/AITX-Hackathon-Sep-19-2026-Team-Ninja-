import json, subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import from_recording as fr
U = "https://demo.openemr.io/openemr/interface/new/new.php"
def ev(i, kind, **k):
    d = {"i": i, "t": i * 1.0, "kind": kind, "frame_url": U, "frame_title": "x"}; d.update(k); return d
def run(evs): return fr.convert({"events": evs})[0]
# focus click + fill -> one step
s = run([ev(1, "click", tag="input", type="text", selector="#form_fname", label="Name:"), ev(2, "fill", tag="input", type="text", selector="#form_fname", label="Name:", value="Maria")])
assert [(x["field_label"], x["value"], x["action"]) for x in s] == [("First Name", "Maria", "type")], s
# retype keeps last value
s = run([ev(1, "fill", tag="input", type="text", selector="#a", label="City", value="Aus"), ev(2, "fill", tag="input", type="text", selector="#a", label="City", value="Austin")])
assert len(s) == 1 and s[0]["value"] == "Austin", s
# repeated click merged
s = run([ev(1, "click", tag="button", selector="#b", text="Save"), dict(ev(2, "click", tag="button", selector="#b", text="Save"), t=1.3)])
assert len(s) == 1, s
# submit after button click merged
s = run([ev(1, "click", tag="button", type="submit", selector="#b", text="Save"), dict(ev(2, "submit", tag="form", selector="#f"), t=1.2)])
assert len(s) == 1 and s[0]["action"] == "click", s
# password masked even if recorder missed it (text-type field labelled Password), and token in URL masked
s = run([ev(1, "fill", tag="input", type="text", selector="#pw", label="Password:", value="pass"), {"i": 2, "t": 50, "kind": "navigate", "frame_url": "https://x/main.php?<redacted>"}])
assert s[0]["value"] == "[hidden]" and "abc123" not in json.dumps(s), s
# empty-space click dropped
assert run([ev(1, "click", tag="div", selector="body > div", text="", label="")]) == []
# CLI end-to-end on SAMPLE: no password leaks, 3-5 bullets
here = os.path.dirname(os.path.abspath(__file__))
out = subprocess.run([os.path.join(here, "from-recording"), os.path.join(here, "samples/SAMPLE-events.json")], capture_output=True, text=True, env={k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"})
d = json.loads(out.stdout)
assert 3 <= len(d["bullets"]) <= 5 and all(set(x) == {"screen", "field_label", "value", "action"} for x in d["steps"])
assert '"pass"' not in out.stdout
print("ALL TESTS PASSED (7 checks)")
# ---- Chrome DevTools Recorder adapter ----
TOK = "SECRETTOKEN123"
chrome = {"title": "t", "steps": [
    {"type": "setViewport", "width": 900, "height": 800},
    {"type": "navigate", "url": "https://demo.openemr.io/openemr/interface/main/tabs/main.php?<redacted>" + TOK + "&x=1"},
    {"type": "click", "target": "main", "selectors": [["aria/Search by any demographics"], ["#anySearchBox"]]},
    {"type": "change", "value": "B", "selectors": [["aria/Search by any demographics"], ["#anySearchBox"]], "target": "main"},
    {"type": "keyUp", "key": "b", "target": "main"},
    {"type": "change", "value": "Billy Sm", "selectors": [["aria/Search by any demographics"], ["#anySearchBox"]], "target": "main"},
    {"type": "change", "value": "Billy Smith", "selectors": [["aria/Search by any demographics"], ["#anySearchBox"]], "target": "main"},
    {"type": "keyDown", "key": "Enter", "target": "main"}, {"type": "keyUp", "key": "Enter", "target": "main"},
    {"type": "click", "target": "main", "frame": [3], "selectors": [["aria/Jean, Billy J[role=\"link\"]"], ["#pt_table a"], ["text/Jean, Billy J"]]},
    {"type": "click", "target": "main", "frame": [4], "selectors": [["aria/Demographics "], ["div > a"]]},
    {"type": "click", "target": "main", "selectors": [["a > span"], ["xpath///x"], ["text/Billy Jean"]]},
]}
assert fr.is_chrome_recorder(chrome) and not fr.is_chrome_recorder({"events": []})
ev2, _ = fr.from_chrome_recorder(chrome); st = fr.convert(ev2)[0]
types = [x for x in st if x["action"] == "type"]
assert [(x["field_label"], x["value"]) for x in types] == [("Search by any demographics", "Billy Smith")], st   # keystroke merge
labels = [x["field_label"] for x in st if x["action"] == "click"]
assert labels == ["Jean, Billy J", "Demographics", "Billy Jean"], labels                                         # aria/text preferred, role + icon glyph stripped
assert st[3]["screen"].endswith("frame [3]") and st[4]["screen"].endswith("frame [4]"), st                       # frame paths kept
assert [x["action"] for x in st][:3] == ["open", "type", "press"], st
p = os.path.join(here, "samples", "_chrome_test.json"); json.dump(chrome, open(p, "w"))
o = subprocess.run([os.path.join(here, "from-recording"), p, "--debug"], capture_output=True, text=True, env={k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"})
os.remove(p)
assert o.returncode == 0 and TOK not in o.stdout and "token_main" not in o.stdout and "?<redacted>" in o.stdout, o.stdout[:500]  # token stripping
assert json.loads(o.stdout)["_debug"]["input_format"] == "Chrome DevTools Recorder"
print("ALL ADAPTER TESTS PASSED (6 checks)")

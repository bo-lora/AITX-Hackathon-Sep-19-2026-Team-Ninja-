#!/usr/bin/env python3
"""Score extracted.json against the answer key. This is the ONLY file that reads referrals.json."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
key = json.load(open(os.path.join(HERE, "..", "referrals", "referrals.json")))
got = {r["file"]: r for r in json.load(open(os.path.join(HERE, "extracted.json")))}
out, tot, ok, mism = [], 0, 0, []
for exp in key:
    f = exp["file"]; g = got.get(f, {})
    n = m = 0; lines = []
    for k, v in exp.items():
        gv = g.get(k, "<MISSING>")
        n += 1
        if gv == v:
            m += 1; lines.append(f"  MATCH     {k}")
        else:
            lines.append(f"  MISMATCH  {k}: expected {json.dumps(v)} got {json.dumps(gv)}")
            mism.append(f"{f} {k}: expected {json.dumps(v)} got {json.dumps(gv)}")
    tot += n; ok += m
    out.append(f"{f} ({exp['template']}{', faxed' if exp['faxed_look'] else ''}): {m}/{n} fields")
    out.extend(lines)
hdr = [f"OVERALL: {ok}/{tot} fields correct ({100*ok/tot:.1f}%) across {len(key)} PDFs",
       "Extractor: deterministic label parsing (pdftotext -layout), no LLM (ANTHROPIC_API_KEY not set).",
       f"Mismatches: {len(mism)}"] + [f"  {x}" for x in mism] + [""]
txt = "\n".join(hdr + out) + "\n"
open(os.path.join(HERE, "score.txt"), "w").write(txt)
print("\n".join(hdr))

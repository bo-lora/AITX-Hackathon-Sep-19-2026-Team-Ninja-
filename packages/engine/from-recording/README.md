# from-recording (handoff 11)

    <repo>/from-recording/from-recording <events.json> [--out workflow.json] [--debug]

Input: events.json written by automation-server/recorder.ts. Output: {bullets: [3-5 strings], steps: [{screen, field_label, value, action}]}.
Deterministic. ANTHROPIC_API_KEY set -> claude-sonnet-5 rewrites only the bullets; any failure falls back to the deterministic bullets.
`--debug` adds `_debug` (which event ids became steps, which were merged as noise and why).

Noise merged: focus clicks before a fill, select2 widget clicks before a fill, clicks on fields never changed, clicks on empty space,
repeated clicks (same target within 2s), re-typed values (last one kept), form submits caused by the preceding button click,
page loads caused by the preceding action. Passwords: recorder already writes [hidden]; this also masks any field whose
type/selector/label looks like a password/token, and token=/pass= query values in URLs.

Score: `python3 score.py <workflow.json> "<input label>" --out score.md` (matched / missing / extra vs ground-truth/workflow.md, verbatim).
Tests: `python3 test_from_recording.py`.
samples/ = SAMPLE (hand-made events.json mirroring ground-truth/workflow.md; frame titles and some selectors are guesses, UNVERIFIED against a human recording).
scripted/ = results on automation-server/recordings/20260919_172629, the server agent's SCRIPTED /record test at 12:26
(scripted test recording, automation-driven, not a human; server.test.log line 48 "[rec] test driver finished").
No human recording of the REFERRAL workflow has been scored against ground truth yet. score.md and workflow.json at the top level are copies of the scripted results.

Chrome DevTools Recorder exports ({title, steps[]}) are auto-detected and go through the same command. Keystroke noise is merged
(setViewport, keyUp and the partial "change" values). Labels come from aria/ selectors first, then text/, then css. Frame paths are
kept in the screen name ("main.php > frame [4]"). Every output URL has its whole query string replaced with ?<redacted>.
human/ = HUMAN recording (Chrome DevTools Recorder), lookup workflow: inputs/chrome-recorder-Mary_OpenEMR_Baseline_001.json, hand-scored
in human/chrome-Mary_OpenEMR_Baseline_001-score.md (no answer key). If a Chrome recording of the REFERRAL workflow arrives, run
from-recording on it and then score.py against ground-truth/workflow.md.

# Hand-score: HUMAN recording (Chrome DevTools Recorder), lookup workflow

- Input: `inputs/chrome-recorder-Mary_OpenEMR_Baseline_001.json` (title "Mary_OpenEMR_Baseline_001", 16 Chrome Recorder steps). Read-only; shasum unchanged after the run.
- Output: `human/chrome-Mary_OpenEMR_Baseline_001-workflow.json` (9 steps, 4 bullets, bullets from the built-in templates because no ANTHROPIC_API_KEY is set).
- No answer key: this is a lookup workflow, not the referral intake, so it is NOT scored against ground-truth/workflow.md. Scored by hand against the handoff-18 description ("search Billy Smith -> open patient Jean, Billy J -> expand Demographics/Immunizations/Billing/Insurance") and the raw steps.
- Security: the input's navigate URL carries a live token_main. Output URLs have the whole query string replaced with `?<redacted>`; a check confirmed the token value and the string "token_main" appear nowhere in the output.
- The referral-workflow score has only been run on the SAMPLE and the scripted test recording (see ../score.md). No human recording of the referral workflow has been scored yet.

## Result: 9 of 9 meaningful actions kept, 0 invented, 7 of 7 noise steps merged

| # | produced step (screen / field_label / value / action) | reads right? |
|---|---|---|
| 1 | main.php / - / https://demo.openemr.io/openemr/interface/main/tabs/main.php?<redacted> / open | yes |
| 2 | main.php / Search by any demographics / Billy Smith / type | yes. 3 partial changes (B, Billy Sm, Billy Smith) merged into one |
| 3 | main.php / Search by any demographics / Enter / press | yes |
| 4 | main.php > frame [3] / Jean, Billy J / - / click | yes (aria label, role suffix stripped) |
| 5 | main.php > frame [4] / Demographics / - / click | yes (icon glyph stripped from the aria label) |
| 6 | main.php > frame [4] / Immunizations / - / click | yes |
| 7 | main.php > frame [4] / Billing / - / click | yes |
| 8 | main.php > frame [4] / Insurance / - / click | yes |
| 9 | main.php / Billy Jean / - / click | yes. Label from text/ selector (no aria). This step is in the file but not in the handoff's description. It is a click on the patient name in the top bar (selector #attendantData ... h3/a/span), and what it was for is UNVERIFIED |

Merged as noise (7): setViewport; keyUp b, keyUp s, keyUp Enter; the focus click on the search box; the partial values "B" and "Billy Sm".

Bullets produced:
1. On main.php: open main.php; type "Billy Smith" in Search by any demographics; press Enter.
2. On main.php > frame [3]: click Jean, Billy J.
3. On main.php > frame [4]: click Demographics, Immunizations, Billing, Insurance.
4. On main.php: click Billy Jean.

## Where it reads wrong or weak (honest)
- Screen names are "main.php > frame [3]" and "frame [4]", not human screen names. Chrome Recorder records only a frame index, with no URL or title per frame. frame [3] being the patient search results and frame [4] the patient dashboard is my inference, UNVERIFIED.
- The section clicks say "click", not "expand". The icons differ: Demographics, Billing and Insurance carry U+F065, Immunizations carries U+F066. So the Immunizations click may have COLLAPSED an open section. This is UNVERIFIED (I didn't check which glyph means which).
- The bullets are mechanical and say where she clicked, not why. A bullet a person would write is "Look up a patient by name and review their demographics, immunizations, billing and insurance". Getting that needs the LLM path, which was not exercised (no key).

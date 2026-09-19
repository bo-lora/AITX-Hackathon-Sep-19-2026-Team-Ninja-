# Submission

One submission per team. Fill the form from this page. The README is the required repo doc.

| Form field | Value |
| --- | --- |
| **Project title** | ContextNinja |
| **2–5 min demo video** | _paste Loom URL_ — show the core loop live: Create skill → one referral in Chrome → Done → Save → Run in OpenEMR → review. If skipping train, say so on camera and use **Skip train — open a taught skill**. Use [Loom](https://www.loom.com/). No committed video until every frame is checked for non-`HACKDEMO-` patients. |
| **Repo link** | https://github.com/bo-lora/AITX-Hackathon-Sep-19-2026-Team-Ninja- (must be public) |
| **README** | Root `README.md` — quick start, architecture, reproduce, data, limits |
| **Deployed URL** | None. Local laptop. Attach the Loom (or a screen capture of landing `:43123` + skill run). |
| **Team roster** | See README. Cards: http://127.0.0.1:43123/team |
| **Write-up** | The **Write-up** section in `README.md` (copy into the form) |

## Core loop for the Loom

Train is the extension. Run is the next fax. Do not demo billing. Do not demo the compiler.

1. Landing (`Let's cut through all the bullsh*t!`). Download / load unpacked extension.
2. Create skill. Walk inbox → login (`admin` / type `pass` in the EHR, not in chat) → patient, visit, insurance, attach PDF. Done.
3. Skill manager: taught path. Save. Download skill folder (show `SKILL.md`).
4. Run in OpenEMR. Headed fill of the next synthetic fax.
5. Open review. Fax vs saved.

If time is tight, skip 2 and click **Skip train — open a taught skill**, then 4–5. Say on camera that train is the extension; this is Run only.

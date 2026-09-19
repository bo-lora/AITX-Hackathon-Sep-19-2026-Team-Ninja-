"""Builds SAMPLE events.json (hand-made, follows automation-server/recorder.ts schema exactly,
mirrors ground-truth/workflow.md). Includes deliberate noise: focus clicks, repeated clicks,
re-typed fields, label clicks, submit events after button clicks."""
import json, os
B = "https://demo.openemr.io/openemr/"
MAIN = B + "interface/main/tabs/main.php?<redacted>"
LOGIN = B + "interface/login/login.php?site=default"
NEW = B + "interface/new/new.php"
POP = B + "interface/new/new_search_popup.php"
DASH = B + "interface/patient_file/summary/demographics.php?set_pid=99"
APPT = B + "interface/main/calendar/add_edit_event.php?patientid=99"
INS = B + "interface/patient_file/summary/insurance_edit.php"
DOCS = B + "controller.php?document&list&patient_id=99"
ev = []; t = [0.0]
def e(kind, frame_url, frame_title, tag=None, typ=None, selector=None, label="", text="", value=None, dt=1.5):
    t[0] = round(t[0] + dt, 1)
    d = {"i": len(ev) + 1, "t": t[0], "kind": kind}
    if kind == "navigate":
        d["frame_url"] = frame_url
    else:
        if kind == "fill": d["value"] = value
        d.update({"tag": tag, "type": typ, "selector": selector, "label": label, "text": text, "frame_url": frame_url, "frame_title": frame_title})
        if kind == "click": d["screenshot"] = "shots/%03d.png" % d["i"]
    ev.append(d)
click = lambda *a, **k: e("click", *a, **k)
fill = lambda *a, **k: e("fill", *a, **k)
LT = "OpenEMR Login"
e("navigate", LOGIN, None, dt=0.4)
click(LOGIN, LT, "input", "text", "#authUser", "Username:")               # focus click (noise)
fill(LOGIN, LT, "input", "text", "#authUser", "Username:", value="admin")
click(LOGIN, LT, "input", "password", "#clearPass", "Password:")          # focus click (noise)
fill(LOGIN, LT, "input", "password", "#clearPass", "Password:", value="[hidden]")
click(LOGIN, LT, "button", "submit", "#login-button", "", "Login")
e("submit", LOGIN, None, "form", None, "#login_form", "", "", dt=0.1)     # submit after click (noise)
e("navigate", MAIN, None, dt=2.0)
MT = "OpenEMR"
click(MAIN, MT, "div", None, "div.menuLabel:nth-of-type(3)", "", "Patient")
click(MAIN, MT, "div", None, "div.menuLabel:nth-of-type(3)", "", "Patient", dt=0.4)  # repeated click (noise)
click(MAIN, MT, "div", None, "li > div", "", "New/Search")
NT = "Search or Add Patient"
click(NEW, NT, "input", "text", "#form_fname", "Name:")
fill(NEW, NT, "input", "text", "#form_fname", "Name:", value="Mari")
fill(NEW, NT, "input", "text", "#form_fname", "Name:", value="Maria")      # retype (noise)
click(NEW, NT, "input", "text", "#form_lname", "Name:")
fill(NEW, NT, "input", "text", "#form_lname", "Name:", value="HACKDEMO-SAMPLE-0001")
click(NEW, NT, "input", "text", "#form_DOB", "DOB:")
fill(NEW, NT, "input", "text", "#form_DOB", "DOB:", value="1985-04-12")
click(NEW, NT, "div", None, "body > div:nth-of-type(4)", "", "")          # click empty space to close date picker (noise)
click(NEW, NT, "select", "select-one", "#form_sex", "Birth Sex:")
fill(NEW, NT, "select", "select-one", "#form_sex", "Birth Sex:", value="Female")
click(NEW, NT, "button", "button", "#create", "", "Create New Patient")
click(POP, "New Patient Search", "input", "button", "input[name=\"confirm\"]", "", "Confirm Create New Patient")
DT = "Dashboard"
click(DASH, DT, "a", None, "a:has-text(\"\")", "", "", dt=4)              # the + icon on Appointments card
AT = "Add New Event"
click(APPT, AT, "select", "select-one", "#form_category", "Category:")
fill(APPT, AT, "select", "select-one", "#form_category", "Category:", value="New Patient")
click(APPT, AT, "input", "text", "#form_date", "Date:")
fill(APPT, AT, "input", "text", "#form_date", "Date:", value="2026-09-21")
fill(APPT, AT, "input", "text", "input[name=\"form_hour\"]", "Time:", value="10")
fill(APPT, AT, "input", "text", "input[name=\"form_minute\"]", "Time:", value="00")
click(APPT, AT, "input", "button", "#form_save", "", "Save")
click(APPT, AT, "input", "button", "#form_save", "", "Save", dt=0.3)     # double click (noise)
click(DASH, DT, "a", None, "a.edit-insurance", "", "", dt=4)             # pencil icon on Insurance card
IT = "Insurance Edit"
click(INS, IT, "select", "select-one", "#form_subscriber_relationship", "Relationship:")
fill(INS, IT, "select", "select-one", "#form_subscriber_relationship", "Relationship:", value="Self")
click(INS, IT, "span", None, "#select2-form_provider-container", "Provider:", "Unassigned")
fill(INS, IT, "select", "select-one", "#form_provider", "Provider:", value="Blue Cross Blue Shield (, , , )")
fill(INS, IT, "input", "text", "#form_date", "Effective Date:", value="2026-09-01")
fill(INS, IT, "input", "text", "#form_policy_number", "Policy Number:", value="HD123456789")
fill(INS, IT, "input", "text", "#form_group_number", "Group Number:", value="55501")
fill(INS, IT, "input", "text", "#form_subscriber_street", "Subscriber Address:", value="100 Congress Ave")
fill(INS, IT, "input", "text", "#form_subscriber_city", "City:", value="Austin")
fill(INS, IT, "select", "select-one", "#form_subscriber_state", "State:", value="Texas")
fill(INS, IT, "input", "text", "#form_subscriber_postal_code", "Zip Code:", value="78701")
click(INS, IT, "button", "submit", "button:has-text(\"Save Policy\")", "", "Save Policy")
e("submit", INS, None, "form", None, "#insurance_form", "", "", dt=0.1)
click(DASH, DT, "a", None, "a:has-text(\"Documents\")", "", "Documents")
DoT = "Documents"
click(DOCS, DoT, "a", None, "a:has-text(\"Medical Record\")", "", "Medical Record")
click(DOCS, DoT, "input", "file", "input[name=\"file[]\"]", "Source File Path:")
fill(DOCS, DoT, "input", "file", "input[name=\"file[]\"]", "Source File Path:", value="sample-referral.pdf")
click(DOCS, DoT, "input", "submit", "input[name=\"submit\"]", "", "Upload")
e("submit", DOCS, None, "form", None, "form[name=\"theform\"]", "", "", dt=0.1)
out = {"start_url": LOGIN, "started_at": "2026-09-19T17:00:00.000Z", "duration_seconds": t[0], "events": ev}
p = os.path.join(os.path.dirname(__file__), "SAMPLE-events.json")
json.dump(out, open(p, "w"), indent=2); print(p, len(ev), "events")

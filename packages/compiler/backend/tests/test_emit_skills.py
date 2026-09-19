from pathlib import Path

from workflow_compiler.cli import main
from workflow_compiler.emit_skills import emit_skills, load_plans, render_skill, skill_slug
from workflow_compiler.ir import UnmappedStep, WorkflowPlan
from workflow_compiler.openapi import load_openapi

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "fixtures" / "openemr" / "openapi.yaml"
PLAN = ROOT / "fixtures" / "openemr" / "grounded_plan.json"


def test_skill_slug_is_lowercase_hyphenated() -> None:
    assert skill_slug("Schedule and Check-in Patient") == "schedule-and-check-in-patient"


def test_skill_slug_avoids_collisions() -> None:
    used: set[str] = set()
    first = skill_slug("Register Patient", used)
    second = skill_slug("Register Patient", used)
    assert first == "register-patient"
    assert second == "register-patient-2"


def test_render_skill_includes_grounded_apis_not_invented_put() -> None:
    mapping = load_plans(PLAN)
    schedule = next(
        item for item in mapping.workflows if item.workflow_name.startswith("Schedule and Check-in")
    )
    spec = load_openapi(SPEC)
    text = render_skill(
        schedule,
        spec=spec,
        spec_title=mapping.spec_title,
        spec_version=mapping.spec_version,
    )
    assert text.startswith("---\nname: schedule-and-check-in-patient\n")
    assert "GET" in text and "/api/patient" in text
    assert "POST" in text and "/api/patient/{pid}/appointment" in text
    assert "PUT /api/patient/{pid}/appointment/{eid}" not in text
    assert "update_appointment_status" in text
    assert "pc_catid" in text
    assert text.count("\n") < 500


def test_billing_skill_has_no_invented_paths() -> None:
    plan = WorkflowPlan(
        workflow_name="Process Billing and Checkout",
        goal="Take a copay.",
        apis=[],
        unmapped=[
            UnmappedStep(action="record_payment", reason="No payment endpoint in spec."),
        ],
    )
    text = render_skill(plan, spec_title="OpenEMR API", spec_version="8.4.0")
    assert "/api/payment" not in text
    assert "/api/fee-sheet" not in text
    assert "record_payment" in text
    assert "No operations in the spec" in text


def test_cli_emit_skills_writes_one_file_per_workflow(tmp_path) -> None:
    out = tmp_path / "skills"
    code = main(
        [
            "emit-skills",
            "--plan",
            str(PLAN),
            "--spec",
            str(SPEC),
            "--out",
            str(out),
        ]
    )
    assert code == 0
    mapping = load_plans(PLAN)
    written = list(out.glob("*/SKILL.md"))
    assert len(written) == len(mapping.workflows)
    names = {path.parent.name for path in written}
    assert "schedule-and-check-in-patient" in names
    assert "process-billing-and-checkout" in names
    billing = (out / "process-billing-and-checkout" / "SKILL.md").read_text()
    assert "/api/fee-sheet" not in billing


def test_emit_skills_helper_matches_cli(tmp_path) -> None:
    mapping = load_plans(PLAN)
    spec = load_openapi(SPEC)
    written = emit_skills(mapping, tmp_path, spec=spec)
    assert len(written) == 5
    assert all(path.name == "SKILL.md" for path in written)

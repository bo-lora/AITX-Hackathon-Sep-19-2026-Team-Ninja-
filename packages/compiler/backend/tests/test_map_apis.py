import json
from pathlib import Path

import pytest

from workflow_compiler.cli import main
from workflow_compiler.ir import (
    ApiBinding,
    ApiMappingResult,
    Workflow,
    WorkflowPlan,
    WorkflowStep,
)
from workflow_compiler.map_apis import (
    _parse_mapping_text,
    map_workflows_to_apis,
    validate_mapping,
)
from workflow_compiler.openapi import UngroundedApiError, load_openapi

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "fixtures" / "openemr" / "openapi.yaml"
INVENTED = ROOT / "fixtures" / "openemr" / "invented_plan.json"


def test_validate_mapping_rejects_invented_paths() -> None:
    spec = load_openapi(SPEC)
    raw = json.loads(INVENTED.read_text())
    with pytest.raises(UngroundedApiError, match="fee-sheet"):
        validate_mapping(ApiMappingResult.model_validate(raw), spec, spec_path=SPEC)


def test_cli_map_apis_invented_plan_exits_nonzero() -> None:
    code = main(
        [
            "map-apis",
            "--plan",
            str(INVENTED),
            "--spec",
            str(SPEC),
            "--out",
            str(ROOT / "dist" / "should-not-write.json"),
        ]
    )
    assert code == 1
    assert not (ROOT / "dist" / "should-not-write.json").exists()


def test_cli_map_apis_missing_spec_says_no_such(capsys, tmp_path) -> None:
    missing = tmp_path / "missing-openapi.yaml"
    code = main(
        [
            "map-apis",
            "--plan",
            str(INVENTED),
            "--spec",
            str(missing),
        ]
    )
    assert code == 1
    err = capsys.readouterr().err
    assert "No such OpenAPI spec" in err
    assert str(missing) in err


def test_help_lists_map_apis() -> None:
    try:
        main(["map-apis", "--help"])
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("argparse help should SystemExit 0")


def test_map_apis_help_mentions_openai(capsys) -> None:
    try:
        main(["map-apis", "--help"])
    except SystemExit as exc:
        assert exc.code == 0
    out = capsys.readouterr().out
    assert "OpenAI" in out
    assert "OPENAI_MODEL" in out
    assert "Gemini" not in out


def test_parse_mapping_text_accepts_json() -> None:
    parsed = _parse_mapping_text(
        json.dumps(
            {
                "spec_title": "OpenEMR API",
                "spec_version": "8.4.0",
                "spec_path": "fixtures/openemr/openapi.yaml",
                "workflows": [],
            }
        )
    )
    assert parsed.spec_title == "OpenEMR API"
    assert parsed.workflows == []


def test_map_workflows_to_apis_uses_openai(monkeypatch) -> None:
    dummy = ApiMappingResult(
        spec_title="OpenEMR API",
        spec_version="8.4.0",
        spec_path=str(SPEC),
        workflows=[
            WorkflowPlan(
                workflow_name="Register Patient",
                goal="Create a patient.",
                apis=[
                    ApiBinding(
                        method="POST",
                        path="/api/patient",
                        purpose="Create the patient record.",
                    )
                ],
            )
        ],
    )
    monkeypatch.setattr(
        "workflow_compiler.map_apis._ask_openai",
        lambda *_args, **_kwargs: dummy,
    )
    result = map_workflows_to_apis(
        [
            Workflow(
                workflow_name="Register Patient",
                goal="Create a patient.",
                steps=[WorkflowStep(action="create_patient")],
                final_state="Patient exists.",
            )
        ],
        SPEC,
    )
    assert result.workflows[0].apis[0].path == "/api/patient"


def test_map_workflows_drops_invented_appointment_put(monkeypatch) -> None:
    dummy = ApiMappingResult(
        spec_title="OpenEMR API",
        spec_version="8.4.0",
        spec_path=str(SPEC),
        workflows=[
            WorkflowPlan(
                workflow_name="Schedule and Check-in Patient",
                goal="Book and check in.",
                apis=[
                    ApiBinding(
                        method="GET",
                        path="/api/patient",
                        purpose="Find the patient.",
                        maps_from=["search_patient"],
                    ),
                    ApiBinding(
                        method="POST",
                        path="/api/patient/{pid}/appointment",
                        purpose="Create the appointment.",
                        maps_from=["create_appointment"],
                    ),
                    ApiBinding(
                        method="PUT",
                        path="/api/patient/{pid}/appointment/{eid}",
                        purpose="Mark the patient arrived.",
                        maps_from=["update_appointment_status"],
                    ),
                ],
            )
        ],
    )
    monkeypatch.setattr(
        "workflow_compiler.map_apis._ask_openai",
        lambda *_args, **_kwargs: dummy,
    )
    result = map_workflows_to_apis(
        [
            Workflow(
                workflow_name="Schedule and Check-in Patient",
                goal="Book and check in.",
                steps=[
                    WorkflowStep(action="search_patient"),
                    WorkflowStep(action="create_appointment"),
                    WorkflowStep(action="update_appointment_status"),
                ],
                final_state="Patient scheduled.",
            )
        ],
        SPEC,
    )
    paths = [(item.method, item.path) for item in result.workflows[0].apis]
    assert ("GET", "/api/patient") in paths
    assert ("POST", "/api/patient/{pid}/appointment") in paths
    assert ("PUT", "/api/patient/{pid}/appointment/{eid}") not in paths
    dropped = result.workflows[0].unmapped
    assert dropped
    assert any("PUT" in item.reason and "appointment" in item.reason for item in dropped)

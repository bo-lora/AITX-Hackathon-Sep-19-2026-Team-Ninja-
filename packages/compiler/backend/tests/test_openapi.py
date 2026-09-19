from pathlib import Path

import pytest

from workflow_compiler.ir import ApiBinding, ApiMappingResult, WorkflowPlan
from workflow_compiler.openapi import (
    UngroundedApiError,
    canonicalize_call,
    list_operations,
    load_openapi,
)

SPEC = Path(__file__).resolve().parents[2] / "fixtures" / "openemr" / "openapi.yaml"


@pytest.fixture(scope="module")
def spec():
    return load_openapi(SPEC)


def test_spec_includes_patient_and_prescription(spec) -> None:
    ops = {(item.method, item.path) for item in list_operations(spec, include_fhir=False)}
    assert ("GET", "/api/patient") in ops
    assert ("POST", "/api/patient") in ops
    assert ("POST", "/api/patient/{pid}/appointment") in ops
    assert ("POST", "/api/patient/{puuid}/encounter") in ops
    assert ("POST", "/api/prescription") in ops
    assert ("POST", "/api/patient/{pid}/encounter/{eid}/vital") in ops
    assert ("POST", "/api/patient/{pid}/encounter/{eid}/soap_note") in ops


def test_spec_has_no_fee_sheet_or_payment(spec) -> None:
    ops = {(item.method, item.path) for item in list_operations(spec, include_fhir=True)}
    assert ("POST", "/api/fee-sheet") not in ops
    assert ("POST", "/api/payment") not in ops
    assert ("POST", "/api/receipt") not in ops


def test_canonicalize_accepts_real_path(spec) -> None:
    assert canonicalize_call("post", "/api/patient", spec=spec) == ("POST", "/api/patient")


def test_canonicalize_rejects_invented_path(spec) -> None:
    with pytest.raises(UngroundedApiError, match="POST /api/fee-sheet"):
        canonicalize_call("POST", "/api/fee-sheet", spec=spec)

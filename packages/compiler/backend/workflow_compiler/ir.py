from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class WorkflowStep(BaseModel):
    """One human action inside a workflow. Later phases map this to an API call."""

    action: str = Field(
        description=(
            "Snake_case verb for the action, e.g. search_patient, "
            "create_appointment, create_encounter, record_vitals."
        )
    )
    input: str | None = Field(
        default=None,
        description="Name of an observed input this step consumes, e.g. patient_name.",
    )
    object: str | None = Field(
        default=None,
        description="Entity being acted on, e.g. patient, encounter, appointment, prescription.",
    )
    filter: str | None = Field(
        default=None,
        description="Filter or search constraint, e.g. overdue, name=Acme.",
    )
    rule: str | None = Field(
        default=None,
        description="Selection rule when several objects match, e.g. oldest overdue.",
    )
    result: str | None = Field(
        default=None,
        description="What this step produces for later steps, e.g. client, product, invoice.",
    )
    side_effect: bool = Field(
        default=False,
        description="True if this step sends email, charges, deletes, or otherwise cannot be undone quietly.",
    )
    notes: str | None = Field(
        default=None,
        description="Optional timestamp or UI detail that helps API mapping, e.g. 01:12 Product Settings.",
    )


class Workflow(BaseModel):
    """A complete job a person did in the recording. Phase 3 turns this into one tool."""

    workflow_name: str = Field(description="Short name of the job, e.g. Create invoice with inventory alert.")
    goal: str = Field(description="One sentence: what the user was trying to accomplish.")
    inputs_observed: list[str] = Field(
        default_factory=list,
        description=(
            "Snake_case tool arguments a later agent would need, "
            "e.g. client_name, product_key, quantity."
        ),
    )
    steps: list[WorkflowStep] = Field(min_length=1)
    decision_points: list[str] = Field(
        default_factory=list,
        description="Places the user chose among options, e.g. which product, which client.",
    )
    final_state: str = Field(
        description="What is true when the workflow is done, e.g. invoice created and stock reduced."
    )
    entities: list[str] = Field(
        default_factory=list,
        description="Nouns involved: client, product, invoice, company.",
    )

    @field_validator("inputs_observed", "entities", "decision_points")
    @classmethod
    def _strip_blanks(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item and item.strip()]


class WorkflowExtraction(BaseModel):
    """Gemini's structured response for one video."""

    workflows: list[Workflow] = Field(
        description="Distinct jobs demonstrated in the recording. Split when the user starts a different goal."
    )


class ApiBinding(BaseModel):
    """One OpenAPI operation that exists in the spec. Phase 3 will call these in order."""

    method: str = Field(description="HTTP method, e.g. GET, POST, PUT, DELETE.")
    path: str = Field(
        description="OpenAPI path template exactly as in the spec, e.g. /api/patient/{pid}/appointment."
    )
    purpose: str = Field(description="Why this call is needed for the workflow.")
    maps_from: list[str] = Field(
        default_factory=list,
        description="Workflow step actions this call covers, e.g. search_patient, create_appointment.",
    )
    params: dict[str, str] = Field(
        default_factory=dict,
        description="Map of workflow input names to OpenAPI parameter or body field names.",
    )


class UnmappedStep(BaseModel):
    """A human step with no matching operation in the spec. Do not invent a path for it."""

    action: str
    reason: str = Field(
        description="Why it cannot be grounded, e.g. UI-only, or no fee-sheet endpoint in spec."
    )


class WorkflowPlan(BaseModel):
    """One workflow plus the spec operations an agent would run."""

    workflow_name: str
    goal: str
    inputs_observed: list[str] = Field(default_factory=list)
    apis: list[ApiBinding] = Field(default_factory=list)
    unmapped: list[UnmappedStep] = Field(default_factory=list)


class ApiMappingResult(BaseModel):
    """Phase 2 output: workflows grounded to a real OpenAPI spec."""

    spec_title: str
    spec_version: str
    spec_path: str
    workflows: list[WorkflowPlan]

from workflow_compiler.ir import Workflow, WorkflowExtraction, WorkflowStep


def test_workflow_schema_accepts_inventory_example() -> None:
    data = {
        "workflow_name": "Create invoice that triggers a low-stock alert",
        "goal": "Invoice a client for a product so stock falls and a notification is sent.",
        "inputs_observed": ["client_name", "product_key", "quantity"],
        "steps": [
            {
                "action": "enable_inventory_tracking",
                "object": "company",
                "notes": "00:20 Product Settings",
            },
            {
                "action": "update_product_stock",
                "object": "product",
                "input": "product_key",
                "result": "product",
            },
            {
                "action": "search_client",
                "input": "client_name",
                "result": "client",
            },
            {
                "action": "create_invoice",
                "object": "invoice",
                "input": "quantity",
                "side_effect": False,
            },
            {
                "action": "observe_low_stock_email",
                "side_effect": True,
            },
        ],
        "decision_points": ["which product", "invoice quantity vs threshold"],
        "final_state": "Invoice exists and a low-stock email was sent.",
        "entities": ["company", "product", "client", "invoice"],
    }
    workflow = Workflow.model_validate(data)
    assert workflow.steps[0].action == "enable_inventory_tracking"
    assert workflow.steps[-1].side_effect is True


def test_extraction_requires_at_least_one_step() -> None:
    try:
        Workflow.model_validate(
            {
                "workflow_name": "Empty",
                "goal": "Nothing",
                "steps": [],
                "final_state": "None",
            }
        )
    except Exception:
        return
    raise AssertionError("empty steps should fail validation")


def test_extraction_wrapper() -> None:
    raw = {
        "workflows": [
            {
                "workflow_name": "Search a client",
                "goal": "Find a client by name.",
                "inputs_observed": ["client_name"],
                "steps": [{"action": "search_client", "input": "client_name", "result": "client"}],
                "final_state": "Client record visible.",
                "entities": ["client"],
            }
        ]
    }
    extracted = WorkflowExtraction.model_validate(raw)
    assert len(extracted.workflows) == 1

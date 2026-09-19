import json

from workflow_compiler.gemini_video import json_schema_for_gemini, _generation_config


def test_gemini_schema_has_no_refs() -> None:
    schema = json_schema_for_gemini()
    dumped = json.dumps(schema)
    assert "$ref" not in dumped
    assert "$defs" not in dumped
    assert schema["type"] == "object"
    assert "workflows" in schema["properties"]


def test_generation_config_disables_afc() -> None:
    config = _generation_config(60_000)
    assert config.automatic_function_calling is not None
    assert config.automatic_function_calling.disable is True
    assert config.response_mime_type == "application/json"
    assert config.response_schema is None
    assert config.response_json_schema is not None

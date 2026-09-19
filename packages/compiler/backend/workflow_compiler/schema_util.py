from __future__ import annotations

from typing import Any

from pydantic import BaseModel


def json_schema_for_gemini(model: type[BaseModel]) -> dict[str, Any]:
    """Inline Pydantic $defs so Gemini structured output does not go through AFC/tools."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {}) or {}

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                name = str(node["$ref"]).rsplit("/", 1)[-1]
                if name not in defs:
                    raise KeyError(f"Unknown schema $ref: {node['$ref']}")
                return resolve(defs[name])
            out: dict[str, Any] = {}
            for key, value in node.items():
                if key in {"title", "default"}:
                    continue
                out[key] = resolve(value)
            if "anyOf" in out:
                variants = out["anyOf"]
                non_null = [
                    item
                    for item in variants
                    if not (isinstance(item, dict) and item.get("type") == "null")
                ]
                if len(non_null) == 1 and len(non_null) != len(variants):
                    merged = dict(non_null[0])
                    merged["nullable"] = True
                    for key, value in out.items():
                        if key != "anyOf":
                            merged[key] = value
                    return merged
            return out
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return resolve(schema)

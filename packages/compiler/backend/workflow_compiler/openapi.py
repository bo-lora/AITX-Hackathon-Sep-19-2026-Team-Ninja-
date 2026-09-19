from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

HTTP_METHODS = {"get", "post", "put", "patch", "delete"}


@dataclass(frozen=True)
class Operation:
    method: str
    path: str
    description: str
    tags: tuple[str, ...]
    parameters: tuple[str, ...]
    required: tuple[str, ...] = ()

    @property
    def key(self) -> tuple[str, str]:
        return (self.method, self.path)

    @property
    def is_fhir(self) -> bool:
        return self.path.startswith("/fhir") or "fhir" in self.tags


class UngroundedApiError(ValueError):
    """Raised when a mapped call is not present in the OpenAPI spec."""


def load_openapi(path: str | Path) -> dict[str, Any]:
    spec_path = Path(path).expanduser().resolve()
    if not spec_path.is_file():
        raise FileNotFoundError(f"No such OpenAPI spec: {spec_path}")
    data = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "paths" not in data:
        raise ValueError(f"{spec_path} is not an OpenAPI document with paths.")
    return data


def list_operations(spec: dict[str, Any], *, include_fhir: bool = False) -> list[Operation]:
    operations: list[Operation] = []
    paths = spec.get("paths") or {}
    for raw_path, item in paths.items():
        if not isinstance(item, dict):
            continue
        path = _normalize_path(raw_path)
        for method, op in item.items():
            if method.lower() not in HTTP_METHODS or not isinstance(op, dict):
                continue
            tags = tuple(str(tag) for tag in (op.get("tags") or []))
            description = (
                str(op.get("summary") or "").strip()
                or str(op.get("description") or "").strip()
                or f"{method.upper()} {path}"
            )
            params = _param_names(op)
            required = _required_names(op)
            operation = Operation(
                method=method.upper(),
                path=path,
                description=description.split("\n", 1)[0][:240],
                tags=tags,
                parameters=params,
                required=required,
            )
            if operation.is_fhir and not include_fhir:
                continue
            operations.append(operation)
    operations.sort(key=lambda item: (item.path, item.method))
    return operations


def operation_index(
    spec: dict[str, Any], *, include_fhir: bool = False
) -> dict[tuple[str, str], Operation]:
    return {item.key: item for item in list_operations(spec, include_fhir=include_fhir)}


def catalog_text(operations: list[Operation], *, limit: int | None = None) -> str:
    rows = operations if limit is None else operations[:limit]
    lines = []
    for item in rows:
        extra = f" params={','.join(item.parameters)}" if item.parameters else ""
        lines.append(f"{item.method} {item.path} — {item.description}{extra}")
    return "\n".join(lines)


def spec_prefixes(spec: dict[str, Any]) -> list[str]:
    prefixes = []
    for server in spec.get("servers") or []:
        url = str((server or {}).get("url") or "").rstrip("/")
        if url and not url.startswith("http"):
            prefixes.append(url)
    return prefixes


def canonicalize_call(method: str, path: str, *, spec: dict[str, Any]) -> tuple[str, str]:
    method_n = method.strip().upper()
    path_n = _strip_prefixes(_normalize_path(path), spec_prefixes(spec))
    index = operation_index(spec, include_fhir=True)
    if (method_n, path_n) in index:
        return method_n, path_n
    raise UngroundedApiError(
        f"{method_n} {path_n} is not in the OpenAPI spec. "
        "Do not invent endpoints; leave the step unmapped instead."
    )


def _normalize_path(path: str) -> str:
    text = (path or "").strip()
    if not text:
        return "/"
    if not text.startswith("/"):
        text = "/" + text
    if len(text) > 1:
        text = text.rstrip("/")
    return text


def _strip_prefixes(path: str, prefixes: list[str]) -> str:
    for prefix in prefixes:
        if path == prefix:
            return "/"
        if prefix and path.startswith(prefix + "/"):
            return path[len(prefix) :] or "/"
    return path


def _param_names(op: dict[str, Any]) -> tuple[str, ...]:
    names: list[str] = []
    for param in op.get("parameters") or []:
        if isinstance(param, dict) and param.get("name"):
            names.append(str(param["name"]))
    body = op.get("requestBody")
    if isinstance(body, dict):
        content = body.get("content") or {}
        for media in content.values():
            schema = (media or {}).get("schema") or {}
            props = schema.get("properties") or {}
            if isinstance(props, dict):
                names.extend(str(key) for key in props)
            required = schema.get("required") or []
            if isinstance(required, list):
                names.extend(str(item) for item in required if item not in names)
    # de-dupe, keep order
    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        if name not in seen:
            seen.add(name)
            ordered.append(name)
    return tuple(ordered)


def _required_names(op: dict[str, Any]) -> tuple[str, ...]:
    names: list[str] = []
    for param in op.get("parameters") or []:
        if isinstance(param, dict) and param.get("required") and param.get("name"):
            names.append(str(param["name"]))
    body = op.get("requestBody")
    if isinstance(body, dict):
        content = body.get("content") or {}
        for media in content.values():
            schema = (media or {}).get("schema") or {}
            required = schema.get("required") or []
            if isinstance(required, list):
                names.extend(str(item) for item in required)
    seen: set[str] = set()
    ordered: list[str] = []
    for name in names:
        if name not in seen:
            seen.add(name)
            ordered.append(name)
    return tuple(ordered)

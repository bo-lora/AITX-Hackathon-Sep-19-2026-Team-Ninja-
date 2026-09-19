from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from workflow_compiler.emit_skills import emit_skills, load_plans
from workflow_compiler.env import gemini_model, load_env_files
from workflow_compiler.gemini_video import extract_workflows_from_video, extraction_to_dict
from workflow_compiler.ir import ApiMappingResult, WorkflowExtraction
from workflow_compiler.map_apis import (
    load_workflows,
    map_workflows_to_apis,
    mapping_to_dict,
    validate_mapping,
)
from workflow_compiler.openapi import UngroundedApiError, load_openapi

REPO_ROOT = Path(__file__).resolve().parents[2]


def main(argv: list[str] | None = None) -> int:
    load_env_files()
    parser = argparse.ArgumentParser(
        prog="compile-workflow",
        description="Compile screen recordings into grounded API plans for agent tools.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    from_video = sub.add_parser(
        "from-video",
        help="Send one or more videos to Gemini and write workflow JSON.",
    )
    from_video.add_argument(
        "--video",
        action="append",
        dest="videos",
        required=True,
        help="Local video path or YouTube URL. Repeat for multiple clips.",
    )
    from_video.add_argument(
        "--out",
        required=True,
        help="Output .json file, or a directory if you pass multiple --video values.",
    )
    from_video.add_argument(
        "--model",
        default=None,
        help="Gemini model id. Defaults to GEMINI_MODEL or gemini-2.5-flash.",
    )
    from_video.add_argument(
        "--print-schema",
        action="store_true",
        help="Print the workflow JSON schema and exit (does not call Gemini).",
    )

    map_apis = sub.add_parser(
        "map-apis",
        help="Ground workflows against an OpenAPI spec. Invented paths fail.",
    )
    map_apis.add_argument("--workflows", help="Phase 1 workflows JSON.")
    map_apis.add_argument(
        "--plan",
        help="Existing plans JSON to validate against the spec (does not call OpenAI).",
    )
    map_apis.add_argument("--spec", required=True, help="OpenAPI YAML or JSON file.")
    map_apis.add_argument("--out", help="Write grounded plans JSON here.")
    map_apis.add_argument(
        "--model",
        default=None,
        help="OpenAI model id. Defaults to OPENAI_MODEL or gpt-4o.",
    )
    map_apis.add_argument(
        "--include-fhir",
        action="store_true",
        help="Include /fhir operations in the mapping catalog (default: standard /api only).",
    )

    emit_skills_cmd = sub.add_parser(
        "emit-skills",
        help="Write one Cursor SKILL.md per workflow in a grounded plan.",
    )
    emit_skills_cmd.add_argument("--plan", required=True, help="Phase 2 plans JSON.")
    emit_skills_cmd.add_argument(
        "--out",
        default=None,
        help="Directory for skill-name/SKILL.md. Defaults to <repo>/.cursor/skills.",
    )
    emit_skills_cmd.add_argument(
        "--spec",
        help="OpenAPI spec used to annotate required fields. Defaults to spec_path in the plan.",
    )

    schema = sub.add_parser("schema", help="Print the workflow JSON schema.")
    schema.set_defaults(command="schema")

    args = parser.parse_args(argv)

    if args.command == "schema" or getattr(args, "print_schema", False):
        print(json.dumps(WorkflowExtraction.model_json_schema(), indent=2))
        return 0

    if args.command == "from-video":
        try:
            return _cmd_from_video(args)
        except (RuntimeError, FileNotFoundError, TimeoutError) as exc:
            print(exc, file=sys.stderr)
            return 1

    if args.command == "map-apis":
        try:
            return _cmd_map_apis(args)
        except (RuntimeError, FileNotFoundError, TimeoutError, UngroundedApiError) as exc:
            print(exc, file=sys.stderr)
            return 1

    if args.command == "emit-skills":
        try:
            return _cmd_emit_skills(args)
        except (RuntimeError, FileNotFoundError, UngroundedApiError) as exc:
            print(exc, file=sys.stderr)
            return 1

    parser.error(f"Unknown command {args.command}")
    return 2


def _cmd_from_video(args: argparse.Namespace) -> int:
    model = args.model or gemini_model()
    videos: list[str] = args.videos
    out = Path(args.out)

    if len(videos) > 1:
        if out.suffix.lower() == ".json":
            print(
                "When passing multiple --video values, --out must be a directory.",
                file=sys.stderr,
            )
            return 2
        out.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        for video in videos:
            payload = _run_one(video, model)
            dest = out / f"{_stem(video)}.workflows.json"
            _write_json(dest, payload)
            written.append(dest)
            _summarize(payload, dest)
        print(f"Wrote {len(written)} files under {out}", file=sys.stderr)
        return 0

    payload = _run_one(videos[0], model)
    if out.suffix.lower() != ".json":
        out.mkdir(parents=True, exist_ok=True)
        dest = out / f"{_stem(videos[0])}.workflows.json"
    else:
        dest = out
    _write_json(dest, payload)
    _summarize(payload, dest)
    return 0


def _cmd_map_apis(args: argparse.Namespace) -> int:
    spec_path = _existing_file(args.spec, "OpenAPI spec")
    spec = load_openapi(spec_path)
    if args.plan:
        plan_path = _existing_file(args.plan, "plan JSON")
        raw = json.loads(plan_path.read_text(encoding="utf-8"))
        mapping = validate_mapping(
            ApiMappingResult.model_validate(raw), spec, spec_path=spec_path
        )
    elif args.workflows:
        workflow_path = _existing_file(args.workflows, "workflows JSON")
        workflows = load_workflows(workflow_path)
        mapping = map_workflows_to_apis(
            workflows,
            spec_path,
            model=args.model,
            include_fhir=args.include_fhir,
        )
        mapping = validate_mapping(mapping, spec, spec_path=spec_path)
    else:
        print("map-apis requires --workflows or --plan.", file=sys.stderr)
        return 2
    payload = mapping_to_dict(mapping)
    if args.out:
        dest = _output_path(args.out)
        _write_json(dest, payload)
        _summarize_plans(payload, dest)
    else:
        print(json.dumps(payload, indent=2))
        _summarize_plans(payload, Path("-"))
    return 0


def _cmd_emit_skills(args: argparse.Namespace) -> int:
    plan_path = _existing_file(args.plan, "plan JSON")
    mapping = load_plans(plan_path)
    spec_arg = args.spec or mapping.spec_path
    spec = None
    if spec_arg:
        try:
            spec = load_openapi(_existing_file(spec_arg, "OpenAPI spec"))
        except FileNotFoundError:
            if args.spec:
                raise
            spec = None
    out_dir = _skill_out_dir(args.out)
    written = emit_skills(mapping, out_dir, spec=spec)
    print(f"Wrote {len(written)} skill(s) under {out_dir}", file=sys.stderr)
    for dest in written:
        print(f"  - {dest.parent.name}/SKILL.md", file=sys.stderr)
    return 0


def _skill_out_dir(path: str | None) -> Path:
    if not path:
        return REPO_ROOT / ".cursor" / "skills"
    raw = Path(path).expanduser()
    if raw.is_absolute():
        return raw
    return (REPO_ROOT / raw).resolve()


def _existing_file(path: str, label: str) -> Path:
    raw = Path(path).expanduser()
    candidates = [raw] if raw.is_absolute() else [Path.cwd() / raw, REPO_ROOT / raw]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    looked = "; ".join(str(item.resolve()) for item in candidates)
    raise FileNotFoundError(f"No such {label}: {path} (looked in {looked})")


def _output_path(path: str) -> Path:
    raw = Path(path).expanduser()
    if raw.is_absolute():
        return raw
    cwd_dest = Path.cwd() / raw
    if cwd_dest.parent.is_dir():
        return cwd_dest
    repo_dest = REPO_ROOT / raw
    if repo_dest.parent.is_dir():
        return repo_dest
    return cwd_dest


def _run_one(video: str, model: str) -> dict:
    print(f"Extracting workflows from {video} with {model}...", file=sys.stderr)
    extraction = extract_workflows_from_video(video, model=model)
    display = video if video.startswith("http") else str(Path(video).expanduser().resolve())
    return extraction_to_dict(extraction, video=display, model=model)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _stem(video: str) -> str:
    if video.startswith("http"):
        return "youtube"
    return Path(video).stem


def _summarize(payload: dict, dest: Path) -> None:
    workflows = payload.get("workflows") or []
    print(f"Wrote {dest} ({len(workflows)} workflow(s))", file=sys.stderr)
    for item in workflows:
        name = item.get("workflow_name", "(unnamed)")
        steps = len(item.get("steps") or [])
        print(f"  - {name} [{steps} steps]", file=sys.stderr)


def _summarize_plans(payload: dict, dest: Path) -> None:
    workflows = payload.get("workflows") or []
    target = dest if str(dest) != "-" else "stdout"
    print(f"Wrote {target} ({len(workflows)} plan(s))", file=sys.stderr)
    for item in workflows:
        name = item.get("workflow_name", "(unnamed)")
        apis = item.get("apis") or []
        unmapped = item.get("unmapped") or []
        print(
            f"  - {name} [{len(apis)} api call(s), {len(unmapped)} unmapped]",
            file=sys.stderr,
        )
        for call in apis:
            print(f"      {call.get('method')} {call.get('path')}", file=sys.stderr)
        for skipped in unmapped:
            print(
                f"      unmapped {skipped.get('action')}: {skipped.get('reason')}",
                file=sys.stderr,
            )


if __name__ == "__main__":
    raise SystemExit(main())

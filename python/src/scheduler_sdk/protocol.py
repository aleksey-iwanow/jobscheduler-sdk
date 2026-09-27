"""Versioned transport shared by host and Docker execution."""

import base64
import importlib
import json
import os
import sys
import traceback
from contextlib import redirect_stdout
from typing import Any

from scheduler_sdk.execution import execute
from scheduler_sdk.registry import describe

MAX_REQUEST_BYTES = 64 * 1024


def read_request() -> dict[str, Any]:
    encoded = os.environ.get("TASK_REQUEST_B64")
    raw = base64.b64decode(encoded, validate=True) if encoded is not None else sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
    if len(raw) > MAX_REQUEST_BYTES:
        raise ValueError("Task request exceeds 64 KiB")
    request = json.loads(raw)
    if not isinstance(request, dict):
        raise ValueError("Request must be a JSON object")
    return request


def handle(request: dict[str, Any]) -> dict[str, Any]:
    run_id = request.get("runId")
    if not isinstance(run_id, str) or not run_id:
        raise ValueError("runId must be a non-empty string")
    if request.get("protocolVersion") != 1:
        raise ValueError("Unsupported protocol version")
    operation = request.get("operation", "execute")
    if operation == "describe":
        return {"protocolVersion": 1, "runId": run_id, "status": "succeeded",
                "result": None, "error": None, "processes": describe()}
    if operation == "execute":
        return {"protocolVersion": 1, "runId": run_id, "status": "succeeded",
                "result": execute(request), "error": None}
    raise ValueError(f"Unknown operation: {operation}")


def run() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    run_id: str | None = None
    try:
        request = read_request()
        run_id = request.get("runId")
        with redirect_stdout(sys.stderr):
            importlib.import_module(os.environ["TASK_MODULE"])
            response = handle(request)
        output = json.dumps(response, ensure_ascii=False, allow_nan=False)
        code = 0
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        response = {"protocolVersion": 1, "runId": run_id, "status": "failed",
                    "result": None, "error": {"type": type(exc).__name__, "message": str(exc)}}
        output = json.dumps(response, ensure_ascii=False)
        code = 1
    sys.stdout.write(output + "\n")
    sys.stdout.flush()
    return code

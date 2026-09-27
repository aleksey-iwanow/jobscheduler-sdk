"""Validate and call a registered task."""

import asyncio
import inspect
from typing import Any, get_type_hints

from scheduler_sdk.context import TaskContext, expects_context
from scheduler_sdk.registry import get_task


async def _await_result(value: Any) -> Any:
    return await value


def execute(request: dict[str, Any]) -> Any:
    process_id = request.get("processId")
    task_id = request.get("taskId")
    parameters = request.get("parameters")
    if not isinstance(process_id, str) or not isinstance(task_id, str) or not isinstance(parameters, dict):
        raise ValueError("processId and taskId must be strings and parameters must be an object")
    function = get_task(process_id, task_id)
    annotations = get_type_hints(function)
    if expects_context(annotations.get("context")):
        if "context" in parameters:
            raise ValueError("context is supplied by the SDK and cannot be a task parameter")
        upstream = request.get("upstream", {})
        workspace = request.get("workspace")
        if not isinstance(upstream, dict) or (workspace is not None and not isinstance(workspace, str)):
            raise ValueError("Invalid task context in request")
        parameters = {**parameters, "context": TaskContext(
            run_id=request.get("processRunId") or request["runId"],
            task_run_id=request["runId"], process_id=process_id, task_id=task_id,
            upstream=upstream, workspace=workspace,
        )}
    bound = inspect.signature(function).bind(**parameters)
    bound.apply_defaults()
    for name, value in bound.arguments.items():
        expected = annotations.get(name)
        if expected in (int, float, str, bool) and type(value) is not expected:
            raise TypeError(f"{name} must be {expected.__name__}")
    result = function(*bound.args, **bound.kwargs)
    if inspect.isawaitable(result):
        result = asyncio.run(_await_result(result))
    return result

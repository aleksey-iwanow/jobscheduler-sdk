"""Process and task declarations. Importing a task module registers its jobs."""

import inspect
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Any, TypeVar, get_type_hints

from scheduler_sdk.context import expects_context

_FUNCTION = TypeVar("_FUNCTION", bound=Callable[..., Any])
_NAME = re.compile(r"[A-Za-z][A-Za-z0-9._-]{0,63}\Z")


@dataclass(frozen=True)
class ProcessMetadata:
    process_id: str
    description: str


@dataclass(frozen=True)
class TaskMetadata:
    task_id: str
    process_id: str
    description: str
    depends_on: tuple[str, ...]
    execution_target: str
    function: Callable[..., Any]


_PROCESSES: dict[str, ProcessMetadata] = {}
_TASKS: dict[tuple[str, str], TaskMetadata] = {}


def _check_name(name: str, kind: str) -> None:
    if not isinstance(name, str) or _NAME.fullmatch(name) is None:
        raise ValueError(f"{kind} name must start with a letter and use only letters, digits, ._-.")


def process(name: str, *, description: str = "") -> None:
    _check_name(name, "Process")
    if name in _PROCESSES:
        raise ValueError(f"Duplicate process name: {name}")
    _PROCESSES[name] = ProcessMetadata(name, description)


def task(
    name: str,
    *,
    process: str,
    depends_on: Iterable[str] = (),
    description: str = "",
    execution_target: str = "container",
) -> Callable[[_FUNCTION], _FUNCTION]:
    _check_name(name, "Task")
    if process not in _PROCESSES:
        raise ValueError(f"Declare process {process!r} before registering its tasks")
    if isinstance(depends_on, str):
        raise TypeError("depends_on must be a collection, not a string")
    dependencies = tuple(depends_on)
    for dependency in dependencies:
        _check_name(dependency, "Dependency")
    if len(dependencies) != len(set(dependencies)):
        raise ValueError(f"Duplicate dependency in task {name}")
    if execution_target not in {"container", "host"}:
        raise ValueError(f"Unsupported execution target: {execution_target}")

    def register(function: _FUNCTION) -> _FUNCTION:
        key = (process, name)
        if key in _TASKS:
            raise ValueError(f"Duplicate task name in process {process}: {name}")
        _TASKS[key] = TaskMetadata(name, process, description, dependencies, execution_target, function)
        return function

    return register


def get_task(process_id: str, task_id: str) -> Callable[..., Any]:
    try:
        return _TASKS[(process_id, task_id)].function
    except KeyError as exc:
        raise LookupError(f"Unknown task: {process_id}/{task_id}") from exc


def _parameters(function: Callable[..., Any]) -> list[dict[str, Any]]:
    annotations = get_type_hints(function)
    types = {int: "integer", float: "number", str: "string", bool: "boolean"}
    result: list[dict[str, Any]] = []
    for item in inspect.signature(function).parameters.values():
        if item.name == "context" and expects_context(annotations.get(item.name)):
            continue
        if item.kind not in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY):
            raise ValueError(f"Unsupported parameter kind: {item.name}")
        result.append({"name": item.name, "type": types.get(annotations.get(item.name), "any"),
                       "required": item.default is inspect.Parameter.empty})
    return result


def describe() -> list[dict[str, Any]]:
    processes: list[dict[str, Any]] = []
    for process_id, metadata in _PROCESSES.items():
        tasks = {task_id: item for (owner, task_id), item in _TASKS.items() if owner == process_id}
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(task_id: str) -> None:
            if task_id in visiting:
                raise ValueError(f"Dependency cycle in {process_id}/{task_id}")
            if task_id in visited:
                return
            visiting.add(task_id)
            for dependency in tasks[task_id].depends_on:
                if dependency not in tasks:
                    raise ValueError(f"Unknown dependency {dependency} in {process_id}/{task_id}")
                visit(dependency)
            visiting.remove(task_id)
            visited.add(task_id)

        for task_id in tasks:
            visit(task_id)
        processes.append({"processId": process_id, "description": metadata.description,
                          "tasks": [{"taskId": item.task_id, "description": item.description,
                                     "dependsOn": list(item.depends_on),
                                     "executionTarget": item.execution_target,
                                     "parameters": _parameters(item.function)}
                                    for item in tasks.values()]})
    return processes

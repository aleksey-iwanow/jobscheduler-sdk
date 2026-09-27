"""Runtime information injected into tasks that request TaskContext."""

from dataclasses import dataclass
from pathlib import Path
from typing import Any, get_args


@dataclass(frozen=True)
class TaskContext:
    run_id: str
    task_run_id: str
    process_id: str
    task_id: str
    upstream: dict[str, Any]
    workspace: str | None = None

    def result(self, task_id: str) -> Any:
        return self.upstream[task_id]

    def workspace_path(self, *parts: str) -> Path:
        if self.workspace is None:
            raise RuntimeError("No writable workspace is configured for this process")
        root = Path(self.workspace).resolve()
        path = root.joinpath(*parts).resolve()
        if not path.is_relative_to(root):
            raise ValueError("Workspace path must stay inside this process run")
        return path


def expects_context(annotation: Any) -> bool:
    return annotation is TaskContext or TaskContext in get_args(annotation)

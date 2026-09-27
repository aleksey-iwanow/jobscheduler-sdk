# JobScheduler Python SDK

Python implementation of JobScheduler task protocol v1 (documented in the
source repository at `protocol/README.md`). The SDK
works both in Docker and as a trusted local runner.

After the PyPI release, install into a project:

```bash
python -m pip install jobscheduler-task-sdk
```

Until the first PyPI release, install from this repository instead:

```bash
python -m pip install -e ./python
```

Task module (`tasks.py`):

```python
from scheduler_sdk import TaskContext, process, task

process("people", description="Normalize and save names")

@task("normalize", process="people")
def normalize(username: str) -> dict[str, str]:
    return {"username": " ".join(username.split()).lower()}

@task("save", process="people", depends_on=["normalize"])
def save(context: TaskContext) -> dict[str, str]:
    path = context.workspace_path("username.txt")
    path.write_text(context.result("normalize")["username"], encoding="utf-8")
    return {"file": path.name}
```

Set `TASK_MODULE=tasks`. For a local process, configure `hostRunner` with
`executable: "python"`, `arguments: ["-m", "scheduler_sdk.runner"]`, the
project's `workingDirectory`, and an existing `workspaceRoot`. For Docker,
start the same runner as the image entrypoint and copy/install this package.
`execution_target="host"` on `@task` selects a local runner in hybrid mode.

Example host-only runner configuration:

```json
{"executable":"python","arguments":["-m","scheduler_sdk.runner"],"workingDirectory":"C:/project","workspaceRoot":"C:/project/workspace","environment":{"TASK_MODULE":"tasks"}}
```

The runner writes exactly one JSON reply to stdout; task `print()` output is
redirected to stderr and appears as logs. Task return values must be JSON-safe.

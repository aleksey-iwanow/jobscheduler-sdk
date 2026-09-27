# JobScheduler task protocol v1

The protocol is public and language-neutral. A runner is a one-shot executable:
JobScheduler starts it for `describe` or one `execute`, then reads its exit code.

Input is UTF-8 JSON. A host runner reads one request from stdin. A Docker runner
reads base64-encoded JSON from `TASK_REQUEST_B64`. The runner writes exactly one
JSON reply to stdout; all diagnostic output goes to stderr. Both requests and
replies use `protocolVersion: 1` and echo the same `runId`.

`describe` request:

```json
{"protocolVersion":1,"operation":"describe","runId":"catalog-1"}
```

Successful catalog reply:

```json
{"protocolVersion":1,"runId":"catalog-1","status":"succeeded","processes":[{"processId":"people","description":"","tasks":[{"taskId":"normalize","description":"","dependsOn":[],"executionTarget":"container","parameters":[{"name":"username","type":"string","required":true}]}]}],"result":null,"error":null}
```

`execute` request:

```json
{"protocolVersion":1,"operation":"execute","runId":"task-1","processRunId":"run-1","processId":"people","taskId":"normalize","parameters":{"username":"  Ada  "},"upstream":{},"workspace":"/workspace/runs/run-1"}
```

Successful task reply:

```json
{"protocolVersion":1,"runId":"task-1","status":"succeeded","result":{"username":"ada"},"error":null}
```

Failure reply uses `status: "failed"`, `result: null`, and
`error: {"type":"ErrorName","message":"Explanation"}`. Task results and
parameters must be JSON-serializable. `upstream` contains direct dependency
results. `workspace` may be null; large files should be saved there and passed
between tasks by relative path rather than in JSON.

Parameter `type` is `string`, `integer`, `number`, `boolean`, or `any`.
`executionTarget` is `container` or `host`; host-only registrations execute all
tasks on the host regardless of this catalog field. Hybrid registrations read
their catalog from the Docker image and route tasks by `executionTarget`.

Runner implementations should validate input version, run ID, operation, task
identity, and parameter shape. Keep stdout clean even when user task code prints.

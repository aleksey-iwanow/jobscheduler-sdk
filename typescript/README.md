# JobScheduler TypeScript SDK

TypeScript/Node implementation of JobScheduler task protocol v1 (documented in
the source repository at `protocol/README.md`).
It uses the same ideas as the Python SDK: `process`, `task`, task dependencies,
`context.result()` and a run workspace. The schema of TypeScript parameters is
declared explicitly because types disappear at runtime.

The package is named `@ahell/jobscheduler-sdk`. Confirm that the publishing
account controls this npm scope before the first release.

After the npm release, install into a Node project:

```bash
npm install @ahell/jobscheduler-sdk
```

Task module (`src/tasks.ts`):

```ts
import { writeFile } from "node:fs/promises";
import { process, task } from "@ahell/jobscheduler-sdk";

process("people", { description: "Normalize and save names" });

task("normalize", { process: "people", parameters: { username: "string" } },
  ({ username }: { username: string }) => ({ username: username.trim().toLowerCase() }));

task("save", { process: "people", dependsOn: ["normalize"] },
  async (_, context) => {
    const username = context.result<{ username: string }>("normalize").username;
    const file = context.workspacePath("username.txt");
    await writeFile(file, username, "utf8");
    return { file: "username.txt" };
  });
```

Compile the task project to JavaScript. Set `TASK_MODULE=./dist/tasks.js` and
start the installed `jobscheduler-runner` executable. In `hostRunner`, use
`executable: "node"`, `arguments` pointing to the installed package's
`dist/runner.js`, the project's `workingDirectory`, and an existing
`workspaceRoot`. In Docker, use the same runner as the image entrypoint.

For example, a host-only registration can use:

```json
{"executionMode":"host","image":"","sdkProcessId":"people","hostRunner":{"executable":"node","arguments":["C:/project/node_modules/@ahell/jobscheduler-sdk/dist/runner.js"],"workingDirectory":"C:/project","workspaceRoot":"C:/project/workspace","environment":{"TASK_MODULE":"./dist/tasks.js"}}}
```

The project compiles its TypeScript tasks before registration. The runner
itself is already compiled in the npm package; JobScheduler does not compile
user code.

For hybrid mode, set `executionTarget: "host"` in the task options. Both the
local program and the Docker image should contain matching versions of the
task module. The package needs Node 20 or newer.

The runner reads stdin on the host or `TASK_REQUEST_B64` in Docker. It writes
one JSON reply to stdout and forwards task output to stderr. Return small,
JSON-serializable values; pass large files through `workspacePath()`.

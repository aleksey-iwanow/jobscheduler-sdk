import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";

const runner = resolve("dist/runner.js");
const tasks = resolve("tests/tasks.mjs");

function call(payload, docker = false) {
  const request = JSON.stringify({ protocolVersion: 1, runId: "task-1", ...payload });
  const env = { ...process.env, TASK_MODULE: tasks };
  delete env.TASK_REQUEST_B64;
  if (docker) env.TASK_REQUEST_B64 = Buffer.from(request).toString("base64");
  const result = spawnSync(process.execPath, [runner], {
    cwd: process.cwd(), env, input: docker ? undefined : request, encoding: "utf8", timeout: 10_000,
  });
  return { result, reply: JSON.parse(result.stdout) };
}

test("describe has the same catalog shape over stdin and Docker transport", () => {
  for (const docker of [false, true]) {
    const { result, reply } = call({ operation: "describe" }, docker);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(reply.protocolVersion, 1);
    assert.equal(reply.processes[0].processId, "people");
    assert.deepEqual(reply.processes[0].tasks[0].parameters,
      [{ name: "username", type: "string", required: true }]);
  }
});

test("execute transfers upstream data and writes into the run workspace", () => {
  const workspace = mkdtempSync(resolve(tmpdir(), "jobscheduler-ts-test-"));
  try {
    const first = call({ operation: "execute", processId: "people", taskId: "normalize",
      parameters: { username: "  Ada  " } });
    assert.equal(first.reply.result.username, "ada");
    const second = call({ operation: "execute", processId: "people", taskId: "save",
      parameters: {}, upstream: { normalize: first.reply.result }, workspace });
    assert.equal(second.result.status, 0, second.result.stderr);
    assert.equal(second.reply.result.username, "ada");
    assert.equal(readFileSync(resolve(workspace, "username.txt"), "utf8"), "ada");
    assert.match(second.result.stderr, /saved ada/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

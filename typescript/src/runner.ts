#!/usr/bin/env node
import { writeSync } from "node:fs";
import { handle, loadTasks, readRequest } from "./protocol.js";
import type { TaskReply } from "./types.js";

async function main(): Promise<number> {
  let runId: string | null = null;
  let output: string;
  const write = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) =>
    process.stderr.write(chunk, ...(args as []))) as typeof process.stdout.write;
  let code = 0;
  try {
    const request = await readRequest();
    runId = typeof request.runId === "string" ? request.runId : null;
    await loadTasks();
    const reply = await handle(request);
    output = JSON.stringify(reply);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error(failure.stack ?? failure.message);
    const reply: TaskReply = { protocolVersion: 1, runId, status: "failed", result: null,
      error: { type: failure.name, message: failure.message } };
    output = JSON.stringify(reply);
    code = 1;
  } finally {
    process.stdout.write = write;
  }
  writeSync(1, output + "\n");
  return code;
}

process.exitCode = await main();

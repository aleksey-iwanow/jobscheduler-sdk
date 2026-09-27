import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execute } from "./execution.js";
import { describe } from "./registry.js";
import type { TaskReply, TaskRequest } from "./types.js";

const maxRequestBytes = 64 * 1024;

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += data.length;
    if (length > maxRequestBytes) throw new Error("Task request exceeds 64 KiB");
    chunks.push(data);
  }
  return Buffer.concat(chunks);
}

export async function readRequest(): Promise<TaskRequest> {
  const encoded = process.env.TASK_REQUEST_B64;
  const raw = encoded === undefined ? await readStdin() : Buffer.from(encoded, "base64");
  if (encoded !== undefined && raw.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, ""))
    throw new Error("TASK_REQUEST_B64 is not valid base64");
  if (raw.length > maxRequestBytes) throw new Error("Task request exceeds 64 KiB");
  const value: unknown = JSON.parse(raw.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Request must be a JSON object");
  return value as TaskRequest;
}

export async function loadTasks(): Promise<void> {
  const moduleName = process.env.TASK_MODULE;
  if (!moduleName) throw new Error("TASK_MODULE must name the compiled task module");
  const specifier = moduleName.startsWith(".") || moduleName.startsWith("/") || /^[A-Za-z]:[\\/]/.test(moduleName)
    ? pathToFileURL(resolve(moduleName)).href : moduleName;
  await import(specifier);
}

export async function handle(request: TaskRequest): Promise<TaskReply> {
  if (typeof request.runId !== "string" || !request.runId)
    throw new Error("runId must be a non-empty string");
  if (request.protocolVersion !== 1) throw new Error("Unsupported protocol version");
  if (request.operation === "describe")
    return { protocolVersion: 1, runId: request.runId, status: "succeeded",
      result: null, error: null, processes: describe() };
  if (request.operation === "execute" || request.operation === undefined)
    return { protocolVersion: 1, runId: request.runId, status: "succeeded",
      result: await execute(request) ?? null, error: null };
  throw new Error(`Unknown operation: ${request.operation}`);
}

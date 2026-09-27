import { TaskContext } from "./context.js";
import { getTask } from "./registry.js";
import type { ParameterType, TaskRequest } from "./types.js";

function matches(value: unknown, type: ParameterType): boolean {
  switch (type) {
    case "string": return typeof value === "string";
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
    case "any": return true;
  }
}

export async function execute(request: TaskRequest): Promise<unknown> {
  if (typeof request.processId !== "string" || typeof request.taskId !== "string" ||
      !request.parameters || typeof request.parameters !== "object" || Array.isArray(request.parameters))
    throw new Error("processId and taskId must be strings and parameters must be an object");
  const entry = getTask(request.processId, request.taskId);
  const schema = entry.options.parameters ?? {};
  for (const [name, definition] of Object.entries(schema)) {
    const type = typeof definition === "string" ? definition : definition.type;
    const required = typeof definition === "string" || definition.required !== false;
    const value = request.parameters[name];
    if (value === undefined && required) throw new Error(`Missing parameter: ${name}`);
    if (value !== undefined && !matches(value, type)) throw new TypeError(`${name} must be ${type}`);
  }
  for (const name of Object.keys(request.parameters))
    if (!(name in schema)) throw new Error(`Unknown parameter: ${name}`);
  if (request.upstream !== undefined &&
      (typeof request.upstream !== "object" || request.upstream === null || Array.isArray(request.upstream)))
    throw new Error("upstream must be an object");
  if (request.workspace != null && typeof request.workspace !== "string")
    throw new Error("workspace must be a string or null");
  const context = new TaskContext({
    runId: request.processRunId ?? request.runId,
    taskRunId: request.runId,
    processId: request.processId,
    taskId: request.taskId,
    upstream: request.upstream ?? {},
    workspace: request.workspace,
  });
  return await entry.handler(request.parameters, context);
}

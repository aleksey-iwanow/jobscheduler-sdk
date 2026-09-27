import type { ParameterDefinition, ParameterSchema, ParameterType, ProcessDescriptor, TaskOptions } from "./types.js";
import type { TaskContext } from "./context.js";

type Handler = (parameters: Record<string, unknown>, context: TaskContext) => unknown | Promise<unknown>;
type RegisteredTask = { taskId: string; options: TaskOptions; handler: Handler };
const namePattern = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const processes = new Map<string, string>();
const tasks = new Map<string, RegisteredTask>();

function checkName(name: string, kind: string): void {
  if (!namePattern.test(name)) throw new Error(`${kind} name must start with a letter and use only letters, digits, ._-.`);
}

function key(processId: string, taskId: string): string { return `${processId}\0${taskId}`; }

export function process(name: string, options: { description?: string } = {}): void {
  checkName(name, "Process");
  if (processes.has(name)) throw new Error(`Duplicate process name: ${name}`);
  processes.set(name, options.description ?? "");
}

export function task<P extends Record<string, unknown>>(
  name: string, options: TaskOptions, handler: (parameters: P, context: TaskContext) => unknown | Promise<unknown>,
): void {
  checkName(name, "Task");
  if (!processes.has(options.process)) throw new Error(`Declare process ${options.process} before registering its tasks`);
  for (const dependency of options.dependsOn ?? []) checkName(dependency, "Dependency");
  if (new Set(options.dependsOn ?? []).size !== (options.dependsOn ?? []).length)
    throw new Error(`Duplicate dependency in task ${name}`);
  if (options.executionTarget && !["container", "host"].includes(options.executionTarget))
    throw new Error(`Unsupported execution target: ${options.executionTarget}`);
  parameterDescriptors(options.parameters ?? {});
  const id = key(options.process, name);
  if (tasks.has(id)) throw new Error(`Duplicate task name in process ${options.process}: ${name}`);
  tasks.set(id, { taskId: name, options, handler: handler as Handler });
}

export function getTask(processId: string, taskId: string): RegisteredTask {
  const entry = tasks.get(key(processId, taskId));
  if (!entry) throw new Error(`Unknown task: ${processId}/${taskId}`);
  return entry;
}

function parameterDescriptors(schema: ParameterSchema) {
  const result: { name: string; type: ParameterType; required: boolean }[] = [];
  for (const [name, definition] of Object.entries(schema)) {
    checkName(name, "Parameter");
    const field: ParameterDefinition = definition;
    const type = typeof field === "string" ? field : field?.type;
    if (!["string", "integer", "number", "boolean", "any"].includes(type))
      throw new Error(`Unsupported parameter type for ${name}`);
    result.push({ name, type, required: typeof field === "string" ? true : field.required !== false });
  }
  return result;
}

export function describe(): ProcessDescriptor[] {
  return [...processes].map(([processId, description]) => {
    const owned = [...tasks.values()].filter(entry => entry.options.process === processId);
    const byId = new Map(owned.map(entry => [entry.taskId, entry]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(taskId: string): void {
      if (visiting.has(taskId)) throw new Error(`Dependency cycle in ${processId}/${taskId}`);
      if (visited.has(taskId)) return;
      const entry = byId.get(taskId);
      if (!entry) throw new Error(`Unknown dependency ${taskId} in ${processId}`);
      visiting.add(taskId);
      for (const dependency of entry.options.dependsOn ?? []) visit(dependency);
      visiting.delete(taskId);
      visited.add(taskId);
    }
    for (const entry of owned) visit(entry.taskId);
    return { processId, description, tasks: owned.map(entry => ({
      taskId: entry.taskId,
      description: entry.options.description ?? "",
      dependsOn: entry.options.dependsOn ?? [],
      executionTarget: entry.options.executionTarget ?? "container",
      parameters: parameterDescriptors(entry.options.parameters ?? {}),
    })) };
  });
}

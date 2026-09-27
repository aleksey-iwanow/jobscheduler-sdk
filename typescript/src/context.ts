import { isAbsolute, relative, resolve, sep } from "node:path";

export class TaskContext {
  readonly runId: string;
  readonly taskRunId: string;
  readonly processId: string;
  readonly taskId: string;
  readonly upstream: Record<string, unknown>;
  readonly workspace: string | null;

  constructor(input: {
    runId: string; taskRunId: string; processId: string; taskId: string;
    upstream: Record<string, unknown>; workspace?: string | null;
  }) {
    this.runId = input.runId;
    this.taskRunId = input.taskRunId;
    this.processId = input.processId;
    this.taskId = input.taskId;
    this.upstream = input.upstream;
    this.workspace = input.workspace ?? null;
  }

  result<T = unknown>(taskId: string): T {
    if (!Object.prototype.hasOwnProperty.call(this.upstream, taskId))
      throw new Error(`No dependency result for ${taskId}`);
    return this.upstream[taskId] as T;
  }

  workspacePath(...parts: string[]): string {
    if (!this.workspace) throw new Error("No writable workspace is configured for this process");
    const root = resolve(this.workspace);
    const path = resolve(root, ...parts);
    const offset = relative(root, path);
    if (offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset))
      throw new Error("Workspace path must stay inside this process run");
    return path;
  }
}

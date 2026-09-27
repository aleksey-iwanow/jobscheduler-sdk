export type ParameterType = "string" | "integer" | "number" | "boolean" | "any";
export type ParameterDefinition = ParameterType | { type: ParameterType; required?: boolean };
export type ParameterSchema = Record<string, ParameterDefinition>;
export type ExecutionTarget = "container" | "host";

export type TaskOptions = {
  process: string;
  description?: string;
  dependsOn?: string[];
  executionTarget?: ExecutionTarget;
  parameters?: ParameterSchema;
};

export type TaskRequest = {
  protocolVersion: number;
  operation?: "describe" | "execute";
  runId: string;
  processRunId?: string;
  processId?: string;
  taskId?: string;
  parameters?: Record<string, unknown>;
  upstream?: Record<string, unknown>;
  workspace?: string | null;
};

export type TaskError = { type: string; message: string };
export type TaskReply = {
  protocolVersion: 1;
  runId: string | null;
  status: "succeeded" | "failed";
  result: unknown | null;
  error: TaskError | null;
  processes?: ProcessDescriptor[];
};

export type TaskDescriptor = {
  taskId: string;
  description: string;
  dependsOn: string[];
  executionTarget: ExecutionTarget;
  parameters: { name: string; type: ParameterType; required: boolean }[];
};

export type ProcessDescriptor = { processId: string; description: string; tasks: TaskDescriptor[] };

import { query } from "@anthropic-ai/claude-agent-sdk";
import { WORKER_OUTPUT_JSON_SCHEMA, WorkerOutput, type Dimension, type WorkerInput } from "../core/schemas.js";

export interface WorkerConfig {
  dimension: Dimension;
  systemPrompt: string;
}

/**
 * BaseWorker runs a Claude Code subprocess via the Agent SDK.
 * Claude explores the project using Read/Glob/Grep tools and returns structured output.
 */
export class BaseWorker {
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  get dimension(): Dimension {
    return this.config.dimension;
  }

  async analyze(input: WorkerInput): Promise<WorkerOutput> {
    const messages = query({
      prompt: this.buildUserMessage(input),
      options: {
        cwd: input.manifest.rootDir,
        systemPrompt: this.config.systemPrompt,
        allowedTools: ["Read", "Glob", "Grep"],
        permissionMode: "bypassPermissions",
        outputFormat: { type: "json_schema", schema: WORKER_OUTPUT_JSON_SCHEMA as Record<string, unknown> },
      },
    });

    for await (const msg of messages) {
      if (msg.type === "result" && msg.subtype === "success") {
        return WorkerOutput.parse(msg.structured_output);
      }
      if (msg.type === "result") {
        const errors = (msg as { errors?: string[] }).errors;
        throw new Error(errors?.join(", ") ?? "Worker failed");
      }
    }

    throw new Error("Worker produced no result");
  }

  private buildUserMessage(input: WorkerInput): string {
    return `Analyze this project for AI readiness in the "${input.dimension}" dimension.

## Project Overview
- Root: ${input.manifest.rootDir}
- Languages: ${input.manifest.languages.join(", ") || "unknown"}
- Frameworks: ${input.manifest.frameworks.join(", ") || "none detected"}
- Package Manager: ${input.manifest.packageManager || "unknown"}
- Total Files: ${input.manifest.stats.totalFiles}
- Source Files: ${input.manifest.stats.sourceFiles}
- Test Files: ${input.manifest.stats.testFiles}
- Doc Files: ${input.manifest.stats.docFiles}
- CI Files: ${input.manifest.stats.ciFiles}
- Agent Rules Files: ${input.manifest.stats.agentRulesFiles}

Use the Read, Glob, and Grep tools to explore the project files relevant to the "${input.dimension}" dimension, then provide your structured analysis.`;
  }
}

import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MAX_TOKENS, DEFAULT_MODEL } from "../core/config.js";
import { WorkerOutput, type Dimension, type WorkerInput } from "../core/schemas.js";

export interface WorkerConfig {
  dimension: Dimension;
  systemPrompt: string;
}

/**
 * BaseWorker handles the common LLM interaction pattern:
 *   1. Builds a prompt from WorkerInput + dimension-specific system prompt
 *   2. Calls the LLM
 *   3. Parses and validates the structured output
 *
 * Concrete workers only need to provide a dimension and system prompt.
 */
export class BaseWorker {
  private client: Anthropic;
  private config: WorkerConfig;

  constructor(client: Anthropic, config: WorkerConfig) {
    this.client = client;
    this.config = config;
  }

  get dimension(): Dimension {
    return this.config.dimension;
  }

  async analyze(input: WorkerInput): Promise<WorkerOutput> {
    const userMessage = this.buildUserMessage(input);

    const response = await this.client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: this.config.systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("");

    return this.parseOutput(text);
  }

  private buildUserMessage(input: WorkerInput): string {
    const fileList = Object.keys(input.fileContents);
    const fileSummary = fileList.length > 0
      ? `\nFiles provided for analysis (${fileList.length} files):\n${fileList.map((f) => `  - ${f}`).join("\n")}`
      : "\nNo files matched for this dimension.";

    const fileContents = Object.entries(input.fileContents)
      .map(
        ([filePath, content]) =>
          `\n--- FILE: ${filePath} ---\n${content}\n--- END FILE ---`
      )
      .join("\n");

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
${fileSummary}

## File Contents
${fileContents || "(no file contents available)"}

Respond ONLY with a JSON object matching this exact schema:
{
  "dimension": "${input.dimension}",
  "score": <number 0-10>,
  "maxScore": 10,
  "summary": "<1-2 sentence summary of findings>",
  "findings": [
    {
      "severity": "error" | "warning" | "info",
      "message": "<what was found>",
      "file": "<optional: file path>",
      "line": <optional: line number>,
      "evidence": "<optional: relevant snippet or detail>"
    }
  ],
  "suggestions": [
    {
      "impact": "high" | "medium" | "low",
      "effort": "trivial" | "small" | "medium" | "large",
      "description": "<actionable suggestion>",
      "example": "<optional: concrete example>"
    }
  ]
}`;
  }

  private parseOutput(text: string): WorkerOutput {
    // Extract JSON from response (handle markdown fences)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
      null,
      text,
    ];
    const jsonStr = (jsonMatch[1] || text).trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return WorkerOutput.parse(parsed);
    } catch (error) {
      // Return a fallback error output if parsing fails
      return {
        dimension: this.config.dimension,
        score: 0,
        maxScore: 10,
        summary: `Analysis failed: unable to parse worker output. Raw: ${text.slice(0, 200)}`,
        findings: [
          {
            severity: "error",
            message: `Worker output parsing failed: ${error instanceof Error ? error.message : "unknown error"}`,
          },
        ],
        suggestions: [],
      };
    }
  }
}

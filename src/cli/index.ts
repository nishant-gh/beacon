#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { ALL_DIMENSIONS, DIMENSION_LABELS } from "../core/config.js";
import { analyzeProject } from "../core/orchestrator.js";
import type { Dimension } from "../core/schemas.js";
import { renderReport } from "./render.js";

const program = new Command();

program
  .name("beacon")
  .description(
    "Shine a light on your codebase's AI readiness. Evaluates how well your project is set up for AI coding agents."
  )
  .version("0.1.0")
  .argument("[path]", "Path to the project to analyze", ".")
  .option(
    "-d, --dimensions <dims>",
    "Comma-separated list of dimensions to analyze"
  )
  .option(
    "-o, --output <file>",
    "Save JSON report to file"
  )
  .option(
    "--json",
    "Output raw JSON instead of formatted report"
  )
  .action(async (projectPath: string, options) => {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      console.error(
        chalk.red(
          "\nError: Authentication required. Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable.\n"
        )
      );
      process.exit(1);
    }

    // Parse dimensions if specified
    let dimensions: Dimension[] | undefined;
    if (options.dimensions) {
      dimensions = options.dimensions.split(",").map((d: string) => d.trim());
      const invalid = dimensions!.filter(
        (d) => !ALL_DIMENSIONS.includes(d as Dimension)
      );
      if (invalid.length > 0) {
        console.error(
          chalk.red(`\nInvalid dimensions: ${invalid.join(", ")}`)
        );
        console.error(
          chalk.dim(`Valid dimensions: ${ALL_DIMENSIONS.join(", ")}\n`)
        );
        process.exit(1);
      }
    }

    // Resolve project path
    const resolvedPath = path.resolve(projectPath);
    try {
      await fs.access(resolvedPath);
    } catch {
      console.error(chalk.red(`\nError: Path not found: ${resolvedPath}\n`));
      process.exit(1);
    }

    console.log("");
    console.log(
      chalk.bold("🔦 Beacon")
    );
    console.log(chalk.dim(`   Analyzing: ${resolvedPath}`));
    console.log("");

    // Progress tracking
    const spinner = ora({ text: "Discovering project structure...", color: "cyan" }).start();
    const workerStatus = new Map<string, string>();
    const workerActivity = new Map<string, string>();

    const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
    const frameRef = { value: 0 };
    const lastLineCount = { value: 0 };
    let renderInterval: NodeJS.Timeout | undefined;
    let activeDimensions: Dimension[] = [];

    try {
      const report = await analyzeProject({
        projectPath: resolvedPath,
        dimensions: dimensions as Dimension[],
        callbacks: {
          onDiscoveryStart() {
            spinner.text = "Discovering project structure...";
          },
          onDiscoveryComplete(manifest) {
            spinner.succeed(
              `Discovered ${manifest.stats.totalFiles} files (${manifest.languages.join(", ") || "unknown language"})`
            );
            activeDimensions = (dimensions ?? ALL_DIMENSIONS) as Dimension[];
            lastLineCount.value = 0;
            renderInterval = setInterval(() => {
              renderMultiLine(activeDimensions, workerStatus, workerActivity, frameRef, lastLineCount, FRAMES);
            }, 150);
          },
          onWorkerStart(dimension) {
            workerStatus.set(dimension, "running");
          },
          onWorkerToolCall(dimension, tool, input) {
            workerActivity.set(dimension, formatToolCall(tool, input));
          },
          onWorkerComplete(dimension, output) {
            workerStatus.set(dimension, `done (${output.score}/10)`);
            workerActivity.delete(dimension);
          },
          onWorkerError(dimension, error) {
            workerStatus.set(dimension, `failed: ${error.message}`);
            workerActivity.delete(dimension);
          },
          onSynthesisStart() {
            clearInterval(renderInterval);
            renderMultiLine(activeDimensions, workerStatus, workerActivity, frameRef, lastLineCount, FRAMES);
            spinner.start("Synthesizing report...");
          },
          onSynthesisComplete() {
            spinner.succeed("Analysis complete!");
          },
        },
      });

      // Output
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(renderReport(report));
      }

      // Save JSON report if requested
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
        console.log(chalk.dim(`Report saved to ${outputPath}`));
      }

      // Exit with non-zero if score is very low (useful for CI)
      if (report.overallScore < 30) {
        process.exit(1);
      }
    } catch (error) {
      clearInterval(renderInterval);
      spinner.fail("Analysis failed");
      console.error(
        chalk.red(
          `\n${error instanceof Error ? error.message : String(error)}\n`
        )
      );
      process.exit(1);
    }
  });

function renderMultiLine(
  activeDimensions: Dimension[],
  status: Map<string, string>,
  activity: Map<string, string>,
  frameRef: { value: number },
  lastLineCount: { value: number },
  frames: string[]
) {
  // Move cursor up by however many lines the previous render wrote.
  // On the first call lastLineCount is 0 so we just append below the spinner.
  if (lastLineCount.value > 0) {
    process.stdout.write(`\x1B[${lastLineCount.value}A`);
  }

  const lines: string[] = [];
  for (const dim of activeDimensions) {
    const s = status.get(dim);
    const act = activity.get(dim) ?? "—";
    const label = DIMENSION_LABELS[dim].padEnd(30);

    if (!s) {
      lines.push(`  ${chalk.dim("·")} ${chalk.dim(label)} ${chalk.dim("—")}`);
    } else if (s === "running") {
      const frame = chalk.cyan(frames[frameRef.value % frames.length]);
      lines.push(`  ${frame} ${label} ${chalk.dim(act)}`);
    } else if (s.startsWith("done")) {
      lines.push(`  ${chalk.green("✓")} ${label} ${chalk.dim(s)}`);
    } else {
      lines.push(`  ${chalk.red("✗")} ${label} ${chalk.red(s)}`);
    }
  }

  const completed = [...status.values()].filter(s => s !== "running").length;
  lines.push("");
  lines.push(chalk.dim(`  Analyzing: ${completed}/${activeDimensions.length} complete`));

  process.stdout.write(lines.map(l => `\x1B[2K${l}`).join("\n") + "\n");
  lastLineCount.value = lines.length;
  frameRef.value++;
}

function formatToolCall(tool: string, input: unknown): string {
  if (tool === "Glob" && input && typeof input === "object" && "pattern" in input) {
    return `Glob(${(input as { pattern: string }).pattern})`;
  }
  if (tool === "Grep" && input && typeof input === "object" && "pattern" in input) {
    return `Grep(${(input as { pattern: string }).pattern})`;
  }
  if (tool === "Read" && input && typeof input === "object" && "file_path" in input) {
    const p = (input as { file_path: string }).file_path;
    return `Read(${p.split("/").slice(-2).join("/")})`;
  }
  return tool;
}

program.parse();

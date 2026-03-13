#!/usr/bin/env node

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import ora from "ora";
import { z } from "zod";
import { ALL_DIMENSIONS, DIMENSION_LABELS } from "../core/config.js";
import { analyzeProject } from "../core/orchestrator.js";
import { Dimension } from "../core/schemas.js";

interface CliOptions {
  dimensions?: string;
  output?: string;
  json?: boolean;
}
import { renderReport, renderReportMarkdown } from "./render.js";

const program = new Command();

program
  .name("beacon")
  .description(
    "Shine a light on your codebase's AI readiness. Evaluates how well your project is set up for AI coding agents."
  )
  .version("0.1.0")
  .argument("[path]", "Path to the project to analyze", ".")
  .option("-d, --dimensions <dims>", "Comma-separated list of dimensions to analyze")
  .option("-o, --output <file>", "Save JSON report to file")
  .option("--json", "Output raw JSON instead of formatted report")
  .action(async (projectPath: string, options: CliOptions) => {
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
      const raw = options.dimensions.split(",").map((d: string) => d.trim());
      const result = z.array(Dimension).safeParse(raw);
      if (!result.success) {
        const invalid = raw.filter((d: string) => !ALL_DIMENSIONS.includes(d as Dimension));
        console.error(chalk.red(`\nInvalid dimensions: ${invalid.join(", ")}`));
        console.error(chalk.dim(`Valid dimensions: ${ALL_DIMENSIONS.join(", ")}\n`));
        process.exit(1);
      }
      dimensions = result.data;
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
    console.log(chalk.bold("🔦 Beacon"));
    console.log(chalk.dim(`   Analyzing: ${resolvedPath}`));
    console.log("");

    // Progress tracking
    const spinner = ora({ text: "Discovering project structure...", color: "cyan" }).start();
    const workerStatus = new Map<string, string>();
    const workerActivity = new Map<string, string>();
    const workerTokens = new Map<
      string,
      { input: number; output: number; cache: number; cost: number }
    >();

    const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const frameRef = { value: 0 };
    const lastLineCount = { value: 0 };
    let renderInterval: NodeJS.Timeout | undefined;
    let activeDimensions: Dimension[] = [];

    try {
      const report = await analyzeProject({
        projectPath: resolvedPath,
        dimensions,
        callbacks: {
          onDiscoveryStart() {
            spinner.text = "Discovering project structure...";
          },
          onDiscoveryComplete(manifest) {
            spinner.succeed(
              `Discovered ${manifest.stats.totalFiles} files (${manifest.languages.join(", ") || "unknown language"})`
            );
            activeDimensions = dimensions ?? ALL_DIMENSIONS;
            lastLineCount.value = 0;
            renderInterval = setInterval(() => {
              renderMultiLine(
                activeDimensions,
                workerStatus,
                workerActivity,
                frameRef,
                lastLineCount,
                FRAMES
              );
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
            if (output.meta) {
              workerTokens.set(dimension, {
                input: output.meta.inputTokens,
                output: output.meta.outputTokens,
                cache: output.meta.cacheReadTokens,
                cost: output.meta.costUsd,
              });
            }
          },
          onWorkerError(dimension, error) {
            workerStatus.set(dimension, `failed: ${error.message}`);
            workerActivity.delete(dimension);
          },
          onSynthesisStart() {
            clearInterval(renderInterval);
            renderMultiLine(
              activeDimensions,
              workerStatus,
              workerActivity,
              frameRef,
              lastLineCount,
              FRAMES
            );
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
        console.log(renderTokenTable(activeDimensions, workerTokens));
      }

      // Save JSON report if requested
      if (options.output) {
        const outputPath = path.resolve(options.output);
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
        console.log(chalk.dim(`Report saved to ${outputPath}`));
      }

      // Always save markdown report
      const workerMeta = new Map(
        [...workerTokens.entries()].map(([dim, t]) => [
          dim,
          {
            durationMs: 0,
            numTurns: 0,
            costUsd: t.cost,
            inputTokens: t.input,
            outputTokens: t.output,
            cacheReadTokens: t.cache,
          },
        ])
      );
      const ts = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
      const mdPath = path.resolve(`beacon-report-${ts}.md`);
      await fs.writeFile(mdPath, renderReportMarkdown(report, workerMeta));
      console.log(chalk.dim(`Markdown report saved to ${mdPath}`));

      // Exit with non-zero if score is very low (useful for CI)
      if (report.overallScore < 30) {
        process.exit(1);
      }
    } catch (error) {
      clearInterval(renderInterval);
      spinner.fail("Analysis failed");
      console.error(chalk.red(`\n${error instanceof Error ? error.message : String(error)}\n`));
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

  const cols = process.stdout.columns ?? 100;
  // Layout: "  X " (4) + label (30) + " " + act
  const actMaxWidth = Math.max(10, cols - 4 - 31);

  const lines: string[] = [];
  for (const dim of activeDimensions) {
    const s = status.get(dim);
    const act = (activity.get(dim) ?? "—").slice(0, actMaxWidth);
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

  const completed = [...status.values()].filter((s) => s !== "running").length;
  lines.push("");
  lines.push(chalk.dim(`  Analyzing: ${completed}/${activeDimensions.length} complete`));

  process.stdout.write(lines.map((l) => `\x1B[2K${l}`).join("\n") + "\n");
  lastLineCount.value = lines.length;
  frameRef.value++;
}

function renderTokenTable(
  dimensions: Dimension[],
  tokens: Map<string, { input: number; output: number; cache: number; cost: number }>
): string {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const COL = { label: 30, input: 10, output: 10, cache: 13 };
  const sepLen = 2 + COL.label + COL.input + COL.output + COL.cache;
  const sep = chalk.dim("─".repeat(sepLen));
  const header = chalk.dim(
    "  " +
      "Dimension".padEnd(COL.label) +
      "Input".padStart(COL.input) +
      "Output".padStart(COL.output) +
      "Cache Read".padStart(COL.cache)
  );

  const rows = dimensions.map((dim) => {
    const t = tokens.get(dim);
    if (!t)
      return chalk.dim(
        "  " +
          DIMENSION_LABELS[dim].padEnd(COL.label) +
          "—".padStart(COL.input) +
          "—".padStart(COL.output) +
          "—".padStart(COL.cache)
      );
    return (
      "  " +
      chalk.dim(DIMENSION_LABELS[dim].padEnd(COL.label)) +
      chalk.dim(fmt(t.input).padStart(COL.input)) +
      chalk.dim(fmt(t.output).padStart(COL.output)) +
      chalk.dim(fmt(t.cache).padStart(COL.cache))
    );
  });

  const totals = [...tokens.values()].reduce(
    (acc, t) => ({
      input: acc.input + t.input,
      output: acc.output + t.output,
      cache: acc.cache + t.cache,
      cost: acc.cost + t.cost,
    }),
    { input: 0, output: 0, cache: 0, cost: 0 }
  );
  const totalRow =
    "  " +
    chalk.bold("Total".padEnd(COL.label)) +
    chalk.bold(fmt(totals.input).padStart(COL.input)) +
    chalk.bold(fmt(totals.output).padStart(COL.output)) +
    chalk.bold(fmt(totals.cache).padStart(COL.cache));
  const costRow = chalk.dim(`  Total cost: $${totals.cost.toFixed(4)}`);

  return [chalk.bold("  Token Usage"), sep, header, sep, ...rows, sep, totalRow, costRow, ""].join(
    "\n"
  );
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
  if (tool === "Bash" && input && typeof input === "object" && "command" in input) {
    const cmd = (input as { command: string }).command.trim();
    return `$ ${cmd.slice(0, 50)}`;
  }
  return tool;
}

program.parse();

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
  .option(
    "-k, --api-key <key>",
    "Anthropic API key (defaults to ANTHROPIC_API_KEY env var)"
  )
  .action(async (projectPath: string, options) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error(
        chalk.red(
          "\nError: Anthropic API key required. Set ANTHROPIC_API_KEY environment variable or use --api-key flag.\n"
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

    try {
      const report = await analyzeProject({
        projectPath: resolvedPath,
        apiKey,
        dimensions: dimensions as Dimension[],
        callbacks: {
          onDiscoveryStart() {
            spinner.text = "Discovering project structure...";
          },
          onDiscoveryComplete(manifest) {
            spinner.succeed(
              `Discovered ${manifest.stats.totalFiles} files (${manifest.languages.join(", ") || "unknown language"})`
            );
          },
          onWorkerStart(dimension) {
            workerStatus.set(dimension, "running");
            updateWorkerSpinner(spinner, workerStatus);
          },
          onWorkerComplete(dimension, output) {
            workerStatus.set(
              dimension,
              `done (${output.score}/10)`
            );
            updateWorkerSpinner(spinner, workerStatus);
          },
          onWorkerError(dimension, error) {
            workerStatus.set(dimension, `failed: ${error.message}`);
            updateWorkerSpinner(spinner, workerStatus);
          },
          onSynthesisStart() {
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
      spinner.fail("Analysis failed");
      console.error(
        chalk.red(
          `\n${error instanceof Error ? error.message : String(error)}\n`
        )
      );
      process.exit(1);
    }
  });

function updateWorkerSpinner(
  spinner: ReturnType<typeof ora>,
  status: Map<string, string>
) {
  const running = [...status.entries()]
    .filter(([, s]) => s === "running")
    .map(([d]) => DIMENSION_LABELS[d as Dimension]);

  const completed = [...status.entries()].filter(
    ([, s]) => s !== "running"
  ).length;

  const total = status.size;

  if (running.length > 0) {
    spinner.text = `Analyzing [${completed}/${total}]: ${running.join(", ")}`;
    if (!spinner.isSpinning) spinner.start();
  } else {
    spinner.succeed(`All ${total} dimensions analyzed`);
  }
}

program.parse();

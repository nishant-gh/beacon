import chalk from "chalk";
import { DIMENSION_LABELS } from "../core/config.js";
import type { DimensionReport, FinalReport } from "../core/schemas.js";

/**
 * Render the final report to the terminal with colors and progress bars.
 */
export function renderReport(report: FinalReport): string {
  const lines: string[] = [];
  const width = 60;

  lines.push("");
  lines.push(chalk.bold("═".repeat(width)));
  lines.push(
    chalk.bold.white("  🔦 Beacon — AI Readiness Report")
  );
  lines.push(chalk.bold("═".repeat(width)));
  lines.push("");

  // Overall score
  const scoreColor = getScoreColor(report.overallScore, 100);
  lines.push(
    `  Overall Score:  ${scoreColor(
      `${report.overallScore}/100`
    )}  Grade: ${scoreColor(report.grade)}`
  );
  lines.push("");
  lines.push(chalk.dim(`  ${report.executiveSummary}`));
  lines.push("");
  lines.push(chalk.bold("─".repeat(width)));

  // Per-dimension scores
  lines.push("");
  lines.push(chalk.bold.white("  Dimension Scores"));
  lines.push("");

  for (const dim of report.dimensions) {
    lines.push(renderDimensionLine(dim));
  }

  lines.push("");
  lines.push(chalk.bold("─".repeat(width)));

  // Top suggestions
  if (report.topSuggestions.length > 0) {
    lines.push("");
    lines.push(chalk.bold.white("  Top Suggestions"));
    lines.push("");

    for (const suggestion of report.topSuggestions.slice(0, 5)) {
      const impactBadge =
        suggestion.impact === "high"
          ? chalk.red("HIGH")
          : suggestion.impact === "medium"
            ? chalk.yellow("MED")
            : chalk.dim("LOW");
      const effortBadge = chalk.dim(`[${suggestion.effort}]`);
      const dimLabel = chalk.dim(
        `(${DIMENSION_LABELS[suggestion.dimension]})`
      );

      lines.push(
        `  ${chalk.white(`${suggestion.rank}.`)} ${impactBadge} ${effortBadge} ${suggestion.description}`
      );
      lines.push(`     ${dimLabel}`);

      if (suggestion.example) {
        lines.push(`     ${chalk.dim(`→ ${suggestion.example}`)}`);
      }
      lines.push("");
    }
  }

  // Detailed findings
  lines.push(chalk.bold("─".repeat(width)));
  lines.push("");
  lines.push(chalk.bold.white("  Detailed Findings"));
  lines.push("");

  for (const dim of report.dimensions) {
    if (dim.findings.length === 0) continue;

    lines.push(
      `  ${chalk.bold(DIMENSION_LABELS[dim.dimension])} ${chalk.dim(`(${dim.score}/10)`)}`
    );

    for (const finding of dim.findings) {
      const icon =
        finding.severity === "error"
          ? chalk.red("✗")
          : finding.severity === "warning"
            ? chalk.yellow("⚠")
            : chalk.green("✓");
      const fileRef = finding.file ? chalk.dim(` [${finding.file}]`) : "";
      lines.push(`    ${icon} ${finding.message}${fileRef}`);
    }
    lines.push("");
  }

  // Footer
  lines.push(chalk.bold("═".repeat(width)));
  lines.push(
    chalk.dim(
      `  Analyzed ${report.meta.totalFilesAnalyzed} files in ${(report.meta.analysisDurationMs / 1000).toFixed(1)}s`
    )
  );
  lines.push(
    chalk.dim(
      `  Languages: ${report.meta.languages.join(", ") || "unknown"}`
    )
  );
  lines.push(chalk.bold("═".repeat(width)));
  lines.push("");

  return lines.join("\n");
}

function renderDimensionLine(dim: DimensionReport): string {
  const label = DIMENSION_LABELS[dim.dimension].padEnd(28);
  const bar = renderBar(dim.score, 10);
  const scoreStr = `${dim.score}/10`;
  const color = getScoreColor(dim.score, 10);

  return `  ${label} ${bar}  ${color(scoreStr)}`;
}

function renderBar(score: number, max: number): string {
  const filled = Math.round((score / max) * 10);
  const empty = 10 - filled;
  const color = getScoreColor(score, max);

  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

function getScoreColor(score: number, max: number): (text: string) => string {
  const ratio = score / max;
  if (ratio >= 0.8) return chalk.green;
  if (ratio >= 0.6) return chalk.yellow;
  if (ratio >= 0.4) return chalk.hex("#FFA500"); // orange
  return chalk.red;
}

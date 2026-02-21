import chalk from "chalk";
import { DIMENSION_LABELS } from "../core/config.js";
import type { DimensionReport, FinalReport, WorkerMeta } from "../core/schemas.js";

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

/**
 * Render the final report as a Markdown string.
 */
export function renderReportMarkdown(
  report: FinalReport,
  workerMeta: Map<string, WorkerMeta>
): string {
  const lines: string[] = [];
  const date = new Date(report.meta.analyzedAt).toLocaleString();

  lines.push("# 🔦 Beacon — AI Readiness Report");
  lines.push("");
  lines.push(`**Overall Score:** ${report.overallScore}/100  |  **Grade:** ${report.grade}`);
  lines.push("");
  lines.push(`> ${report.executiveSummary}`);
  lines.push("");

  lines.push("## Dimension Scores");
  lines.push("");
  lines.push("| Dimension | Score | Summary |");
  lines.push("| --- | --- | --- |");
  for (const dim of report.dimensions) {
    const bar = scoreBar(dim.score);
    lines.push(`| ${DIMENSION_LABELS[dim.dimension]} | ${bar} ${dim.score}/10 | ${dim.summary} |`);
  }
  lines.push("");

  if (report.topSuggestions.length > 0) {
    lines.push("## Top Suggestions");
    lines.push("");
    for (const s of report.topSuggestions) {
      const impact = s.impact.toUpperCase();
      lines.push(`**${s.rank}. [${impact}] [${s.effort}]** ${s.description}  `);
      lines.push(`*${DIMENSION_LABELS[s.dimension]}*`);
      if (s.example) lines.push(`> ${s.example}`);
      lines.push("");
    }
  }

  lines.push("## Detailed Findings");
  lines.push("");
  for (const dim of report.dimensions) {
    if (dim.findings.length === 0) continue;
    lines.push(`### ${DIMENSION_LABELS[dim.dimension]} (${dim.score}/10)`);
    lines.push("");
    for (const f of dim.findings) {
      const icon = f.severity === "error" ? "❌" : f.severity === "warning" ? "⚠️" : "✅";
      const fileRef = f.file ? ` \`${f.file}\`` : "";
      lines.push(`- ${icon} ${f.message}${fileRef}`);
    }
    lines.push("");
  }

  if (workerMeta.size > 0) {
    lines.push("## Token Usage");
    lines.push("");
    lines.push("| Dimension | Input | Output | Cache Read |");
    lines.push("| --- | ---: | ---: | ---: |");
    let totalIn = 0, totalOut = 0, totalCache = 0, totalCost = 0;
    for (const dim of report.dimensions) {
      const m = workerMeta.get(dim.dimension);
      if (!m) continue;
      totalIn += m.inputTokens;
      totalOut += m.outputTokens;
      totalCache += m.cacheReadTokens;
      totalCost += m.costUsd;
      lines.push(`| ${DIMENSION_LABELS[dim.dimension]} | ${m.inputTokens.toLocaleString("en-US")} | ${m.outputTokens.toLocaleString("en-US")} | ${m.cacheReadTokens.toLocaleString("en-US")} |`);
    }
    lines.push(`| **Total** | **${totalIn.toLocaleString("en-US")}** | **${totalOut.toLocaleString("en-US")}** | **${totalCache.toLocaleString("en-US")}** |`);
    lines.push("");
    lines.push(`**Total cost:** $${totalCost.toFixed(4)}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`*Analyzed ${report.meta.totalFilesAnalyzed} files · ${report.meta.languages.join(", ") || "unknown"} · ${(report.meta.analysisDurationMs / 1000).toFixed(1)}s · ${date}*`);

  return lines.join("\n");
}

function scoreBar(score: number): string {
  const filled = Math.round(score);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

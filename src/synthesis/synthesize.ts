import type {
  DimensionReport,
  FinalReport,
  PrioritizedSuggestion,
  ProjectManifest,
  WorkerOutput,
} from "../core/schemas.js";

/**
 * Synthesize individual worker outputs into a coherent final report.
 * This is deterministic — no LLM call needed.
 */
export function synthesizeReport(
  manifest: ProjectManifest,
  workerOutputs: WorkerOutput[],
  durationMs: number
): FinalReport {
  // Build dimension reports
  const dimensions: DimensionReport[] = workerOutputs.map((output) => ({
    dimension: output.dimension,
    score: output.score,
    maxScore: output.maxScore,
    summary: output.summary,
    findings: output.findings,
    suggestions: output.suggestions,
  }));

  // Calculate overall score (each dimension is equally weighted, out of 100)
  const totalScore = workerOutputs.reduce((sum, o) => sum + o.score, 0);
  const maxPossible = workerOutputs.length * 10;
  const overallScore = Math.round((totalScore / maxPossible) * 100);

  // Assign letter grade
  const grade = getGrade(overallScore);

  // Collect and rank all suggestions across dimensions
  const topSuggestions = rankSuggestions(workerOutputs);

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(
    overallScore,
    grade,
    dimensions,
    manifest
  );

  return {
    overallScore,
    grade,
    executiveSummary,
    dimensions,
    topSuggestions,
    meta: {
      analyzedAt: new Date().toISOString(),
      projectRoot: manifest.rootDir,
      languages: manifest.languages,
      totalFilesAnalyzed: manifest.stats.totalFiles,
      analysisDurationMs: durationMs,
    },
  };
}

function getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Rank suggestions by impact-to-effort ratio.
 * High impact + low effort → highest priority.
 */
function rankSuggestions(outputs: WorkerOutput[]): PrioritizedSuggestion[] {
  const impactScore = { high: 3, medium: 2, low: 1 };
  const effortScore = { trivial: 4, small: 3, medium: 2, large: 1 };

  const allSuggestions: PrioritizedSuggestion[] = outputs.flatMap((output) =>
    output.suggestions.map((s) => ({
      rank: 0, // will be assigned after sorting
      dimension: output.dimension,
      impact: s.impact,
      effort: s.effort,
      description: s.description,
      example: s.example,
    }))
  );

  // Sort by impact/effort ratio (descending)
  allSuggestions.sort((a, b) => {
    const ratioA = impactScore[a.impact] * effortScore[a.effort];
    const ratioB = impactScore[b.impact] * effortScore[b.effort];
    return ratioB - ratioA;
  });

  // Assign ranks and take top 10
  return allSuggestions.slice(0, 10).map((s, i) => ({ ...s, rank: i + 1 }));
}

function generateExecutiveSummary(
  score: number,
  grade: string,
  dimensions: DimensionReport[],
  manifest: ProjectManifest
): string {
  const langStr = manifest.languages.join(", ") || "unknown language";
  const weakest = [...dimensions].sort((a, b) => a.score - b.score);
  const strongest = [...dimensions].sort((a, b) => b.score - a.score);

  const weakDims = weakest
    .slice(0, 2)
    .filter((d) => d.score < 5)
    .map((d) => d.dimension);
  const strongDims = strongest
    .slice(0, 2)
    .filter((d) => d.score >= 7)
    .map((d) => d.dimension);

  let summary = `This ${langStr} project scores ${score}/100 (Grade: ${grade}) for AI agent readiness.`;

  if (strongDims.length > 0) {
    summary += ` Strengths include ${strongDims.join(" and ")}.`;
  }

  if (weakDims.length > 0) {
    summary += ` Key areas for improvement: ${weakDims.join(" and ")}.`;
  }

  if (score < 40) {
    summary +=
      " Significant investment in project structure and documentation is recommended before relying on AI coding agents.";
  } else if (score < 70) {
    summary +=
      " With targeted improvements in the weakest dimensions, this project could see meaningful gains in AI agent effectiveness.";
  } else {
    summary +=
      " This project is well-positioned for effective AI agent collaboration.";
  }

  return summary;
}

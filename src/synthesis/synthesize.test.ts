import { describe, expect, it } from "vitest";
import { synthesizeReport } from "./synthesize.js";
import type { Dimension, ProjectManifest, WorkerOutput } from "../core/schemas.js";

const MOCK_MANIFEST: ProjectManifest = {
  rootDir: "/tmp/test-project",
  languages: ["TypeScript"],
  frameworks: [],
  packageManager: null,
  files: [],
  stats: {
    totalFiles: 10,
    sourceFiles: 8,
    testFiles: 1,
    docFiles: 1,
    configFiles: 2,
    ciFiles: 0,
    agentRulesFiles: 0,
  },
};

function makeOutput(dimension: Dimension, score: number): WorkerOutput {
  return {
    dimension,
    score,
    maxScore: 10,
    summary: `${dimension} summary`,
    findings: [],
    suggestions: [],
  };
}

describe("synthesizeReport", () => {
  it("calculates overall score as percentage of max", () => {
    const outputs = [makeOutput("documentation", 7), makeOutput("consistency", 3)];
    const report = synthesizeReport(MOCK_MANIFEST, outputs, 1000);
    // (7 + 3) / (2 * 10) * 100 = 50
    expect(report.overallScore).toBe(50);
  });

  it("assigns correct letter grades", () => {
    const cases: [number, string][] = [
      [10, "A"],
      [8, "B"],
      [6, "C"],
      [4, "D"],
      [2, "F"],
    ];
    for (const [score, expectedGrade] of cases) {
      const outputs = [makeOutput("documentation", score)];
      const report = synthesizeReport(MOCK_MANIFEST, outputs, 0);
      expect(report.grade).toBe(expectedGrade);
    }
  });

  it("clamps score to 0 when all dimensions score 0", () => {
    const outputs = [makeOutput("ci-cd", 0), makeOutput("modularity", 0)];
    const report = synthesizeReport(MOCK_MANIFEST, outputs, 0);
    expect(report.overallScore).toBe(0);
    expect(report.grade).toBe("F");
  });

  it("includes all dimension reports in output", () => {
    const outputs = [makeOutput("security-hygiene", 8), makeOutput("ci-cd", 5)];
    const report = synthesizeReport(MOCK_MANIFEST, outputs, 500);
    expect(report.dimensions).toHaveLength(2);
    expect(report.dimensions[0].dimension).toBe("security-hygiene");
    expect(report.dimensions[1].dimension).toBe("ci-cd");
  });
});

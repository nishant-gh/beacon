import { z } from "zod";

// ─────────────────────────────────────────────
// Enums & Primitives
// ─────────────────────────────────────────────

export const Severity = z.enum(["error", "warning", "info"]);
export type Severity = z.infer<typeof Severity>;

export const Impact = z.enum(["high", "medium", "low"]);
export type Impact = z.infer<typeof Impact>;

export const Effort = z.enum(["trivial", "small", "medium", "large"]);
export type Effort = z.infer<typeof Effort>;

export const Dimension = z.enum([
  "documentation",
  "rules-and-policies",
  "type-safety",
  "test-infrastructure",
  "modularity",
  "ci-cd",
  "consistency",
  "security-hygiene",
]);
export type Dimension = z.infer<typeof Dimension>;

// ─────────────────────────────────────────────
// Discovery Phase: Project Manifest
// ─────────────────────────────────────────────

export const FileClassification = z.enum([
  "source",
  "test",
  "config",
  "documentation",
  "ci",
  "build",
  "asset",
  "dependency-manifest",
  "agent-rules",
  "unknown",
]);
export type FileClassification = z.infer<typeof FileClassification>;

export const ClassifiedFile = z.object({
  path: z.string(),
  classification: FileClassification,
  sizeBytes: z.number(),
  extension: z.string(),
});
export type ClassifiedFile = z.infer<typeof ClassifiedFile>;

export const ProjectManifest = z.object({
  /** Absolute path to the project root */
  rootDir: z.string(),

  /** Detected primary language(s) */
  languages: z.array(z.string()),

  /** Detected framework(s), e.g. "next.js", "express", "django" */
  frameworks: z.array(z.string()),

  /** Package manager: npm, yarn, pnpm, pip, cargo, etc. */
  packageManager: z.string().nullable(),

  /** All classified files in the project */
  files: z.array(ClassifiedFile),

  /** Quick stats derived during discovery */
  stats: z.object({
    totalFiles: z.number(),
    sourceFiles: z.number(),
    testFiles: z.number(),
    docFiles: z.number(),
    configFiles: z.number(),
    ciFiles: z.number(),
    agentRulesFiles: z.number(),
  }),
});
export type ProjectManifest = z.infer<typeof ProjectManifest>;

// ─────────────────────────────────────────────
// Worker Input / Output Contracts
// ─────────────────────────────────────────────

export const WorkerInput = z.object({
  /** The project manifest from discovery */
  manifest: ProjectManifest,

  /** Which dimension this worker is evaluating */
  dimension: Dimension,
});
export type WorkerInput = z.infer<typeof WorkerInput>;

export const Finding = z.object({
  severity: Severity,
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
  evidence: z.string().optional(),
});
export type Finding = z.infer<typeof Finding>;

export const Suggestion = z.object({
  impact: Impact,
  effort: Effort,
  description: z.string(),
  /** Concrete example or action the user can take */
  example: z.string().optional(),
});
export type Suggestion = z.infer<typeof Suggestion>;

export const WorkerOutput = z.object({
  dimension: Dimension,
  score: z.number().min(0).max(10),
  maxScore: z.literal(10),
  summary: z.string(),
  findings: z.array(Finding),
  suggestions: z.array(Suggestion),
});
export type WorkerOutput = z.infer<typeof WorkerOutput>;

export const WORKER_OUTPUT_JSON_SCHEMA = {
  type: "object",
  required: ["dimension", "score", "maxScore", "summary", "findings", "suggestions"],
  properties: {
    dimension: { type: "string" },
    score: { type: "number" },
    maxScore: { type: "number" },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["severity", "message"],
        properties: {
          severity: { type: "string", enum: ["error", "warning", "info"] },
          message: { type: "string" },
          file: { type: "string" },
          line: { type: "number" },
          evidence: { type: "string" },
        },
      },
    },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        required: ["impact", "effort", "description"],
        properties: {
          impact: { type: "string", enum: ["high", "medium", "low"] },
          effort: { type: "string", enum: ["trivial", "small", "medium", "large"] },
          description: { type: "string" },
          example: { type: "string" },
        },
      },
    },
  },
} as const;

// ─────────────────────────────────────────────
// Synthesis Phase: Final Report
// ─────────────────────────────────────────────

export const DimensionReport = z.object({
  dimension: Dimension,
  score: z.number().min(0).max(10),
  maxScore: z.literal(10),
  summary: z.string(),
  findings: z.array(Finding),
  suggestions: z.array(Suggestion),
});
export type DimensionReport = z.infer<typeof DimensionReport>;

export const PrioritizedSuggestion = z.object({
  rank: z.number(),
  dimension: Dimension,
  impact: Impact,
  effort: Effort,
  description: z.string(),
  example: z.string().optional(),
});
export type PrioritizedSuggestion = z.infer<typeof PrioritizedSuggestion>;

export const FinalReport = z.object({
  /** Overall score out of 100 */
  overallScore: z.number().min(0).max(100),

  /** Letter grade: A, B, C, D, F */
  grade: z.enum(["A", "B", "C", "D", "F"]),

  /** One-paragraph executive summary */
  executiveSummary: z.string(),

  /** Per-dimension breakdowns */
  dimensions: z.array(DimensionReport),

  /** Top suggestions, ranked by impact/effort ratio */
  topSuggestions: z.array(PrioritizedSuggestion),

  /** Metadata */
  meta: z.object({
    analyzedAt: z.string().datetime(),
    projectRoot: z.string(),
    languages: z.array(z.string()),
    totalFilesAnalyzed: z.number(),
    analysisDurationMs: z.number(),
  }),
});
export type FinalReport = z.infer<typeof FinalReport>;

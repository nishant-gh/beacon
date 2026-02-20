import { discoverProject } from "../discovery/discover.js";
import { synthesizeReport } from "../synthesis/synthesize.js";
import { BaseWorker } from "../workers/base-worker.js";
import { WORKER_CONFIGS } from "../workers/worker-configs.js";
import { ALL_DIMENSIONS } from "./config.js";
import type {
  Dimension,
  FinalReport,
  ProjectManifest,
  WorkerOutput,
} from "./schemas.js";

export interface AnalysisCallbacks {
  onDiscoveryStart?: () => void;
  onDiscoveryComplete?: (manifest: ProjectManifest) => void;
  onWorkerStart?: (dimension: Dimension) => void;
  onWorkerComplete?: (dimension: Dimension, output: WorkerOutput) => void;
  onWorkerError?: (dimension: Dimension, error: Error) => void;
  onSynthesisStart?: () => void;
  onSynthesisComplete?: (report: FinalReport) => void;
}

export interface AnalysisOptions {
  /** Absolute or relative path to the project */
  projectPath: string;
  /** Specific dimensions to analyze (defaults to all) */
  dimensions?: Dimension[];
  /** Progress callbacks */
  callbacks?: AnalysisCallbacks;
}

/**
 * Main orchestrator: runs the full analysis pipeline.
 *
 *   1. Discovery  → ProjectManifest
 *   2. Parallel Workers → WorkerOutput[]
 *   3. Synthesis → FinalReport
 */
export async function analyzeProject(
  options: AnalysisOptions
): Promise<FinalReport> {
  const startTime = Date.now();
  const { projectPath, callbacks } = options;
  const dimensions = options.dimensions ?? ALL_DIMENSIONS;

  // ── 1. Discovery Phase ──────────────────────────────
  callbacks?.onDiscoveryStart?.();
  const manifest = await discoverProject(projectPath);
  callbacks?.onDiscoveryComplete?.(manifest);

  // ── 2. Parallel Worker Phase ────────────────────────
  const workerPromises = dimensions.map(async (dimension) => {
    callbacks?.onWorkerStart?.(dimension);

    try {
      const config = WORKER_CONFIGS.find((w) => w.dimension === dimension);
      if (!config) {
        throw new Error(`No worker config for dimension: ${dimension}`);
      }

      const worker = new BaseWorker(config);
      const output = await worker.analyze({ manifest, dimension });

      callbacks?.onWorkerComplete?.(dimension, output);
      return output;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error));
      callbacks?.onWorkerError?.(dimension, err);

      const failureOutput: WorkerOutput = {
        dimension,
        score: 0,
        maxScore: 10,
        summary: `Analysis failed: ${err.message}`,
        findings: [
          {
            severity: "error",
            message: `Worker failed: ${err.message}`,
          },
        ],
        suggestions: [],
      };
      return failureOutput;
    }
  });

  // Run all workers in parallel
  const workerOutputs = await Promise.all(workerPromises);

  // ── 3. Synthesis Phase ──────────────────────────────
  callbacks?.onSynthesisStart?.();
  const durationMs = Date.now() - startTime;

  const report = synthesizeReport(manifest, workerOutputs, durationMs);
  callbacks?.onSynthesisComplete?.(report);

  return report;
}

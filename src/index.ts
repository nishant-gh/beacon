export { ALL_DIMENSIONS, DIMENSION_LABELS } from "./core/config.js";
export { analyzeProject } from "./core/orchestrator.js";
export type { AnalysisCallbacks, AnalysisOptions } from "./core/orchestrator.js";
export {
  type Dimension,
  type FinalReport,
  type Finding,
  type ProjectManifest,
  type Suggestion,
  type WorkerOutput,
} from "./core/schemas.js";
export { discoverProject } from "./discovery/discover.js";
export { synthesizeReport } from "./synthesis/synthesize.js";

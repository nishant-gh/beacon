import fs from "node:fs/promises";
import path from "node:path";
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_WORKER } from "../core/config.js";
import type { ClassifiedFile, Dimension, ProjectManifest } from "../core/schemas.js";

/**
 * File routing rules per dimension.
 * Each dimension gets only the files it needs for analysis.
 */
const ROUTING_RULES: Record<Dimension, (file: ClassifiedFile) => boolean> = {
  documentation: (f) =>
    f.classification === "documentation" ||
    f.classification === "agent-rules" ||
    /readme|contributing|architecture|changelog|adr/i.test(f.path),

  "rules-and-policies": (f) =>
    f.classification === "agent-rules" ||
    f.classification === "config" ||
    /\.editorconfig|\.prettierrc|\.eslintrc|eslint\.config|biome/i.test(f.path),

  "type-safety": (f) =>
    f.classification === "source" ||
    /tsconfig|pyproject\.toml|\.mypy/i.test(f.path),

  "test-infrastructure": (f) =>
    f.classification === "test" ||
    /jest\.config|vitest\.config|pytest|\.nycrc|codecov|coverage/i.test(f.path) ||
    f.path === "package.json",

  modularity: (f) =>
    f.classification === "source" || f.classification === "config",

  "ci-cd": (f) =>
    f.classification === "ci" ||
    /Dockerfile|docker-compose|\.dockerignore|Makefile|Procfile/i.test(f.path),

  consistency: (f) =>
    f.classification === "source" || f.classification === "config",

  "security-hygiene": (f) =>
    f.classification === "config" ||
    f.classification === "source" ||
    /\.env|\.gitignore|secret|auth|security/i.test(f.path),
};

/**
 * Select and read the files relevant to a given dimension.
 * Returns a map of relative-path → file-content.
 */
export async function routeFilesForDimension(
  manifest: ProjectManifest,
  dimension: Dimension
): Promise<Record<string, string>> {
  const filter = ROUTING_RULES[dimension];

  // Filter files by routing rules and size
  let candidates = manifest.files
    .filter((f) => filter(f) && f.sizeBytes <= MAX_FILE_SIZE_BYTES)
    .sort((a, b) => {
      // Prioritize config & docs (small, high-signal) over large source files
      const priority: Record<string, number> = {
        "agent-rules": 0,
        config: 1,
        documentation: 2,
        ci: 3,
        test: 4,
        "dependency-manifest": 5,
        source: 6,
        build: 7,
        asset: 8,
        unknown: 9,
      };
      return (
        (priority[a.classification] ?? 99) -
        (priority[b.classification] ?? 99)
      );
    });

  // Cap to prevent context overflow
  if (candidates.length > MAX_FILES_PER_WORKER) {
    candidates = candidates.slice(0, MAX_FILES_PER_WORKER);
  }

  // Read file contents in parallel
  const entries = await Promise.all(
    candidates.map(async (file) => {
      try {
        const content = await fs.readFile(
          path.join(manifest.rootDir, file.path),
          "utf-8"
        );
        return [file.path, content] as const;
      } catch {
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter(Boolean) as [string, string][]);
}

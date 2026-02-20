import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { FILE_PATTERNS, IGNORE_DIRS } from "../core/config.js";
import {
  type ClassifiedFile,
  type FileClassification,
  type ProjectManifest,
} from "../core/schemas.js";

/**
 * Discovery phase: scans the project root and produces a ProjectManifest.
 * This is fast, deterministic, and does not use an LLM.
 */
export async function discoverProject(
  rootDir: string
): Promise<ProjectManifest> {
  const absoluteRoot = path.resolve(rootDir);

  // Find all files, excluding ignored directories
  const allFiles = await fg("**/*", {
    cwd: absoluteRoot,
    dot: true,
    ignore: IGNORE_DIRS.map((d) => `**/${d}/**`),
    onlyFiles: true,
    stats: true,
  });

  // Classify each file
  const classifiedFiles: ClassifiedFile[] = await Promise.all(
    allFiles.map(async (entry) => {
      const filePath = typeof entry === "string" ? entry : entry.path;
      const stats =
        typeof entry === "string"
          ? await fs.stat(path.join(absoluteRoot, filePath))
          : entry.stats!;

      return {
        path: filePath,
        classification: classifyFile(filePath),
        sizeBytes: stats.size,
        extension: path.extname(filePath),
      };
    })
  );

  // Detect languages and frameworks
  const languages = detectLanguages(classifiedFiles);
  const frameworks = await detectFrameworks(absoluteRoot, classifiedFiles);
  const packageManager = detectPackageManager(classifiedFiles);

  // Compute stats
  const stats = {
    totalFiles: classifiedFiles.length,
    sourceFiles: classifiedFiles.filter((f) => f.classification === "source")
      .length,
    testFiles: classifiedFiles.filter((f) => f.classification === "test")
      .length,
    docFiles: classifiedFiles.filter(
      (f) => f.classification === "documentation"
    ).length,
    configFiles: classifiedFiles.filter((f) => f.classification === "config")
      .length,
    ciFiles: classifiedFiles.filter((f) => f.classification === "ci").length,
    agentRulesFiles: classifiedFiles.filter(
      (f) => f.classification === "agent-rules"
    ).length,
  };

  return {
    rootDir: absoluteRoot,
    languages,
    frameworks,
    packageManager,
    files: classifiedFiles,
    stats,
  };
}

// ─────────────────────────────────────────────
// File Classification
// ─────────────────────────────────────────────

function classifyFile(filePath: string): FileClassification {
  const basename = path.basename(filePath);

  // Check agent rules first (most specific)
  if (FILE_PATTERNS.agentRules.some((p) => matchPattern(filePath, p))) {
    return "agent-rules";
  }

  // CI files
  if (FILE_PATTERNS.ci.some((p) => matchPattern(filePath, p))) {
    return "ci";
  }

  // Test files
  if (FILE_PATTERNS.test.some((p) => matchPattern(filePath, p))) {
    return "test";
  }

  // Documentation
  if (FILE_PATTERNS.documentation.some((p) => matchPattern(filePath, p))) {
    return "documentation";
  }

  // Dependency manifests (before config, since package.json is both)
  if (
    FILE_PATTERNS.dependencyManifest.some((p) => matchPattern(filePath, p))
  ) {
    return "dependency-manifest";
  }

  // Config files
  if (FILE_PATTERNS.config.some((p) => matchPattern(filePath, p))) {
    return "config";
  }

  // Build outputs (heuristic)
  if (/\.(map|min\.js|min\.css|bundle\.)/.test(basename)) {
    return "build";
  }

  // Assets
  if (
    /\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|mp[34]|webm|webp)$/.test(
      basename
    )
  ) {
    return "asset";
  }

  // Source files
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|rb|php|swift|kt|scala|c|cpp|h|hpp|cs|vue|svelte)$/.test(
      basename
    )
  ) {
    return "source";
  }

  return "unknown";
}

/**
 * Simple glob-style pattern matcher.
 * Supports ** for directory wildcard and * for filename wildcard.
 */
function matchPattern(filePath: string, pattern: string): boolean {
  const basename = path.basename(filePath);

  // Exact basename match (e.g., "CLAUDE.md")
  if (!pattern.includes("/") && !pattern.includes("*")) {
    return basename === pattern;
  }

  // Convert glob to regex
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");

  return new RegExp(`(^|/)${regexStr}$`).test(filePath);
}

// ─────────────────────────────────────────────
// Language & Framework Detection
// ─────────────────────────────────────────────

function detectLanguages(files: ClassifiedFile[]): string[] {
  const extCounts: Record<string, number> = {};
  for (const file of files) {
    if (file.classification === "source") {
      const ext = file.extension.toLowerCase();
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }
  }

  const extToLang: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".rs": "Rust",
    ".go": "Go",
    ".java": "Java",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".cs": "C#",
    ".c": "C",
    ".cpp": "C++",
    ".vue": "Vue",
    ".svelte": "Svelte",
  };

  const languages = new Set<string>();
  for (const [ext, count] of Object.entries(extCounts)) {
    if (count > 0 && extToLang[ext]) {
      languages.add(extToLang[ext]);
    }
  }

  return Array.from(languages);
}

async function detectFrameworks(
  rootDir: string,
  files: ClassifiedFile[]
): Promise<string[]> {
  const frameworks: string[] = [];
  const fileNames = new Set(files.map((f) => f.path));

  // Check package.json for JS/TS frameworks
  if (
    fileNames.has("package.json")
  ) {
    try {
      const pkgContent = await fs.readFile(
        path.join(rootDir, "package.json"),
        "utf-8"
      );
      const pkg = JSON.parse(pkgContent);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps["next"]) frameworks.push("Next.js");
      if (allDeps["react"] && !allDeps["next"]) frameworks.push("React");
      if (allDeps["vue"]) frameworks.push("Vue");
      if (allDeps["@angular/core"]) frameworks.push("Angular");
      if (allDeps["svelte"]) frameworks.push("Svelte");
      if (allDeps["express"]) frameworks.push("Express");
      if (allDeps["fastify"]) frameworks.push("Fastify");
      if (allDeps["nestjs"] || allDeps["@nestjs/core"]) frameworks.push("NestJS");
      if (allDeps["hono"]) frameworks.push("Hono");
    } catch {
      // ignore parse errors
    }
  }

  // Python frameworks
  if (fileNames.has("pyproject.toml") || fileNames.has("requirements.txt")) {
    const tomlFile = fileNames.has("pyproject.toml") ? "pyproject.toml" : null;
    const reqFile = fileNames.has("requirements.txt") ? "requirements.txt" : null;

    for (const f of [tomlFile, reqFile].filter(Boolean)) {
      try {
        const content = await fs.readFile(path.join(rootDir, f!), "utf-8");
        if (/django/i.test(content)) frameworks.push("Django");
        if (/fastapi/i.test(content)) frameworks.push("FastAPI");
        if (/flask/i.test(content)) frameworks.push("Flask");
      } catch {
        // ignore
      }
    }
  }

  return [...new Set(frameworks)];
}

function detectPackageManager(files: ClassifiedFile[]): string | null {
  const fileNames = new Set(files.map((f) => path.basename(f.path)));

  if (fileNames.has("pnpm-lock.yaml")) return "pnpm";
  if (fileNames.has("yarn.lock")) return "yarn";
  if (fileNames.has("package-lock.json")) return "npm";
  if (fileNames.has("bun.lockb")) return "bun";
  if (fileNames.has("Pipfile")) return "pipenv";
  if (fileNames.has("poetry.lock")) return "poetry";
  if (fileNames.has("requirements.txt")) return "pip";
  if (fileNames.has("Cargo.lock")) return "cargo";
  if (fileNames.has("go.sum")) return "go modules";

  return null;
}

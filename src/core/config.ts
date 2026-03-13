import type { Dimension } from "./schemas.js";

/** Dimensions to analyze — ordering matters for display */
export const ALL_DIMENSIONS: Dimension[] = [
  "documentation",
  "rules-and-policies",
  "type-safety",
  "test-infrastructure",
  "modularity",
  "ci-cd",
  "consistency",
  "security-hygiene",
];

/** Human-readable labels for each dimension */
export const DIMENSION_LABELS: Record<Dimension, string> = {
  documentation: "Documentation & Context",
  "rules-and-policies": "Rules & Policy Files",
  "type-safety": "Type Safety & Schemas",
  "test-infrastructure": "Test Infrastructure",
  modularity: "Modularity & Boundaries",
  "ci-cd": "CI/CD & Automated Checks",
  consistency: "Consistency & Conventions",
  "security-hygiene": "Security Hygiene",
};

/** File patterns used during discovery to classify files */
export const FILE_PATTERNS = {
  agentRules: [
    "CLAUDE.md",
    ".cursorrules",
    ".cursorignore",
    "AGENTS.md",
    ".github/copilot-instructions.md",
    "copilot-instructions.md",
    ".windsurfrules",
    "rules.md",
    "CONVENTIONS.md",
  ],
  documentation: [
    "README.md",
    "README.rst",
    "CONTRIBUTING.md",
    "ARCHITECTURE.md",
    "CHANGELOG.md",
    "docs/**",
    "adr/**",
    "doc/**",
  ],
  ci: [
    ".github/workflows/**",
    ".gitlab-ci.yml",
    "Jenkinsfile",
    ".circleci/**",
    ".travis.yml",
    "bitbucket-pipelines.yml",
    ".buildkite/**",
  ],
  test: [
    "**/*.test.*",
    "**/*.spec.*",
    "**/__tests__/**",
    "**/test/**",
    "**/tests/**",
    "**/*.test-d.ts",
  ],
  config: [
    "tsconfig.json",
    "tsconfig.*.json",
    ".eslintrc*",
    "eslint.config.*",
    ".prettierrc*",
    "prettier.config.*",
    "biome.json",
    "biome.jsonc",
    ".editorconfig",
    "jest.config.*",
    "vitest.config.*",
    "webpack.config.*",
    "vite.config.*",
    "next.config.*",
    "package.json",
    "pyproject.toml",
    "setup.cfg",
    "Cargo.toml",
    "go.mod",
  ],
  dependencyManifest: [
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "requirements.txt",
    "Pipfile",
    "poetry.lock",
    "Cargo.lock",
    "go.sum",
    "Gemfile.lock",
  ],
} as const;

/** Directories to always ignore during scanning */
export const IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  "vendor",
  ".turbo",
  "coverage",
  ".cache",
];

/** Maximum file size (in bytes) to read into context for LLM workers */
export const MAX_FILE_SIZE_BYTES = 50_000; // ~50KB

/** Maximum number of files to send to a single worker */
export const MAX_FILES_PER_WORKER = 60;

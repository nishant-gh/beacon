# ai-readiness-check

A Lighthouse-style CLI tool that evaluates how well your codebase is set up for AI coding agents (Claude, Cursor, Copilot, etc).

## What It Does

Scans your project and scores it across 8 dimensions of AI readiness:

| Dimension | What It Measures |
|---|---|
| **Documentation & Context** | README quality, architecture docs, inline comments |
| **Rules & Policy Files** | Agent instruction files, linter/formatter configs |
| **Type Safety & Schemas** | Type coverage, strict mode, schema definitions |
| **Test Infrastructure** | Test coverage, framework setup, speed |
| **Modularity & Boundaries** | Directory structure, separation of concerns, coupling |
| **CI/CD & Automated Checks** | Pipeline existence, security scanning, build verification |
| **Consistency & Conventions** | Naming conventions, code patterns, formatting |
| **Security Hygiene** | Secret management, dependency security, input validation |

Each dimension is analyzed by a specialized AI agent in parallel, producing a score out of 10 plus specific findings and suggestions.

## Install

```bash
npm install -g ai-readiness-check
```

## Usage

```bash
# Analyze current directory
ai-readiness-check

# Analyze a specific project
ai-readiness-check ./my-project

# Output raw JSON
ai-readiness-check --json

# Save report to file
ai-readiness-check -o report.json

# Analyze specific dimensions only
ai-readiness-check -d documentation,type-safety,test-infrastructure
```

Requires an Anthropic API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Architecture

```
Discovery Phase (deterministic)
   │
   ├── Scan filesystem
   ├── Classify files
   ├── Detect languages/frameworks
   └── Produce ProjectManifest
          │
          ▼
Parallel Worker Phase (LLM-powered)
   │
   ├── Documentation Worker  ──┐
   ├── Rules Worker           │
   ├── Type Safety Worker     ├── Each gets only relevant files
   ├── Test Worker            │   from the file router
   ├── Modularity Worker      │
   ├── CI/CD Worker           │
   ├── Consistency Worker     │
   └── Security Worker  ──────┘
          │
          ▼
Synthesis Phase (deterministic)
   │
   ├── Aggregate scores
   ├── Rank suggestions by impact/effort
   ├── Generate executive summary
   └── Produce FinalReport
```

## Programmatic API

```typescript
import { analyzeProject } from "ai-readiness-check";

const report = await analyzeProject({
  projectPath: "./my-project",
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

console.log(report.overallScore); // 0-100
console.log(report.grade);        // A, B, C, D, F
```

## Development

```bash
git clone https://github.com/your-org/ai-readiness-check
cd ai-readiness-check
npm install
npm run dev -- ./path-to-project
```

## License

MIT

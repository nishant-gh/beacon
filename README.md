# 🔦 Beacon

Shine a light on your codebase's AI readiness.

Beacon is a Lighthouse-style CLI tool that evaluates how well your project is set up for AI coding agents (Claude, Cursor, Copilot, etc). It scans your codebase, runs parallel AI-powered analysis across 8 dimensions, and produces an actionable readiness score.

## What It Does

```
🔦 Beacon — AI Readiness Report
════════════════════════════════════════════════════════════

  Overall Score:  62/100  Grade: C

  Documentation & Context    ██████░░░░  6/10
  Rules & Policy Files       ██░░░░░░░░  2/10
  Type Safety & Schemas      ████████░░  8/10
  Test Infrastructure        ███████░░░  7/10
  Modularity & Boundaries    ██████░░░░  6/10
  CI/CD & Automated Checks   ████████░░  8/10
  Consistency & Conventions  █████░░░░░  5/10
  Security Hygiene           ████████░░  8/10
```

### Scoring Dimensions

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

Each dimension is analyzed by a specialized AI agent in parallel, producing a score out of 10 plus specific findings and actionable suggestions.

## Install

```bash
npm install -g beacon-ai
```

## Usage

```bash
# Analyze current directory
beacon

# Analyze a specific project
beacon ./my-project

# Output raw JSON
beacon --json

# Save report to file
beacon -o report.json

# Analyze specific dimensions only
beacon -d documentation,type-safety,test-infrastructure
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
import { analyzeProject } from "beacon-ai";

const report = await analyzeProject({
  projectPath: "./my-project",
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

console.log(report.overallScore); // 0-100
console.log(report.grade);        // A, B, C, D, F
```

## Development

```bash
git clone https://github.com/your-org/beacon
cd beacon
npm install
npm run dev -- ./path-to-project
```

## License

MIT

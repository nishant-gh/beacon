import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverProject } from "./discover.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "beacon-discover-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function write(rel: string, content = "") {
  const full = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

describe("discoverProject", () => {
  it("returns a manifest with rootDir set to the resolved path", async () => {
    await write("src/index.ts", "export const x = 1;");
    const manifest = await discoverProject(tmpDir);
    expect(manifest.rootDir).toBe(path.resolve(tmpDir));
  });

  it("classifies TypeScript files as source and detects TypeScript language", async () => {
    await write("src/app.ts", "");
    await write("src/util.tsx", "");
    const manifest = await discoverProject(tmpDir);
    const src = manifest.files.filter((f) => f.classification === "source");
    expect(src.length).toBeGreaterThanOrEqual(2);
    expect(manifest.languages).toContain("TypeScript");
  });

  it("classifies test files correctly", async () => {
    await write("src/app.test.ts", "");
    await write("src/util.spec.ts", "");
    const manifest = await discoverProject(tmpDir);
    const tests = manifest.files.filter((f) => f.classification === "test");
    expect(tests.length).toBe(2);
    expect(manifest.stats.testFiles).toBe(2);
  });

  it("classifies CI files correctly", async () => {
    await write(".github/workflows/ci.yml", "");
    const manifest = await discoverProject(tmpDir);
    const ci = manifest.files.filter((f) => f.classification === "ci");
    expect(ci.length).toBe(1);
    expect(manifest.stats.ciFiles).toBe(1);
  });

  it("classifies agent rules files correctly", async () => {
    await write("CLAUDE.md", "");
    const manifest = await discoverProject(tmpDir);
    expect(manifest.stats.agentRulesFiles).toBe(1);
  });

  it("detects pnpm as package manager", async () => {
    await write("pnpm-lock.yaml", "");
    const manifest = await discoverProject(tmpDir);
    expect(manifest.packageManager).toBe("pnpm");
  });

  it("detects npm as package manager when package-lock.json present", async () => {
    await write("package-lock.json", "{}");
    const manifest = await discoverProject(tmpDir);
    expect(manifest.packageManager).toBe("npm");
  });

  it("detects React framework from package.json dependencies", async () => {
    await write("package.json", JSON.stringify({ dependencies: { react: "^18.0.0" } }));
    const manifest = await discoverProject(tmpDir);
    expect(manifest.frameworks).toContain("React");
  });

  it("detects Next.js and does not double-count React", async () => {
    await write(
      "package.json",
      JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } })
    );
    const manifest = await discoverProject(tmpDir);
    expect(manifest.frameworks).toContain("Next.js");
    expect(manifest.frameworks).not.toContain("React");
  });

  it("handles empty project gracefully", async () => {
    const manifest = await discoverProject(tmpDir);
    expect(manifest.files).toHaveLength(0);
    expect(manifest.languages).toHaveLength(0);
    expect(manifest.packageManager).toBeNull();
  });

  it("computes stats correctly", async () => {
    await write("src/app.ts", "");
    await write("src/app.test.ts", "");
    await write("README.md", "");
    const manifest = await discoverProject(tmpDir);
    expect(manifest.stats.sourceFiles).toBeGreaterThanOrEqual(1);
    expect(manifest.stats.testFiles).toBe(1);
    expect(manifest.stats.docFiles).toBeGreaterThanOrEqual(1);
  });
});

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const invalidRunner = fileURLToPath(
  new URL("./fixtures/crush-build/run-invalid.mjs", import.meta.url),
);
const lifecycleRunner = fileURLToPath(
  new URL("./fixtures/crush-build/run-lifecycle.mjs", import.meta.url),
);

function childEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...overrides,
    FORCE_COLOR: "0",
    NODE_ENV: "production",
    PATH: process.env.PATH,
    TMPDIR: process.env.TMPDIR,
  };
}

function runNode(
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<{ status: number; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [...arguments_],
      { encoding: "utf8", env: environment },
      (error, stdout, stderr) => {
        resolve({
          status: typeof error?.code === "number" ? error.code : 0,
          stderr,
          stdout,
        });
      },
    );
  });
}

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Crush static build boundary", () => {
  it("reports all recovered failures after rendering and exits non-zero", async () => {
    const invalidOutput = await mkdtemp(join(tmpdir(), "crush-invalid-"));
    temporaryDirectories.push(invalidOutput);
    const reportFile = join(invalidOutput, "report.json");
    const result = await runNode(
      [invalidRunner],
      childEnvironment({
        CRUSH_INVALID_OUTPUT: invalidOutput,
        CRUSH_RESULT_FILE: reportFile,
      }),
    );

    expect(result.status).not.toBe(0);
    const report = JSON.parse(await readFile(reportFile, "utf8")) as {
      causePreserved: boolean;
      diagnostics: number;
      message: string;
      origins: Array<{ kind: string; location?: string }>;
      stacksUseful: boolean;
    };
    expect(report.diagnostics).toBe(3);
    expect(report.causePreserved).toBe(true);
    expect(report.stacksUseful).toBe(true);
    expect(report.origins).toEqual([
      { kind: "selection", location: "[0]" },
      { kind: "selection", location: "[1]" },
      { kind: "catch" },
    ]);
    expect(report.message).toContain("3 content diagnostics");
    expect(report.message).toContain("content.invalid-value");
    expect(report.message).toContain("catalog at [0]");
    expect(report.message).toContain("content.rejected-promise");
    expect(report.message).toContain("site at [1]");
    expect(report.message).toContain("fixture site loader failed");
    expect(report.message).toContain("navigation at catch");
    expect(report.message).toContain("fixture navigation loader failed");
    expect(report.message.indexOf("catalog at [0]")).toBeLessThan(
      report.message.indexOf("site at [1]"),
    );
    await expect(
      readFile(join(invalidOutput, "index.html"), "utf8"),
    ).resolves.toContain(
      "Recovered catalog + Recovered site + Recovered navigation",
    );
  });

  it("preserves rejection causes and resets diagnostics between builds in one process", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crush-lifecycle-"));
    temporaryDirectories.push(directory);
    const invalidOutput = join(directory, "invalid");
    const validOutput = join(directory, "valid");
    const reportFile = join(directory, "report.json");
    const result = await runNode(
      [lifecycleRunner],
      childEnvironment({
        CRUSH_INVALID_OUTPUT: invalidOutput,
        CRUSH_RESULT_FILE: reportFile,
        CRUSH_VALID_OUTPUT: validOutput,
      }),
    );

    expect(result.status).toBe(0);
    const report = JSON.parse(await readFile(reportFile, "utf8")) as {
      causePreserved: boolean;
      diagnostics: number;
      stacksUseful: boolean;
      validBuildCompleted: boolean;
    };

    expect(report).toEqual({
      causePreserved: true,
      diagnostics: 3,
      stacksUseful: true,
      validBuildCompleted: true,
    });
  });
});

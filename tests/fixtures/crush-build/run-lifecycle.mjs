import { writeFile } from "node:fs/promises";
import { env } from "node:process";
import { URL } from "node:url";

import { build } from "astro";

const root = new URL("./", import.meta.url);
let invalidFailure;

try {
  await build({
    logLevel: "silent",
    mode: "invalid",
    outDir: env.CRUSH_INVALID_OUTPUT,
    root,
  });
} catch (error) {
  invalidFailure = error;
}

const errors =
  invalidFailure instanceof AggregateError ? invalidFailure.errors : [];
const causeMessages = errors.map((error) =>
  error.cause instanceof Error ? error.cause.message : undefined,
);
await build({
  logLevel: "silent",
  mode: "valid",
  outDir: env.CRUSH_VALID_OUTPUT,
  root,
});

await writeFile(
  env.CRUSH_RESULT_FILE,
  JSON.stringify({
    causePreserved:
      causeMessages.includes("fixture site loader failed") &&
      causeMessages.includes("fixture navigation loader failed"),
    diagnostics: errors.length,
    stacksUseful: errors.every(
      (error) => error instanceof Error && error.stack?.includes("at "),
    ),
    validBuildCompleted: true,
  }),
);

import { writeFile } from "node:fs/promises";
import { env, exit } from "node:process";
import { URL } from "node:url";

import { build } from "astro";

const root = new URL("./", import.meta.url);

try {
  await build({
    logLevel: "silent",
    mode: "invalid",
    outDir: env.CRUSH_INVALID_OUTPUT,
    root,
  });
  await writeFile(
    env.CRUSH_RESULT_FILE,
    JSON.stringify({ message: "Invalid fixture unexpectedly passed" }),
  );
  exit(2);
} catch (error) {
  const errors = error instanceof AggregateError ? error.errors : [];
  const causeMessages = errors.map((diagnostic) =>
    diagnostic.cause instanceof Error ? diagnostic.cause.message : undefined,
  );
  await writeFile(
    env.CRUSH_RESULT_FILE,
    JSON.stringify({
      causePreserved:
        causeMessages.includes("fixture site loader failed") &&
        causeMessages.includes("fixture navigation loader failed"),
      diagnostics: errors.length,
      message: error instanceof Error ? error.message : String(error),
      origins: errors.map((diagnostic) => diagnostic.origin),
      stacksUseful: errors.every(
        (diagnostic) =>
          diagnostic instanceof Error && diagnostic.stack?.includes("at "),
      ),
    }),
  );
  exit(1);
}

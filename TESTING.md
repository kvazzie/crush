# Testing

## Quick reference

| Type | Boundary | Location | Command |
| --- | --- | --- | --- |
| Unit | One module | Inside `src/**/*.ts`, under `if (import.meta.vitest)` | `pnpm test:unit` |
| Integration | Interaction between implementation modules | `src/**/*.test.ts`, in the nearest common parent of those modules | `pnpm test:integration` |
| Black box | Public behavior of the built package and real Astro builds | `tests/**/*.test.ts` | `pnpm test:e2e` |

All types use Vitest in Node. Run `pnpm test` for the full suite.

## Choosing and placing tests

Put a unit test in the source file of the module it exercises. Integration tests live in the closest directory shared by the modules they exercise. Place a test outside `src/` when it should remain valid after a complete rewrite of the implementation: it checks the public contract, not the implementation. Black-box tests should use the built package boundary; real Astro fixtures belong in `tests/fixtures/`.

Keep support code near the tests that use it. Shared helpers and fixture files must not use the `.test.ts` suffix. Avoid placing tests inside fixture projects unless they are themselves tests to be discovered.

## Test style

Use `if (import.meta.vitest)` and obtain `it`, `expect`, and other test APIs from `import.meta.vitest` inside source files. Import Vitest APIs explicitly in separate test files. Name cases for the behavior they establish and assert observable results. Prefer real collaborators; mock an external boundary only when needed for isolation or determinism. Use dedicated temporary directories and clean up files and other resources, including after failures. Add shared setup or helpers when a real need emerges.

Vite replaces `import.meta.vitest` with `undefined` and removes the unreachable block in production. TypeScript emits declarations separately. Do not make production behavior depend on code inside the test condition.

## Commands

| Purpose | Command |
| --- | --- |
| Full suite, including package build | `pnpm test` |
| Unit | `pnpm test:unit` |
| Integration | `pnpm test:integration` |
| Black box, including package build | `pnpm test:e2e` |
| One file | `pnpm exec vitest run path/to/file.test.ts` |
| One in-source test file | `pnpm exec vitest run --project unit src/index.ts` |
| One case | `pnpm exec vitest run path/to/file.test.ts -t 'case name'` |
| Watch | `pnpm test:watch` |
| Unit and integration coverage | `pnpm test:coverage` |
| Check TypeScript files | `pnpm typecheck` |

Build before directly running a black-box test. Watch mode builds once at startup; rebuild after production changes when watching black-box tests. Vitest exits unsuccessfully when the selected suite has no tests, except for the coverage command, which allows an empty unit and integration suite. Coverage measures source code executed by unit and integration tests and reports via V8 to the terminal and `coverage/`, without a threshold. Black-box tests run separately against the built package; their execution and separate Astro processes are not included in that coverage report.

## Dependencies and configuration

`vitest`, `@vitest/coverage-v8`, and `vite` are development dependencies managed with pnpm and its lockfile. Keep the coverage provider version compatible with Vitest. Test projects and coverage are configured in `vitest.config.ts`; package output and removal of in-source tests are configured in `vite.config.ts`. Update this document and verify affected commands when changing the test system or its dependencies.

## CI

`.github/workflows/test.yml` runs on pushes and pull requests with Node 24. It installs the frozen lockfile, checks project TypeScript files, runs all tests against the built package, and reports unit and integration coverage. Coverage has no minimum threshold. `tsconfig.check.json` checks project TypeScript, including tests, fixtures and configuration; `tsconfig.json` limits declaration output to production source files.

## Disposable diagnostics

Keep one-off diagnostic probes outside the repository or remove them after use. Any behavior check retained in the repository is a test and follows these conventions.

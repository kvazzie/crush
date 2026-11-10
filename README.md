# Crush

Crush collects selected content failures while an Astro static build continues
with explicit fallback values. After rendering, its integration fails the build
with an aggregate report. Files from a failed build must not be deployed.

## Use with Astro

Crush currently supports Astro 7 and its `astro/zod` schemas. Install the package
alongside Astro. Until an npm release exists, install a built archive produced by
`pnpm pack` or use a published Git revision that builds the package on install.
Register the integration in `astro.config.ts`:

```ts
import { defineConfig } from "astro/config";
import * as Crush from "@kvazzie/crush";

export default defineConfig({ integrations: [Crush.integration()] });
```

A collection contract supplies an ID and a schema that returns a usable fallback:

```ts
import { getEntry } from "astro:content";
import { z } from "astro/zod";
import * as Crush from "@kvazzie/crush";

const Site = {
  id: "site",
  schema: z.object({ id: z.string(), data: z.object({ name: z.string() }) })
    .catch({ id: "fallback", data: { name: "Missing site" } }),
} as const satisfies Crush.CollectionContract;

const [site] = await Promise.allSettled([getEntry(Site.id, "default")]).then(
  Crush.if(Crush.at(0)).is(z.undefined(), Crush.instead({ 0: Site })),
);
```

For `Promise.all`, attach `Crush.on(Site)` to each member whose rejection
should be recovered. `on` does not check fulfilled values. The Astro fixture in
`tests/fixtures/crush-build` shows both forms.

## Boundaries

Only selected top-level array indices and record keys are checked. Unselected
rejections and exceptions in schemas, matchers, or Astro stop the build normally.
The library does not generate random values or recover arbitrary build errors.
The matcher must describe values to replace; the contract schema must accept
those values or define a fallback with `catch`. Rejected promises use `undefined`
as input to the recovery schema. The original rejection is retained as a cause.

Diagnostics are held in process-wide state, reset at build start, and reported
at `astro:build:done`. Concurrent builds in one process are not isolated. Astro
must reach that hook for the aggregate to be reported. Astro SSR and request-time
recovery are outside the supported scope. A normal object whose every value has
a `status` of `fulfilled` or `rejected` is interpreted as settled-promise input.

## Development

Use Node 24 and pnpm 10.33.2. Run `pnpm install --frozen-lockfile`, then
`pnpm test` or `pnpm test:coverage`. See [TESTING.md](TESTING.md) for test
layout and commands. The package is private until its public package name and
release process are selected; the GitHub repository can still be public.

The implementation originated in `kvazzie/astro-template` at commit
`ffc2dba509b057f7fbca6d541538d320e653653d`. Both projects use the 0BSD license.

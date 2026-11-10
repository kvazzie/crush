import { z } from "astro/zod";
import * as Crush from "@kvazzie/crush";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("Crush conditional recovery", () => {
  it("recovers every selected missing tuple value and preserves valid values", () => {
    const Catalog = {
      id: "catalog",
      schema: z
        .object({ title: z.string() })
        .catch({ title: "Recovered catalog" }),
    } as const;
    const Site = {
      id: "site",
      schema: z.object({ name: z.string() }).catch({ name: "Recovered site" }),
    } as const;
    const input: [undefined, { name: string } | undefined, number] = [
      undefined,
      { name: "Authored site" },
      7,
    ];

    const recovered = Crush.if(Crush.at(0, 1)).is(
      z.undefined(),
      Crush.instead({ 0: Catalog, 1: Site }),
    )(input);

    expect(recovered).toEqual([
      { title: "Recovered catalog" },
      { name: "Authored site" },
      7,
    ]);
    type Expected = [{ title: string }, { name: string }, number];
    const expected: Expected = recovered;
    const exact: typeof recovered = expected;

    expectTypeOf(exact).toEqualTypeOf<Expected>();
  });

  it("unwraps settled values and recovers a selected rejection in one transformation", async () => {
    const Catalog = {
      id: "catalog",
      schema: z
        .object({ title: z.string() })
        .catch({ title: "Recovered catalog" }),
    } as const;
    const Site = {
      id: "site",
      schema: z.object({ name: z.string() }).catch({ name: "Recovered site" }),
    } as const;
    const loaderFailure = new Error("site loader failed");
    const settled = await Promise.allSettled([
      Promise.resolve<{ title: string } | undefined>(undefined),
      Promise.reject<{ name: string }>(loaderFailure),
    ] as const);

    const recovered = Crush.if(Crush.at(0, 1)).is(
      z.undefined(),
      Crush.instead({ 0: Catalog, 1: Site }),
    )(settled);

    expect(recovered).toEqual([
      { title: "Recovered catalog" },
      { name: "Recovered site" },
    ]);
    expectTypeOf(recovered).toEqualTypeOf<
      [{ title: string }, { name: string }]
    >();
  });

  it("recovers a Promise.all member rejection at its catch handler", async () => {
    const Site = {
      id: "site",
      schema: z.object({ name: z.string() }).catch({ name: "Recovered site" }),
    } as const;

    const recovered = await Promise.all([
      Promise.resolve({ title: "Authored catalog" }),
      Promise.reject<{ name: string }>(new Error("site loader failed")).catch(
        Crush.on(Site),
      ),
    ] as const);

    expect(recovered).toEqual([
      { title: "Authored catalog" },
      { name: "Recovered site" },
    ]);
    type Expected = [{ title: string }, { name: string }];
    const expected: Expected = recovered;
    const exact: typeof recovered = expected;

    expectTypeOf(exact).toExtend<Expected>();
    expectTypeOf<Expected>().toExtend<typeof exact>();
  });

  it("recovers multiple selected record fields without changing other fields", () => {
    const Page = {
      id: "page",
      schema: z
        .object({ title: z.string() })
        .catch({ title: "Recovered page" }),
    } as const;
    const Site = {
      id: "site",
      schema: z.object({ name: z.string() }).catch({ name: "Recovered site" }),
    } as const;
    const input: {
      page: { title: string } | undefined;
      revision: number;
      site: { name: string } | undefined;
    } = { page: undefined, revision: 3, site: undefined };

    const recovered = Crush.if(Crush.at("page", "site")).is(
      z.undefined(),
      Crush.instead({ page: Page, site: Site }),
    )(input);

    expect(recovered).toEqual({
      page: { title: "Recovered page" },
      revision: 3,
      site: { name: "Recovered site" },
    });
    expectTypeOf(recovered).toEqualTypeOf<{
      page: { title: string };
      revision: number;
      site: { name: string };
    }>();
  });

  it("supports selected positions in an ordinary array", () => {
    const Label = {
      id: "label",
      schema: z.string().catch("Recovered label"),
    } as const;
    const input: Array<string | undefined> = [
      undefined,
      "Authored",
      undefined,
    ];

    const recovered = Crush.if(Crush.at(0, 2)).is(
      z.undefined(),
      Crush.instead({ 0: Label, 2: Label }),
    )(input);

    expect(recovered).toEqual([
      "Recovered label",
      "Authored",
      "Recovered label",
    ]);
    expectTypeOf(recovered[0]).toEqualTypeOf<string>();
    expectTypeOf(recovered[1]).toEqualTypeOf<string | undefined>();
  });

  it("rejects a selector that is not present in the input", () => {
    const Label = {
      id: "label",
      schema: z.string().catch("Recovered label"),
    } as const;
    const recover = Crush.if(Crush.at("missing")).is(
      z.undefined(),
      Crush.instead({ missing: Label }),
    );

    expect(() =>
      recover({ present: undefined } as Record<string, unknown>),
    ).toThrow('Selected location "missing" is not present in the input');

    const recoverMissingRecord = () => {
      // @ts-expect-error The exact record type has no selected "missing" key.
      recover({ present: undefined });
    };
    expectTypeOf(recoverMissingRecord).toBeFunction();
  });

  it("propagates a collection contract fault as an ordinary failure", () => {
    const Broken = {
      id: "broken",
      schema: z.object({ title: z.string() }),
    } as const;
    const recover = Crush.if(Crush.at(0)).is(
      z.undefined(),
      Crush.instead({ 0: Broken }),
    );

    expect(() => recover([undefined] as const)).toThrow(z.ZodError);
  });
});

import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const catalog = defineCollection({
  loader: file("src/content/catalog.json"),
  schema: z.object({ title: z.string() }),
});
const site = defineCollection({
  loader: file("src/content/site.json"),
  schema: z.object({ name: z.string() }),
});
const navigation = defineCollection({
  loader: file("src/content/navigation.json"),
  schema: z.object({ label: z.string() }),
});

export const collections = { catalog, navigation, site };

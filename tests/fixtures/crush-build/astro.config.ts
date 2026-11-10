import { defineConfig } from "astro/config";

import * as Crush from "@kvazzie/crush";

export default defineConfig({
  integrations: [Crush.integration()],
  output: "static",
});

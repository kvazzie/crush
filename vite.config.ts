import { defineConfig } from "vite";

export default defineConfig({
  define: { "import.meta.vitest": "undefined" },
  build: {
    target: "es2022",
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "index.js" },
    rolldownOptions: { external: [/^astro(?:\/|$)/] },
  },
});

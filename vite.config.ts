import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/index.ts",
    target: "node18",
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
});

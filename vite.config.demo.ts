import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Demo / documentation site. The library build is tsconfig.build.json, not this. */
export default defineConfig({
  root: "demo",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
  },
});

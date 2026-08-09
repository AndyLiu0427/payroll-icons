import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // The suite renders to a string rather than a DOM, so no jsdom is needed.
    environment: "node",
  },
});

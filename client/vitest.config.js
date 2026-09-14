import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.js",
    globals: true,
    // e2e/ holds Playwright specs (test:e2e script), which use a different
    // test API and must never be picked up by vitest's default file matching.
    exclude: ["e2e/**", "node_modules/**"],
  },
});

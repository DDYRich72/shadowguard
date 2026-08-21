import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(configDir, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Tests must not hit the network — every API client is mocked.
    // If a test ever opens a real socket, it's a setup bug.
    globals: false,
    // Sliding-window rate-limit tests rely on a clean globalThis bucket
    // store. Per-file isolation is enough; per-test reset is done
    // inline in the affected file's beforeEach.
    isolate: true,
  },
});

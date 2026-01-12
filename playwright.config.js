// playwright.config.js
import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";

// ✅ Silencia el log de dotenv v17+
dotenv.config({ path: ".env.test", quiet: true });
dotenv.config({ quiet: true }); // fallback (.env)

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },

  // ✅ Reporters:
  // - list: salida bonita en consola
  // - html: reporte visual
  // - json: archivo exportable para armar tu tabla de 94 tests
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-results.json" }],
  ],

  projects: [
    // ✅ TODO lo que toca BD → serial (1 worker)
    {
      name: "db-serial",
      testMatch: [
        "**/*_api.spec.js",          // incidentes_api.spec.js, etc
        "**/auth_endpoints.spec.js", // 2FA + force-change (siembra usuarios)
        "**/*_ui.spec.js",           // incidentes_ui.spec.js (usa Prisma)
      ],
      workers: 1,
    },

    // ✅ UI/seguridad que NO toca BD → paralelo
    {
      name: "ui-parallel",
      testMatch: ["**/*.spec.js"],
      testIgnore: [
        "**/*_api.spec.js",
        "**/auth_endpoints.spec.js",
        "**/*_ui.spec.js",
      ],
      workers: 4,
    },
  ],
});
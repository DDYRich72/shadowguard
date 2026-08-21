import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Rule tuning. See SECURITY_ROADMAP.md "remaining code work" for
  // the triage plan on the downgraded rules.
  {
    rules: {
      // The new React 19 / Next 16 Compiler rules are strict about
      // patterns that are valid but unconventional (reading from an
      // external system like localStorage / fetch and setState-ing the
      // result). Demoting to warnings so CI doesn't block while we
      // refactor pre-existing code toward the stricter patterns over
      // time. Safe-for-now, not safe-forever.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // `any` is a legitimate code smell; the bulk of ours live in
      // Microsoft Graph / Google Admin SDK response shapes where the
      // upstream types are genuinely dynamic. Warn now, proper typing
      // later.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

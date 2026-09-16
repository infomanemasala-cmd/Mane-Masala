import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // The app intentionally uses effect-driven loading for Supabase data.
      // React's set-state-in-effect rule treats these external-data synchronization
      // effects as cascading renders even when the state update occurs after I/O.
      "react-hooks/set-state-in-effect": "off",
      // Supabase rows are intentionally dynamic in the shared console layer.
      // Keep explicit-any visible as warnings until generated database types are
      // adopted across every legacy console component.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

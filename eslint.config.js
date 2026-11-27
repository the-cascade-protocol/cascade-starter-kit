import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/", "**/dist-browser/", "build/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ["app/said.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value!='cascade-runtime/app'][source.value!='cascade-runtime/terms'], ImportExpression, ExportNamedDeclaration[source], ExportAllDeclaration",
          message:
            "What the app's pages say runs everywhere, as plain functions: said.ts imports only cascade-runtime/app, which both targets have, and the runtime's terms, and re-exports nothing.",
        },
      ],
    },
  },
  {
    files: ["app/src/**/*.{ts,tsx}", "add-ons/*/src/**/*.{ts,tsx}"],
    ignores: ["app/src/hosts/browser.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='cascade-runtime'][importKind!='type'] > ImportSpecifier[importKind!='type'][imported.name!='Refusal'], ImportExpression[source.value='cascade-runtime']",
          message:
            "The Node target's bundle carries cascade-runtime/app's browser build and no more of the runtime: only src/hosts/browser.ts reaches the rest of cascade-runtime in the page.",
        },
        {
          selector:
            "ImportDeclaration[source.value='cascade-runtime/app'] > ImportSpecifier[importKind!='type'][imported.name=/^(podApi|browserHost|popupSignIns)$/]",
          message:
            "A screen reaches PodApi through the host: only src/hosts/browser.ts makes it in the page.",
        },
        {
          selector:
            "ImportDeclaration[source.value=/\\/server\\//][importKind!='type']",
          message:
            "The app reaches the server by its types only: `import type` from app/server/, so no server code enters the bundle.",
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);

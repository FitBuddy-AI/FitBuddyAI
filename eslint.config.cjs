// Inline ignore patterns so lint scope does not rely on a removed .eslintignore
const ignores = [
  "node_modules/",
  "dist/",
  "public/",
  "build/",
  ".vite/",
  "**/*.d.ts",
  "coverage/",
  ".vercel/",
];

module.exports = [
  { ignores },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.cjs"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        // Project is omitted to avoid expensive type-aware rules by default
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      // Keep a friendly baseline for migration: relax strict rules that
      // would create a large number of failures in an existing codebase.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrors": "none"
        }
      ],
      // allow require() in CJS files
      "@typescript-eslint/no-require-imports": "off",
      // stylistic choices
      "prefer-const": "error",
    },
  },
];

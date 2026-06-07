/* Minimal ESLint config — focuses on real bugs, not style. Style is owned
 * by prettier/tsc. Expand rules as the team agrees, not preemptively. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  settings: { react: { version: "detect" } },
  ignorePatterns: [
    "dist",
    "node_modules",
    "archive",
    "*.config.ts",
    "*.config.js",
    "vitest.setup.ts",
  ],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      files: ["**/*.test.{ts,tsx}", "**/__tests__/**", "vitest.setup.ts"],
      env: { node: true },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
  ],
};

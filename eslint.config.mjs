import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/node_modules/**",
      "next-env.d.ts",
      "packages/db/src/generated/**",
      "packages/scanner/test/fixtures/**",
      "packages/validation/test/fixtures/**",
      "packages/validation/test/fixtures/**/out/**",
      "packages/validation/test/fixtures/**/cache/**",
      "packages/deployment/test/fixtures/**",
      "packages/deployment/scripts/**",
      "packages/changeset/test/fixtures/**",
      "scripts/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.eslint.json", "./apps/web/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["**/*.config.{js,mjs,ts}"],
    ...tseslint.configs.disableTypeChecked,
  },
);

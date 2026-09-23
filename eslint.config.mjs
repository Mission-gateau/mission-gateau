import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // src/pdf compose des documents PDF : son <Image> vient de
    // @react-pdf/renderer, pas du DOM. Les règles d'accessibilité HTML n'y
    // ont pas de sens.
    files: ["src/pdf/**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "off",
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "samples/**"]),
]);

export default eslintConfig;

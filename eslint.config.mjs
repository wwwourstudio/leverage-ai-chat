// @ts-check
import tsConfig from "eslint-config-next/typescript";

export default [
  { ignores: [".next/**", "node_modules/**", "scripts/**"] },
  ...tsConfig,
];

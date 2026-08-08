/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "next/core-web-vitals",
    "prettier",
  ],
  rules: {
    "@next/next/no-img-element": "off",
    "react-hooks/exhaustive-deps": "warn",
  },
};

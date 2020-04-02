module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/nodejs',
  ],
  plugins: [
    'json',
  ],
  globals: {
    document: false,
    navigator: false,
    web3: true,
    window: false,
    $: false,
    QUnit: false,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {},
  ignorePatterns: [
    '!.eslintrc.js',
    'node_modules/',
  ],
}

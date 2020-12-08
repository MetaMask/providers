module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    '@metamask/eslint-config',
    '@metamask/eslint-config/config/jest',
    '@metamask/eslint-config/config/nodejs',
  ],
  plugins: [
    'json',
  ],
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'node/no-sync': 'off',
  },
  overrides: [
    {
      files: ['test/mocks/**'],
      rules: {
        'no-empty-function': 'off',
      },
    },
    {
      files: ['test/**'],
      rules: {
        'node/no-callback-literal': 'off',
      },
    },
  ],
  ignorePatterns: [
    '!.eslintrc.js',
    'node_modules/',
  ],
}

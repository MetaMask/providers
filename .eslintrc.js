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
  ignorePatterns: [
    '!.eslintrc.js',
    'node_modules/',
  ],
  overrides: [
    {
      files: ['test/mocks/**'],
      rules: {
        'no-empty-function': 'off',
      },
    },
  ],
}

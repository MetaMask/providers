module.exports = {
  root: true,

  extends: ['@metamask/eslint-config'],

  overrides: [
    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        // These are disabled because this project uses both Node.js and browser
        // globals and packages. In the future, we should consider removing the
        // Node.js-specific packages and enabling these rules.
        'no-restricted-globals': 'off',
        'import/no-nodejs-modules': 'off',
      },
    },

    {
      files: ['*.js'],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'script',
      },
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['*.test.ts', '*.test.js'],
      extends: [
        '@metamask/eslint-config-jest',
        '@metamask/eslint-config-nodejs',
      ],
    },
  ],

  ignorePatterns: [
    '!.eslintrc.js',
    '!.prettierrc.js',
    'dist/',
    'docs/',
    '.yarn/',
  ],
};

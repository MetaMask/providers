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
      files: ['*.d.ts'],
      rules: {
        'import/unambiguous': 'off',
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
      files: ['*.test.ts', '*.test.js', 'jest.setup*.js'],
      extends: [
        '@metamask/eslint-config-jest',
        '@metamask/eslint-config-nodejs',
      ],
    },

    {
      files: ['EIP6963.test.ts', 'CAIP294.test.ts', 'jest.setup.browser.js'],
      rules: {
        // We're mixing Node and browser environments in these files.
        'no-restricted-globals': 'off',
      },
    },

    {
      files: ['jest.setup.browser.js'],
      env: { browser: true },
      // This file contains copypasta and we're not going to bother fixing these.
      rules: {
        'jest/require-top-level-describe': 'off',
        'jsdoc/require-description': 'off',
        'jsdoc/require-param-description': 'off',
        'jsdoc/require-param-type': 'off',
      },
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

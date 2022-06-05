const baseConfig = {
  moduleFileExtensions: ['ts', 'js', 'json', 'node', 'jsx', 'tsx'],
  preset: 'ts-jest',
  // "resetMocks" resets all mocks, including mocked modules, to jest.fn(),
  // between each test case.
  resetMocks: true,
  // "restoreMocks" restores all mocks created using jest.spyOn to their
  // original implementations, between each test. It does not affect mocked
  // modules.
  restoreMocks: true,
  testTimeout: 2500,
};

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/**/src/**/*.ts',
    '!<rootDir>/**/src/**/*.test.ts',
  ],
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'json-summary'],
  coveragePathIgnorePatterns: ['/node_modules/', '/mocks/', '/test/'],
  coverageThreshold: {
    global: {
      branches: 43.11,
      functions: 45.12,
      lines: 47.09,
      statements: 47.41,
    },
  },
  projects: [
    {
      ...baseConfig,
      displayName: 'StreamProvider',
      testEnvironment: 'node',
      testMatch: ['**/StreamProvider.test.ts'],
    },
    {
      ...baseConfig,
      displayName: 'Browser Providers',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/*InpageProvider.test.ts',
        '**/*ExtensionProvider.test.ts',
      ],
      setupFilesAfterEnv: ['./jest.setup.js'],
    },
  ],
  silent: true,
};

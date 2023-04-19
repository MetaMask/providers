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
};

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/**/src/**/*.ts',
    '!<rootDir>/**/src/**/*.test.ts',
  ],
  coverageReporters: ['html', 'json-summary', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/mocks/', '/test/'],
  coverageThreshold: {
    global: {
      branches: 58.82,
      functions: 54.95,
      lines: 60.91,
      statements: 61.14,
    },
  },
  projects: [
    {
      ...baseConfig,
      displayName: 'StreamProvider',
      testEnvironment: 'node',
      testMatch: [
        '**/StreamProvider.test.ts',
        '**/utils.test.ts',
        '**/middleware/*.test.ts',
      ],
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
  testTimeout: 2500,
};

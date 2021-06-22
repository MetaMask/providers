module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['./src/**.ts'],
  coverageReporters: ['text', 'html'],
  coveragePathIgnorePatterns: ['/node_modules/', '/mocks/'],
  // TODO: Require coverage when we're closer to home.
  // coverageThreshold: {
  //   global: {
  //     branches: 100,
  //     functions: 100,
  //     lines: 100,
  //     statements: 100,
  //   },
  // },
  moduleFileExtensions: ['js', 'json', 'ts', 'node'],
  preset: 'ts-jest',
  // "resetMocks" resets all mocks, including mocked modules, to jest.fn(),
  // between each test case.
  resetMocks: true,
  // "restoreMocks" restores all mocks created using jest.spyOn to their
  // original implementations, between each test. It does not affect mocked
  // modules.
  restoreMocks: true,
  setupFilesAfterEnv: ['./jest.setup.js'],
  silent: true,
  testEnvironment: 'jsdom',
  testRegex: ['\\.test\\.ts$'],
  testTimeout: 2500,
};

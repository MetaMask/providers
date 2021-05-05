module.exports = {
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
  setupFilesAfterEnv: ['./jest.setup.js'],
  testEnvironment: 'jsdom',
  silent: true,
  preset: 'ts-jest',
  testRegex: ['\\.test\\.ts$'],
  testTimeout: 5000,
};

module.exports = {
  // TODO: Collect coverage when we're closer to home.
  // collectCoverage: true,
  // coverageReporters: ['text', 'html'],
  // coverageThreshold: {
  //   global: {
  //     branches: 100,
  //     functions: 100,
  //     lines: 100,
  //     statements: 100,
  //   },
  // },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/mocks/',
  ],
  moduleFileExtensions: ['js'],
  silent: true,
  testEnvironment: 'jsdom',
  testRegex: [
    '\\.test\\.js$',
  ],
  testTimeout: 5000,
}

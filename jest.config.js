module.exports = {
  coverageReporters: ['text', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/mocks/',
  ],
  // TODO: Require coverage when we're closer to home.
  // coverageThreshold: {
  //   global: {
  //     branches: 100,
  //     functions: 100,
  //     lines: 100,
  //     statements: 100,
  //   },
  // },
  moduleFileExtensions: ['js'],
  silent: true,
  testEnvironment: 'jsdom',
  testRegex: [
    '\\.test\\.js$',
  ],
  testTimeout: 5000,
}
